(function () {
  'use strict';

  function cpLoadScript(src, callback) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = callback;
    document.head.appendChild(s);
  }

  async function cpFetchAds(endpoint) {
    if (!endpoint) return null;
    try {
      const res = await fetch(endpoint);
      const data = await res.json();
      return data.ads || null;
    } catch (e) {
      return null;
    }
  }

  async function initCinePlayer() {
    const config = window.CinePlayerConfigs;
    if (!config || !config.id) return;

    const container = document.getElementById(config.id);
    if (!container) return;

    const adsData = await cpFetchAds(config.adApiUrl);
    const imdbId = (config.src || '').match(/tt\d{7,9}/) ? config.src.match(/tt\d{7,9}/)[0] : 'Movie';

    // Player styling
    container.style.position = 'relative';
    container.style.width = config.width ? (typeof config.width === 'number' ? config.width + 'px' : config.width) : '100%';
    container.style.maxWidth = '100%';
    container.style.aspectRatio = '16 / 9';
    container.style.backgroundColor = '#000';
    container.style.borderRadius = '12px';
    container.style.overflow = 'hidden';
    container.style.fontFamily = 'system-ui, sans-serif';
    container.style.userSelect = 'none';

    // 1. Initial Loading Spinner
    const loader = document.createElement('div');
    loader.id = `cp-loader-${config.id}`;
    loader.style.cssText = 'position:absolute;inset:0;background:#050811;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#f59e0b;z-index:25;';
    loader.innerHTML = `
      <div style="width:40px;height:40px;border:3px solid #222;border-top:3px solid #f59e0b;border-radius:50%;animation:cp-spin 0.8s linear infinite;"></div>
      <p style="margin-top:14px;font-size:13px;font-weight:600;">Please wait ⏳ Loading Engine...</p>
      <style>@keyframes cp-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
    `;
    container.appendChild(loader);

    // 2. Video Element
    const video = document.createElement('video');
    video.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block;';
    video.playsInline = true;
    container.appendChild(video);

    // 3. Custom Watermark (Logo / Text)
    if (config.watermark) {
      const wm = document.createElement('div');
      wm.style.cssText = 'position:absolute;top:15px;right:15px;z-index:20;pointer-events:none;opacity:0.85;';
      wm.innerHTML = config.watermark.type === 'image'
        ? `<img src="${config.watermark.content}" style="height:32px;max-width:130px;object-fit:contain;">`
        : `<span style="font-weight:800;font-size:12px;color:#fff;background:rgba(0,0,0,0.65);padding:4px 8px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);letter-spacing:1px;">${config.watermark.content}</span>`;
      container.appendChild(wm);
    }

    // 4. Custom Control Bar
    const controls = document.createElement('div');
    controls.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:10px 14px;background:linear-gradient(transparent, rgba(0,0,0,0.95));display:flex;align-items:center;gap:10px;z-index:20;opacity:0;transition:opacity 0.3s;';
    controls.innerHTML = `
      <button id="cp-play" style="background:none;border:none;color:#fff;font-size:17px;cursor:pointer;">▶</button>
      <input type="range" id="cp-seek" min="0" max="100" value="0" style="flex:1;cursor:pointer;accent-color:#f59e0b;">
      <span id="cp-time" style="font-size:11px;color:#bbb;min-width:65px;">00:00 / 00:00</span>
      <select id="cp-quality" style="background:#111;color:#f59e0b;border:1px solid #444;font-size:11px;padding:3px 6px;border-radius:4px;cursor:pointer;outline:none;">
        <option value="1080">1080p</option>
        <option value="720" selected>720p</option>
        <option value="480">480p</option>
        <option value="360">360p</option>
        <option value="240">240p</option>
      </select>
      <button id="cp-download" style="background:#f59e0b;border:none;color:#000;font-size:11px;font-weight:bold;padding:5px 9px;border-radius:4px;cursor:pointer;">
        ⬇ Download
      </button>
      <button id="cp-fs" style="background:none;border:none;color:#fff;font-size:15px;cursor:pointer;">⛶</button>
    `;
    container.appendChild(controls);

    container.onmouseenter = () => controls.style.opacity = '1';
    container.onmouseleave = () => controls.style.opacity = '0';

    // 5. Convert & Download Modal UI
    const modal = document.createElement('div');
    modal.style.cssText = 'position:absolute;inset:0;background:rgba(5,8,17,0.96);display:none;flex-direction:column;align-items:center;justify-content:center;padding:20px;z-index:50;color:#fff;backdrop-filter:blur(6px);text-align:center;';
    modal.innerHTML = `
      <div style="background:#111827;border:1px solid #374151;border-radius:12px;padding:24px;max-width:380px;width:100%;">
        <h4 style="margin:0 0 8px 0;font-size:16px;color:#f59e0b;">Video Converter</h4>
        <p style="font-size:12px;color:#9ca3af;margin:0 0 16px 0;">ID: ${imdbId} • <span id="cp-target-res" style="color:#fff;font-weight:bold;">720p</span></p>
        <div style="width:100%;background:#1f2937;height:8px;border-radius:4px;overflow:hidden;margin-bottom:12px;">
          <div id="cp-pbar" style="width:0%;height:100%;background:#f59e0b;transition:width 0.2s linear;"></div>
        </div>
        <p id="cp-status" style="font-size:12px;color:#f59e0b;margin:0 0 18px 0;">Please wait ⏳ Encoding Video...</p>
        <div id="cp-action-area" style="display:flex;gap:10px;justify-content:center;">
          <button id="cp-cancel" style="background:#374151;border:none;color:#fff;padding:8px 14px;border-radius:6px;font-size:12px;cursor:pointer;">Cancel</button>
        </div>
      </div>
    `;
    container.appendChild(modal);

    // 6. Pre-Roll Ad Handler
    function runPreRollAd(onFinish) {
      if (!adsData || !adsData.preRoll || !adsData.preRoll.enabled) {
        onFinish();
        return;
      }
      const ad = adsData.preRoll;
      const adBox = document.createElement('div');
      adBox.style.cssText = 'position:absolute;inset:0;background:#000;z-index:35;display:flex;align-items:center;justify-content:center;cursor:pointer;';
      adBox.innerHTML = ad.type === 'video'
        ? `<video src="${ad.mediaUrl}" autoplay muted playsinline style="width:100%;height:100%;object-fit:cover;"></video>`
        : `<img src="${ad.mediaUrl}" style="width:100%;height:100%;object-fit:cover;">`;

      adBox.onclick = (e) => {
        if (e.target.id !== 'cp-skip') window.open(ad.targetUrl, '_blank');
      };

      const skipBtn = document.createElement('button');
      skipBtn.id = 'cp-skip';
      skipBtn.disabled = true;
      skipBtn.style.cssText = 'position:absolute;bottom:25px;right:25px;background:rgba(0,0,0,0.85);border:1px solid #555;color:#fff;padding:8px 16px;border-radius:6px;font-size:12px;font-weight:bold;cursor:not-allowed;z-index:40;';
      
      let sec = ad.skipAfter || 5;
      skipBtn.innerText = `Skip in ${sec}s`;

      const timer = setInterval(() => {
        sec--;
        if (sec > 0) {
          skipBtn.innerText = `Skip in ${sec}s`;
        } else {
          clearInterval(timer);
          skipBtn.disabled = false;
          skipBtn.innerText = 'Skip Ad ⏭';
          skipBtn.style.cursor = 'pointer';
          skipBtn.style.backgroundColor = '#f59e0b';
          skipBtn.style.color = '#000';
          skipBtn.style.borderColor = '#f59e0b';
        }
      }, 1000);

      skipBtn.onclick = (e) => {
        e.stopPropagation();
        clearInterval(timer);
        adBox.remove();
        onFinish();
      };

      adBox.appendChild(skipBtn);
      container.appendChild(adBox);
    }

    // 7. Video Stream Setup
    cpLoadScript('https://cdn.jsdelivr.net/npm/hls.js@latest', function () {
      runPreRollAd(() => {
        const streamSrc = config.streamUrl || 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
        if (window.Hls && Hls.isSupported()) {
          const hls = new Hls();
          hls.loadSource(streamSrc);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            loader.remove();
            video.play().catch(() => console.log('Autoplay muted'));
          });
        }
      });
    });

    // 8. Download & Auto-Convert Click
    const dlBtn = document.getElementById('cp-download');
    const qSelect = document.getElementById('cp-quality');
    let convTimer = null;

    dlBtn.onclick = () => {
      if (adsData && adsData.onDownloadClick && adsData.onDownloadClick.enabled) {
        window.open(adsData.onDownloadClick.directUrl, '_blank');
      }

      video.pause();
      const targetRes = qSelect.value;
      document.getElementById('cp-target-res').innerText = `${targetRes}p`;

      const pbar = document.getElementById('cp-pbar');
      const status = document.getElementById('cp-status');
      const actionArea = document.getElementById('cp-action-area');

      pbar.style.width = '0%';
      status.innerText = 'Please wait ⏳ Converting stream to MP4...';
      actionArea.innerHTML = `<button id="cp-cancel" style="background:#374151;border:none;color:#fff;padding:8px 14px;border-radius:6px;font-size:12px;cursor:pointer;">Cancel</button>`;
      document.getElementById('cp-cancel').onclick = () => {
        clearInterval(convTimer);
        modal.style.display = 'none';
      };

      modal.style.display = 'flex';

      let progress = 0;
      convTimer = setInterval(() => {
        progress += Math.floor(Math.random() * 8) + 4;
        if (progress > 100) progress = 100;
        pbar.style.width = `${progress}%`;

        if (progress >= 30 && progress < 75) {
          status.innerText = `Please wait ⏳ Encoding ${targetRes}p Video... (${progress}%)`;
        } else if (progress >= 75 && progress < 100) {
          status.innerText = `Please wait ⏳ Finalizing MP4 Container... (${progress}%)`;
        }

        if (progress === 100) {
          clearInterval(convTimer);
          status.innerHTML = `✅ <b>Conversion Complete!</b> (${targetRes}p)`;

          const dlUrl = config.downloadBaseUrl
            ? `${config.downloadBaseUrl}?id=${imdbId}&res=${targetRes}`
            : (config.downloadUrl || '#');

          actionArea.innerHTML = `
            <a href="${dlUrl}" target="_blank" download="${imdbId}_${targetRes}p.mp4" 
               style="background:#f59e0b;color:#000;font-weight:bold;text-decoration:none;padding:9px 18px;border-radius:6px;font-size:12px;">
              ⬇ Click to Download
            </a>
            <button id="cp-close" style="background:#374151;border:none;color:#fff;padding:9px 14px;border-radius:6px;font-size:12px;cursor:pointer;">Close</button>
          `;
          document.getElementById('cp-close').onclick = () => modal.style.display = 'none';
        }
      }, 250);
    };

    const playBtn = document.getElementById('cp-play');
    playBtn.onclick = () => {
      if (video.paused) { video.play(); playBtn.innerText = '⏸'; }
      else { video.pause(); playBtn.innerText = '▶'; }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCinePlayer);
  } else {
    initCinePlayer();
  }
})();

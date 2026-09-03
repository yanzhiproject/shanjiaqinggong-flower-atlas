(() => {
  'use strict';

  const IMAGE_RE = /(?:\.\.\/|\.\/|assets(?:-[a-z]+)?\/)[A-Za-z0-9_./%()\-]+\.(?:avif|webp|png|jpe?g|gif)(?:\?[^'\"`\s)]+)?/gi;
  const cache = new Map();
  const swapTokens = new WeakMap();
  const queue = [];
  let activeLoads = 0;
  const MAX_CONCURRENT = 2;

  const style = document.createElement('style');
  style.textContent = `
    .sjq-image-loading { position: relative; }
    .sjq-image-loading::after {
      content: '画面载入中';
      position: absolute;
      left: 50%;
      bottom: 18px;
      z-index: 8;
      transform: translateX(-50%);
      padding: 7px 14px;
      border: 1px solid rgba(199,159,93,.32);
      border-radius: 999px;
      background: rgba(255,253,248,.9);
      color: #8b7965;
      font: 14px/1.4 Georgia,'Noto Serif SC','Songti SC',serif;
      pointer-events: none;
      animation: sjq-loading-pulse .9s ease-in-out infinite alternate;
    }
    @keyframes sjq-loading-pulse { to { opacity: .62; } }
    @media (prefers-reduced-motion: reduce) {
      .sjq-image-loading::after { animation: none; }
    }
  `;
  document.head.appendChild(style);

  function absolute(url) {
    try { return new URL(url, document.baseURI).href; }
    catch (_) { return url; }
  }

  function runQueue() {
    while (activeLoads < MAX_CONCURRENT && queue.length) {
      const job = queue.shift();
      activeLoads += 1;
      job().finally(() => {
        activeLoads -= 1;
        runQueue();
      });
    }
  }

  function preload(url) {
    const href = absolute(url);
    if (cache.has(href)) return cache.get(href);

    const promise = new Promise(resolve => {
      queue.push(async () => {
        const image = new Image();
        image.decoding = 'async';
        image.fetchPriority = 'low';
        image.onload = async () => {
          try { await image.decode(); } catch (_) {}
          resolve(href);
        };
        image.onerror = () => resolve(href);
        image.src = href;
        if (image.complete) image.onload();
      });
      runQueue();
    });

    cache.set(href, promise);
    return promise;
  }

  function warm(urls) {
    return Promise.all([...new Set(urls.filter(Boolean))].map(preload));
  }

  async function swap(image, url, options = {}) {
    if (!image || !url) return;
    const token = Symbol('image-swap');
    const busyTarget = options.busyTarget || image.closest('.visual-panel,.visual-stage,.scene,.visual') || image.parentElement;
    swapTokens.set(image, token);
    busyTarget?.classList.add('sjq-image-loading');
    busyTarget?.setAttribute('aria-busy', 'true');

    const href = await preload(url);
    if (swapTokens.get(image) !== token) return;
    image.alt = options.alt ?? image.alt;
    image.src = href;
    try { await image.decode(); } catch (_) {}
    if (swapTokens.get(image) !== token) return;
    busyTarget?.classList.remove('sjq-image-loading');
    busyTarget?.removeAttribute('aria-busy');
  }

  function collectPageImages() {
    const urls = [];
    document.querySelectorAll('img[src],source[src],source[srcset],[data-src],[data-after]').forEach(element => {
      ['src', 'data-src', 'data-after'].forEach(name => {
        const value = element.getAttribute(name);
        if (value && !value.startsWith('data:')) urls.push(value);
      });
      const srcset = element.getAttribute('srcset');
      if (srcset) srcset.split(',').forEach(part => urls.push(part.trim().split(/\s+/)[0]));
    });

    document.querySelectorAll('script:not([src])').forEach(script => {
      const type = (script.getAttribute('type') || '').toLowerCase();
      if (type && type !== 'text/javascript' && type !== 'module') return;
      const matches = script.textContent.match(IMAGE_RE);
      if (matches) urls.push(...matches);
    });
    return urls;
  }

  function schedulePageWarmup() {
    const start = () => warm(collectPageImages());
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 1400 });
    else setTimeout(start, 500);
  }

  window.SJQImages = { preload, warm, swap, collectPageImages };
  if (document.readyState === 'complete') schedulePageWarmup();
  else addEventListener('load', schedulePageWarmup, { once: true });
})();

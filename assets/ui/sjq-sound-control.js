(() => {
  const PREFERENCE_KEY = 'sjq-bgm-enabled-v1';
  const PLAYBACK_KEY = 'sjq-bgm-playback-v2';
  const controls = [...document.querySelectorAll('[data-sjq-sound-toggle]')];

  const readPreference = () => {
    try { return sessionStorage.getItem(PREFERENCE_KEY) === '1'; }
    catch { return false; }
  };

  const writePreference = enabled => {
    try { sessionStorage.setItem(PREFERENCE_KEY, enabled ? '1' : '0'); }
    catch { /* Storage can be unavailable in strict local-file mode. */ }
  };

  const readPlayback = () => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(PLAYBACK_KEY) || 'null');
      return saved && Number.isFinite(saved.time) && Number.isFinite(saved.savedAt)
        ? saved
        : null;
    } catch {
      return null;
    }
  };

  const writePlayback = audio => {
    if (!audio || !Number.isFinite(audio.currentTime)) return;
    try {
      sessionStorage.setItem(PLAYBACK_KEY, JSON.stringify({
        time: audio.currentTime,
        savedAt: Date.now()
      }));
    } catch { /* Storage can be unavailable in strict local-file mode. */ }
  };

  controls.forEach(control => {
    const selector = control.getAttribute('data-audio-target');
    const audio = selector ? document.querySelector(selector) : document.querySelector('[data-sjq-bgm]');
    const dock = control.closest('.sjq-sound-dock');
    const tip = dock?.querySelector('[data-sjq-sound-tip]');
    const normalVolume = Number(control.dataset.volume || .22);
    const duckedVolume = Number(control.dataset.duckVolume || .06);
    let wanted = readPreference();
    let userPaused = false;
    let volumeFrame = 0;
    let playbackRestored = false;
    let lastPlaybackWrite = 0;
    const activeNarrations = new Set();
    const boundAudio = new WeakSet();

    if (!audio) {
      control.disabled = true;
      control.setAttribute('aria-label', '山林清音暂不可用');
      dock?.classList.add('is-unavailable');
      if (tip) tip.textContent = '清音暂不可用';
      return;
    }

    audio.volume = normalVolume;

    const restorePlayback = () => {
      if (playbackRestored) return;
      playbackRestored = true;
      const saved = readPlayback();
      if (!saved) return;
      const elapsed = readPreference() ? Math.max(0, (Date.now() - saved.savedAt) / 1000) : 0;
      const target = saved.time + elapsed;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        audio.currentTime = target % audio.duration;
      } else {
        audio.currentTime = Math.max(0, target);
      }
    };

    if (audio.readyState >= 1) restorePlayback();
    else audio.addEventListener('loadedmetadata', restorePlayback, { once: true });

    const setTip = text => { if (tip) tip.textContent = text; };

    const sync = () => {
      const playing = !audio.paused && !audio.ended;
      control.classList.toggle('is-playing', playing);
      control.setAttribute('aria-pressed', String(playing));
      control.setAttribute('aria-label', playing ? '暂停山林清音' : '播放山林清音');
      setTip(playing ? '清音正流动' : '启清音');
    };

    const fadeVolume = (target, duration = 220) => {
      cancelAnimationFrame(volumeFrame);
      const start = audio.volume;
      const began = performance.now();
      const tick = now => {
        const progress = Math.min(1, (now - began) / duration);
        audio.volume = start + (target - start) * progress;
        if (progress < 1) volumeFrame = requestAnimationFrame(tick);
      };
      volumeFrame = requestAnimationFrame(tick);
    };

    const start = async ({ remember = true } = {}) => {
      wanted = true;
      userPaused = false;
      if (remember) writePreference(true);
      audio.volume = activeNarrations.size ? duckedVolume : normalVolume;
      try {
        await audio.play();
        dock?.classList.remove('is-inviting');
      } catch {
        dock?.classList.add('is-inviting');
        setTip('点此启清音');
      }
      sync();
    };

    const pause = () => {
      wanted = false;
      userPaused = true;
      writePreference(false);
      audio.pause();
      sync();
    };

    const bindNarration = narration => {
      if (!narration || narration === audio || boundAudio.has(narration)) return;
      boundAudio.add(narration);
      const duck = () => {
        activeNarrations.add(narration);
        if (!audio.paused) fadeVolume(duckedVolume, 180);
      };
      const restore = () => {
        activeNarrations.delete(narration);
        if (!activeNarrations.size && !audio.paused) fadeVolume(normalVolume, 280);
      };
      narration.addEventListener('play', duck);
      narration.addEventListener('playing', duck);
      narration.addEventListener('pause', restore);
      narration.addEventListener('ended', restore);
      narration.addEventListener('abort', restore);
      narration.addEventListener('emptied', restore);
    };

    const scanNarrations = root => {
      try { root?.querySelectorAll?.('audio').forEach(bindNarration); }
      catch { /* Ignore cross-origin frames. */ }
    };

    scanNarrations(document);
    document.querySelectorAll('iframe').forEach(frame => {
      const scanFrame = () => scanNarrations(frame.contentDocument);
      frame.addEventListener('load', scanFrame);
      scanFrame();
    });

    control.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (audio.paused) start(); else pause();
    });
    audio.addEventListener('play', sync);
    audio.addEventListener('pause', sync);
    audio.addEventListener('ended', sync);
    audio.addEventListener('timeupdate', () => {
      const now = Date.now();
      if (now - lastPlaybackWrite < 1000) return;
      lastPlaybackWrite = now;
      writePlayback(audio);
    });
    audio.addEventListener('error', () => {
      dock?.classList.add('is-unavailable');
      setTip('清音加载失败');
      sync();
    });

    document.addEventListener('pointerdown', event => {
      if (!wanted || userPaused || !audio.paused || event.target.closest('[data-sjq-sound-toggle]')) return;
      start({ remember: false });
    }, { capture: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        cancelAnimationFrame(volumeFrame);
        writePlayback(audio);
      }
    });

    window.addEventListener('pagehide', () => writePlayback(audio));

    if (dock?.classList.contains('sjq-sound-dock--home')) {
      dock.classList.add('is-inviting');
      window.setTimeout(() => dock.classList.remove('is-inviting'), 4200);
    }

    sync();
    if (wanted) start({ remember: false });
  });
})();

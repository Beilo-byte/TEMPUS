/* Temps en capes — all time-based visuals share one monotonic countdown. */
(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const ui = {
    stage: byId('stage'), video: byId('background-video'), image: byId('background-image'),
    paper: byId('clock-paper'), dial: byId('dial-base'), pin: byId('clock-pin'),
    hour: byId('hour-hand'), minute: byId('minute-hand'),
    second: byId('second-hand'), titleOnPhoto: byId('polaroid-title'), panelTitle: byId('panel-title'),
    title: byId('title-input'), hours: byId('hours-input'), minutes: byId('minutes-input'),
    seconds: byId('seconds-input'), remaining: byId('remaining-time'),
    start: byId('start-button'), pause: byId('pause-button'), reset: byId('reset-button'),
    background: byId('background-select'), opacity: byId('clock-opacity'),
    opacityValue: byId('opacity-value'), fullscreen: byId('fullscreen-button'),
    exitFullscreen: byId('exit-fullscreen'), sound: byId('sound-toggle'),
    status: byId('timer-status'), progress: byId('progress-fill'),
    skin: byId('skin-select'), preset: byId('preset-select'), view: byId('view-select'),
    customMedia: byId('custom-media-input'), markName: byId('mark-name'),
    addMark: byId('add-mark-button'), marksList: byId('marks-list'), marksCount: byId('marks-count'),
    ranking: byId('ranking-toggle'), exportMarks: byId('export-marks-button'),
    clearMarks: byId('clear-marks-button')
  };

  const handPack = { hour: null, minute: null, second: null };
  const handUrls = { hour: new Map(), minute: new Map(), second: new Map() };
  let clockPackPending = true;
  function handPath(kind, n) {
    const svg = handPack[kind]?.[n];
    if (!svg) return `assets/clock/${kind}/${String(n).padStart(3, '0')}.svg`;
    if (!handUrls[kind].has(n)) {
      handUrls[kind].set(n, URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
    }
    return handUrls[kind].get(n);
  }
  const paths = {
    dial: 'assets/clock/dial.svg',
    hour: (n) => handPath('hour', n),
    minute: (n) => handPath('minute', n),
    second: (n) => handPath('second', n)
  };
  const clock = { totalMs: 180000, remainingMs: 180000, deadline: 0, mode: 'ready', raf: 0 };
  const media = { items: new Map(), selected: null, kind: 'none', videoDuration: 180,
    lastSeekAt: -Infinity, lastSeekTarget: -Infinity, customUrls: [] };
  let lastHandKeys = ['', '', ''];
  let lastWholeSecond = -1;
  let audioContext;
  let preferredBackground = 'none';
  const marks = [];

  function number(value, min, max) {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : min;
  }
  function configuredSeconds() {
    return number(ui.hours?.value, 0, 999) * 3600 +
      number(ui.minutes?.value, 0, 59) * 60 + number(ui.seconds?.value, 0, 59);
  }
  function formatted(seconds) {
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  function formattedPrecise(milliseconds) {
    const tenths = Math.floor(Math.max(0, milliseconds) / 100);
    return `${formatted(Math.floor(tenths / 10))},${tenths % 10}`;
  }
  function setStatus(message) {
    if (ui.status) ui.status.textContent = message;
  }
  function fractionDone() {
    return clock.totalMs > 0 ? Math.max(0, Math.min(1, 1 - clock.remainingMs / clock.totalMs)) : 0;
  }
  function handImage(img, path, slot) {
    if (!clockPackPending && img && lastHandKeys[slot] !== path) {
      img.src = path;
      lastHandKeys[slot] = path;
    }
  }
  function renderClock() {
    // A visual tick changes at exactly the same remaining-second boundary as the readout.
    const seconds = Math.ceil(clock.remainingMs / 1000);
    if (seconds === lastWholeSecond) return;
    lastWholeSecond = seconds;
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds / 60) % 60, s = seconds % 60;
    if (ui.remaining) ui.remaining.textContent = formatted(seconds);
    handImage(ui.hour, paths.hour(((h % 12) * 60 + m) % 720), 0);
    handImage(ui.minute, paths.minute(m), 1);
    handImage(ui.second, paths.second(s), 2);
    if (ui.progress) ui.progress.style.width = `${(fractionDone() * 100).toFixed(3)}%`;
    if (ui.start) ui.start.disabled = clock.mode === 'running';
    if (ui.pause) {
      ui.pause.disabled = clock.mode === 'ready' || clock.mode === 'finished';
      ui.pause.textContent = clock.mode === 'paused' ? 'Continua' : 'Pausa';
    }
  }
  function renderProgress() {
    if (ui.progress) ui.progress.style.width = `${(fractionDone() * 100).toFixed(3)}%`;
  }

  function videoExpectedTime() {
    const duration = Number.isFinite(media.videoDuration) && media.videoDuration > 0 ? media.videoDuration : 180;
    const almostEnd = Math.max(0, duration - 1 / 30);
    return Math.min(almostEnd, fractionDone() * duration);
  }
  function syncVideo(force = false) {
    const video = ui.video;
    if (!video || media.kind !== 'video' || !video.src || video.readyState < 1) return;
    const expected = videoExpectedTime();
    const now = performance.now();
    if (clock.totalMs <= 0) return;
    const rate = media.videoDuration / (clock.totalMs / 1000);
    const playableRate = rate >= 0.0625 && rate <= 16;
    if (playableRate) {
      try { video.playbackRate = rate; } catch (_) { /* seek below */ }
    }
    const canPlay = playableRate && Math.abs(video.playbackRate - rate) < 0.001;
    const threshold = force ? 0.03 : canPlay ? 0.38 : 0.09;
    const minInterval = force ? 0 : canPlay ? 1800 : 300;
    if (Math.abs(video.currentTime - expected) > threshold && now - media.lastSeekAt >= minInterval) {
      try { video.currentTime = expected; media.lastSeekAt = now; media.lastSeekTarget = expected; } catch (_) { /* metadata still loading */ }
    }
    if (clock.mode === 'running' && canPlay) {
      if (video.paused) video.play().catch(() => {});
    } else if (!video.paused) video.pause();
  }
  function syncSequence() {
    if (media.kind !== 'sequence' || !ui.image || !media.selected?.frames?.length) return;
    const frames = media.selected.frames;
    const index = Math.min(frames.length - 1, Math.floor(fractionDone() * frames.length));
    const src = frames[index];
    if (ui.image.dataset.currentSrc !== src) {
      ui.image.src = src;
      ui.image.dataset.currentSrc = src;
      // The next image is quietly cached before its turn.
      if (index + 1 < frames.length) { const next = new Image(); next.src = frames[index + 1]; }
    }
  }
  function syncMedia(force = false) {
    if (media.kind === 'video') syncVideo(force);
    else if (media.kind === 'sequence') syncSequence();
  }
  function complete() {
    clock.mode = 'finished';
    clock.remainingMs = 0;
    cancelAnimationFrame(clock.raf);
    if (ui.video) ui.video.pause();
    renderClock(); renderProgress(); syncMedia(true);
    setStatus('Temps acabat');
    if (ui.start) ui.start.disabled = false;
    if (ui.pause) ui.pause.disabled = true;
    updateMarkControls();
    ring();
  }
  function frame(now) {
    if (clock.mode !== 'running') return;
    clock.remainingMs = Math.max(0, clock.deadline - now);
    if (clock.remainingMs <= 0) { complete(); return; }
    renderClock(); renderProgress(); syncMedia();
    clock.raf = requestAnimationFrame(frame);
  }
  function setDurationFromFields(normalize = true) {
    const seconds = configuredSeconds();
    if (normalize) {
      if (ui.hours) ui.hours.value = number(ui.hours.value, 0, 999);
      if (ui.minutes) ui.minutes.value = number(ui.minutes.value, 0, 59);
      if (ui.seconds) ui.seconds.value = number(ui.seconds.value, 0, 59);
    }
    cancelAnimationFrame(clock.raf);
    clock.totalMs = seconds * 1000;
    clock.remainingMs = clock.totalMs;
    clock.mode = 'ready'; lastWholeSecond = -1;
    if (ui.video) ui.video.pause();
    renderClock(); renderProgress(); syncMedia(true);
    setStatus(seconds ? 'A punt per començar' : 'Tria una durada superior a zero');
    if (ui.start) ui.start.disabled = seconds === 0;
    if (ui.pause) ui.pause.disabled = true;
    updateMarkControls();
    updateQuickButtons();
    saveSettings();
  }
  function start() {
    if (configuredSeconds() <= 0 || clock.mode === 'running') return;
    // Reconcile fields even if a browser commits a number input only on blur.
    if (clock.mode === 'ready' && clock.totalMs !== configuredSeconds() * 1000) setDurationFromFields();
    if (clock.mode === 'finished') {
      clock.remainingMs = clock.totalMs;
      lastWholeSecond = -1;
      syncMedia(true);
    }
    clock.mode = 'running';
    clock.deadline = performance.now() + clock.remainingMs;
    prepareSound();
    if (ui.start) ui.start.disabled = true;
    if (ui.pause) { ui.pause.disabled = false; ui.pause.textContent = 'Pausa'; }
    updateMarkControls();
    setStatus('Compte enrere en marxa');
    syncMedia(true);
    clock.raf = requestAnimationFrame(frame);
  }
  function pauseOrResume() {
    if (clock.mode === 'running') {
      clock.remainingMs = Math.max(0, clock.deadline - performance.now());
      clock.mode = 'paused';
      cancelAnimationFrame(clock.raf);
      if (ui.video) ui.video.pause();
      if (ui.pause) ui.pause.textContent = 'Continua';
      if (ui.start) ui.start.disabled = false;
      updateMarkControls();
      renderClock(); renderProgress(); syncMedia(true);
      setStatus('Compte enrere en pausa');
    } else if (clock.mode === 'paused') start();
  }
  function reset() { setDurationFromFields(); }

  function createOption(value, label) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; return option;
  }
  function applyBackground(key) {
    const item = media.items.get(key);
    media.selected = item || null;
    media.kind = item?.kind || 'none';
    media.lastSeekAt = -Infinity;
    if (ui.video) { ui.video.pause(); ui.video.hidden = true; ui.video.removeAttribute('src'); ui.video.load(); }
    if (ui.image) { ui.image.hidden = true; ui.image.removeAttribute('src'); ui.image.dataset.currentSrc = ''; }
    if (media.kind === 'video' && ui.video) {
      media.videoDuration = item.duration || 180;
      ui.video.src = item.src;
      ui.video.muted = true; ui.video.loop = false; ui.video.playsInline = true;
      if (item.poster) ui.video.poster = item.poster;
      ui.video.hidden = false;
      ui.video.load();
    } else if (media.kind === 'sequence' && ui.image) {
      ui.image.hidden = false;
      syncSequence();
    }
    if (ui.stage) ui.stage.dataset.media = media.kind;
    saveSettings();
  }
  async function loadMedia() {
    try {
      const response = await fetch('assets/media/manifest.json', { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const manifest = await response.json();
      for (const v of manifest.videos || []) media.items.set(v.id, { ...v, kind: 'video' });
      for (const s of manifest.sequences || []) media.items.set(s.id, { ...s, kind: 'sequence' });
      if (ui.background) {
        const previous = ui.background.value;
        for (const item of media.items.values()) {
          if (![...ui.background.options].some(o => o.value === item.id)) ui.background.add(createOption(item.id, item.label));
        }
        const desired = media.items.has(preferredBackground) ? preferredBackground : media.items.has(previous) ? previous : 'none';
        ui.background.value = desired;
        applyBackground(desired);
      }
    } catch (error) {
      console.warn('No s’han pogut carregar els fons inclosos:', error);
      setStatus('El rellotge funciona; els fons inclosos no estan disponibles.');
    }
  }
  async function loadClockPack() {
    try {
      const response = await fetch('assets/clock/positions.json', { cache: 'force-cache' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const packed = await response.json();
      if (packed.hour?.length !== 720 || packed.minute?.length !== 60 || packed.second?.length !== 60)
        throw new Error('Incomplete hand positions');
      handPack.hour = packed.hour; handPack.minute = packed.minute; handPack.second = packed.second;
    } catch (error) {
      console.warn('Using individual clock images:', error);
    } finally {
      clockPackPending = false;
      lastWholeSecond = -1;
      renderClock();
      for (let i = 0; i < 60; i++) { const image = new Image(); image.src = paths.second(i); }
    }
  }
  function clearCustomUrls() {
    for (const url of media.customUrls) URL.revokeObjectURL(url);
    media.customUrls = [];
    media.items.delete('custom');
  }
  function useCustomFiles(files) {
    const list = [...files];
    if (!list.length) return;
    clearCustomUrls();
    const videos = list.filter(file => file.type.startsWith('video/'));
    const images = list.filter(file => file.type.startsWith('image/'))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    let item;
    if (videos.length) {
      const src = URL.createObjectURL(videos[0]); media.customUrls.push(src);
      item = { id: 'custom', label: `El meu vídeo · ${videos[0].name}`, kind: 'video', src, duration: 180 };
    } else if (images.length) {
      const frames = images.map(file => { const url = URL.createObjectURL(file); media.customUrls.push(url); return url; });
      item = { id: 'custom', label: `Les meves imatges · ${images.length}`, kind: 'sequence', frames };
    }
    if (!item) { setStatus('Tria un vídeo o imatges compatibles'); return; }
    media.items.set('custom', item);
    if (ui.background) {
      const old = [...ui.background.options].find(o => o.value === 'custom'); if (old) old.remove();
      ui.background.add(createOption('custom', item.label)); ui.background.value = 'custom';
    }
    applyBackground('custom');
    setStatus('Fons personalitzat carregat');
  }

  function applyTitle() {
    const title = ui.title?.value.trim() || '';
    if (ui.titleOnPhoto) { ui.titleOnPhoto.textContent = title; ui.titleOnPhoto.hidden = !title; }
    if (ui.panelTitle) ui.panelTitle.textContent = title || 'TEMPUS';
    saveSettings();
  }
  function applyOpacity() {
    const value = Math.max(0, Math.min(100, Number(ui.opacity?.value) || 0));
    if (ui.stage) ui.stage.style.setProperty('--clock-opacity', String(value / 100));
    if (ui.opacityValue) ui.opacityValue.textContent = `${Math.round(value)} %`;
    saveSettings();
  }
  function applySkin(value) {
    const skin = value || 'editorial';
    document.body.dataset.skin = skin;
    if (ui.skin) ui.skin.value = skin;
    saveSettings();
  }
  function applyView(value) {
    const view = value === 'projection' ? 'projection' : 'desk';
    document.body.dataset.view = view;
    if (ui.view) ui.view.value = view;
    saveSettings();
  }
  function applyPreset() {
    const option = ui.preset?.selectedOptions?.[0];
    if (!option || !option.value) return;
    const seconds = Number(option.dataset.seconds || option.dataset.duration || 0);
    if (seconds > 0) {
      if (ui.hours) ui.hours.value = Math.floor(seconds / 3600);
      if (ui.minutes) ui.minutes.value = Math.floor(seconds / 60) % 60;
      if (ui.seconds) ui.seconds.value = seconds % 60;
      setDurationFromFields();
    }
    if (option.dataset.background && ui.background) {
      ui.background.value = option.dataset.background;
      applyBackground(ui.background.value);
    }
    if (option.dataset.skin) applySkin(option.dataset.skin);
    if (option.dataset.title && ui.title) { ui.title.value = option.dataset.title; applyTitle(); }
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) { document.exitFullscreen?.(); return; }
    if (document.body.classList.contains('focus-mode')) { document.body.classList.remove('focus-mode'); return; }
    if (ui.stage?.requestFullscreen) {
      ui.stage.requestFullscreen().catch(() => document.body.classList.add('focus-mode'));
    } else document.body.classList.add('focus-mode');
  }
  function updateMarkControls() {
    if (ui.addMark) ui.addMark.disabled = clock.mode !== 'running';
    if (ui.exportMarks) ui.exportMarks.disabled = marks.length === 0;
    if (ui.clearMarks) ui.clearMarks.disabled = marks.length === 0;
  }
  function updateQuickButtons() {
    const seconds = configuredSeconds();
    document.querySelectorAll('[data-quick-minutes]').forEach(button => {
      button.setAttribute('aria-pressed', String(seconds === Number(button.dataset.quickMinutes) * 60));
    });
  }
  function orderedMarks() {
    const copy = marks.slice();
    if (ui.ranking?.checked) copy.sort((a, b) => a.elapsedMs - b.elapsedMs || a.order - b.order);
    return copy;
  }
  function renderMarks() {
    if (!ui.marksList) return;
    if (ui.marksCount) ui.marksCount.textContent = String(marks.length);
    ui.marksList.replaceChildren();
    for (const [index, mark] of orderedMarks().entries()) {
      const row = document.createElement('li');
      row.className = 'mark-row';
      const position = document.createElement('span');
      position.className = 'mark-position'; position.textContent = `${index + 1}.`;
      const name = document.createElement('span');
      name.className = 'mark-student'; name.textContent = mark.name;
      const time = document.createElement('time');
      time.className = 'mark-time'; time.textContent = formattedPrecise(mark.elapsedMs);
      time.setAttribute('aria-label', `Temps transcorregut ${formattedPrecise(mark.elapsedMs)}`);
      row.append(position, name, time); ui.marksList.append(row);
    }
    updateMarkControls();
  }
  function addMark() {
    if (clock.mode !== 'running') return;
    const remainingMs = Math.max(0, clock.deadline - performance.now());
    const name = (ui.markName?.value || '').trim().slice(0, 80) || `Alumne ${marks.length + 1}`;
    marks.push({ name, elapsedMs: clock.totalMs - remainingMs, remainingMs,
      durationMs: clock.totalMs, order: marks.length + 1 });
    if (ui.markName) { ui.markName.value = ''; ui.markName.focus(); }
    renderMarks();
    setStatus(`Marca guardada per a ${name}`);
  }
  function exportMarks() {
    if (!marks.length) return;
    const safeCell = (value) => {
      let text = String(value);
      if (/^[=+\-@]/.test(text)) text = `'${text}`;
      return `"${text.replaceAll('"', '""')}"`;
    };
    const rows = [['Posició', 'Nom', 'Temps transcorregut', 'Temps restant', 'Durada']];
    orderedMarks().forEach((mark, index) => rows.push([
      index + 1, mark.name, formattedPrecise(mark.elapsedMs),
      formattedPrecise(mark.remainingMs), formatted(Math.ceil(mark.durationMs / 1000))
    ]));
    const csv = '\ufeff' + rows.map(row => row.map(safeCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `tempus-marques-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  function clearMarks() {
    if (!marks.length) return;
    if (!window.confirm('Vols esborrar totes les marques d’aquesta sessió? Desa el CSV abans si les vols conservar.')) return;
    marks.length = 0; renderMarks(); setStatus('Marques esborrades');
  }
  function prepareSound() {
    if (!ui.sound?.checked) return;
    try { audioContext ||= new (window.AudioContext || window.webkitAudioContext)(); audioContext.resume(); } catch (_) { /* visual alarm remains */ }
  }
  function ring() {
    if (!ui.sound?.checked || !audioContext) return;
    const at = audioContext.currentTime;
    [0, 0.22].forEach((offset, index) => {
      const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
      oscillator.type = 'sine'; oscillator.frequency.value = index ? 660 : 523.25;
      gain.gain.setValueAtTime(0, at + offset);
      gain.gain.linearRampToValueAtTime(0.12, at + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + offset + 0.5);
      oscillator.connect(gain).connect(audioContext.destination);
      oscillator.start(at + offset); oscillator.stop(at + offset + 0.52);
    });
  }
  function readSettings() {
    try { return JSON.parse(localStorage.getItem('temps-en-capes-v1') || '{}'); } catch (_) { return {}; }
  }
  function saveSettings() {
    try {
      localStorage.setItem('temps-en-capes-v1', JSON.stringify({
        title: ui.title?.value || '', hours: ui.hours?.value || '0', minutes: ui.minutes?.value || '3',
        seconds: ui.seconds?.value || '0', background: ui.background?.value || 'none',
        opacity: ui.opacity?.value || '100', skin: ui.skin?.value || 'editorial',
        view: ui.view?.value || 'desk', sound: !!ui.sound?.checked
      }));
    } catch (_) { /* private browsing may block storage */ }
  }
  function restoreSettings() {
    const saved = readSettings();
    preferredBackground = saved.background || ui.background?.dataset.default || 'polaroids';
    if (ui.title && typeof saved.title === 'string') ui.title.value = saved.title;
    if (ui.hours && saved.hours != null) ui.hours.value = saved.hours;
    if (ui.minutes && saved.minutes != null) ui.minutes.value = saved.minutes;
    if (ui.seconds && saved.seconds != null) ui.seconds.value = saved.seconds;
    if (ui.opacity && saved.opacity != null) ui.opacity.value = saved.opacity;
    if (ui.sound && saved.sound != null) ui.sound.checked = saved.sound;
    if (ui.skin && saved.skin) ui.skin.value = saved.skin;
    if (ui.view && saved.view) ui.view.value = saved.view;
    applyTitle(); applyOpacity(); applySkin(ui.skin?.value || 'editorial'); applyView(ui.view?.value || 'desk');
    setDurationFromFields();
  }
  function init() {
    if (!ui.stage || !ui.remaining || !ui.start) return;
    if (ui.paper) ui.paper.src = 'assets/clock/paper.svg';
    if (ui.dial) ui.dial.src = paths.dial;
    if (ui.pin) ui.pin.src = 'assets/clock/pin.svg';
    loadClockPack();
    if (ui.video) {
      ui.video.muted = true;
      ui.video.addEventListener('loadedmetadata', () => {
        if (media.kind === 'video') {
          media.videoDuration = ui.video.duration || media.selected?.duration || 180;
          syncVideo(true);
        }
      });
    }
    restoreSettings();
    loadMedia();
    ui.start.addEventListener('click', start);
    byId('timer-form')?.addEventListener('submit', event => event.preventDefault());
    ui.pause?.addEventListener('click', pauseOrResume);
    ui.reset?.addEventListener('click', reset);
    [ui.hours, ui.minutes, ui.seconds].forEach(el => {
      el?.addEventListener('input', () => { if (ui.preset) ui.preset.value = 'custom'; setDurationFromFields(false); });
      el?.addEventListener('change', () => setDurationFromFields(true));
    });
    ui.title?.addEventListener('input', applyTitle);
    ui.opacity?.addEventListener('input', applyOpacity);
    ui.skin?.addEventListener('change', () => applySkin(ui.skin.value));
    ui.view?.addEventListener('change', () => applyView(ui.view.value));
    ui.preset?.addEventListener('change', applyPreset);
    ui.background?.addEventListener('change', () => {
      if (ui.preset) ui.preset.value = 'custom';
      applyBackground(ui.background.value);
    });
    ui.customMedia?.addEventListener('change', event => useCustomFiles(event.target.files));
    ui.fullscreen?.addEventListener('click', toggleFullscreen);
    ui.exitFullscreen?.addEventListener('click', toggleFullscreen);
    ui.sound?.addEventListener('change', saveSettings);
    document.querySelectorAll('[data-quick-minutes]').forEach(button => button.addEventListener('click', () => {
      const minutes = number(button.dataset.quickMinutes, 1, 999 * 60);
      if (ui.hours) ui.hours.value = Math.floor(minutes / 60);
      if (ui.minutes) ui.minutes.value = minutes % 60;
      if (ui.seconds) ui.seconds.value = 0;
      if (ui.preset) ui.preset.value = 'custom';
      setDurationFromFields();
    }));
    ui.addMark?.addEventListener('click', addMark);
    ui.markName?.addEventListener('keydown', event => {
      if (event.key === 'Enter') { event.preventDefault(); addMark(); }
    });
    ui.ranking?.addEventListener('change', renderMarks);
    ui.exportMarks?.addEventListener('click', exportMarks);
    ui.clearMarks?.addEventListener('click', clearMarks);
    document.addEventListener('fullscreenchange', () => {
      document.body.classList.toggle('focus-mode', !!document.fullscreenElement);
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') document.body.classList.remove('focus-mode');
      if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || '')) return;
      if (event.code === 'Space') { event.preventDefault(); clock.mode === 'running' || clock.mode === 'paused' ? pauseOrResume() : start(); }
      if (event.key.toLowerCase() === 'r') reset();
      if (event.key.toLowerCase() === 'f') toggleFullscreen();
    });
    renderMarks();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();

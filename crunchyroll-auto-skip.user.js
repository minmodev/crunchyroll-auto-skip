// ==UserScript==
// @name         Crunchyroll Auto Skip
// @namespace    crunchyroll-auto-skip
// @version      1.2
// @description  Adds a configurable player companion with toggles for auto skipping Recap, Intro and Credits on Crunchyroll.
// @match        https://www.crunchyroll.com/*
// @match        https://static.crunchyroll.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=crunchyroll.com
// @author       minmodev
// @updateURL    https://raw.githubusercontent.com/minmodev/crunchyroll-auto-skip/main/crunchyroll-auto-skip.user.js
// @downloadURL  https://raw.githubusercontent.com/minmodev/crunchyroll-auto-skip/main/crunchyroll-auto-skip.user.js
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const TAG = '[Auto Skip]';
  const VER = '1.2';

  const SELECTOR = [
    'button[aria-label="Skip Recap"]',
    'button[aria-label="Skip Intro"]',
    'button[aria-label="Skip Credits"]',
  ].join(', ');

  const STORAGE_KEY = 'crAutoSkipSettings';
  const DEFAULTS = { skipRecap: true, skipIntro: true, skipCredits: true, autoPlay: true, maximisePlayer: false };
  let settings = { ...DEFAULTS };
  try {
    settings = { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch (e) {}

  function saveSettings() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch (e) {}
  }

  function settingFor(label) {
    label = label.toLowerCase();
    if (label.includes('recap')) return 'skipRecap';
    if (label.includes('intro')) return 'skipIntro';
    if (label.includes('credits')) return 'skipCredits';
    return null;
  }

  const shadowRoots = new Set();
  const nativeAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function (init) {
    const root = nativeAttachShadow.call(this, { ...init, mode: 'open' });
    shadowRoots.add(root);
    observeRoot(root);
    return root;
  };

  const buttons = new Set();
  const clickedLabel = new WeakMap();
  const lastClickTime = new WeakMap();

  function deepScan() {
    const register = (b) => buttons.add(b);
    document.querySelectorAll(SELECTOR).forEach(register);
    for (const sr of shadowRoots) {
      if (sr.host?.isConnected) sr.querySelectorAll(SELECTOR).forEach(register);
    }
  }

  function isVisible(el) {
    if (el.getAttribute('aria-hidden') === 'true') return false;
    const style = getComputedStyle(el);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) > 0 &&
      style.pointerEvents !== 'none'
    );
  }

  function checkAll() {
    for (const btn of buttons) {
      if (!btn.isConnected) { buttons.delete(btn); continue; }

      if (!isVisible(btn)) {
        clickedLabel.delete(btn);
        continue;
      }

      const label = btn.getAttribute('aria-label') || '';
      if (clickedLabel.get(btn) === label) continue;
      if (Date.now() - (lastClickTime.get(btn) || 0) < 500) continue;

      const key = settingFor(label);
      if (!key || !settings[key]) continue;

      clickedLabel.set(btn, label);
      lastClickTime.set(btn, Date.now());
      console.log(`${TAG} Clicking "${label}"`);
      for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
        btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
      }

      setTimeout(() => { checkAll(); checkAutoPlay(); }, 250);
      setTimeout(() => { checkAll(); checkAutoPlay(); }, 800);
    }
  }

  const trackedVideos = new WeakSet();
  const autoPlayTried = new WeakSet();

  function trackVideo(video) {
    if (trackedVideos.has(video)) return;
    trackedVideos.add(video);
    video.addEventListener('loadstart', () => autoPlayTried.delete(video));
    video.addEventListener('canplay', checkAutoPlay);
  }

  function checkAutoPlay() {
    for (const video of document.querySelectorAll('video')) {
      trackVideo(video);
      if (!settings.autoPlay) continue;
      if (autoPlayTried.has(video)) continue;
      if (video.readyState < 3) continue;
      if (!video.paused || video.ended) continue;
      if (video.played.length > 0) continue;

      autoPlayTried.add(video);
      console.log(`${TAG} AutoPlay: starting playback`);
      attemptPlay(video);
    }
  }

  function onNextGesture(fn) {
    const ctrl = new AbortController();
    const handler = (e) => {
      if (!e.isTrusted) return;
      ctrl.abort();
      fn();
    };
    for (const type of ['pointerdown', 'keydown']) {
      window.addEventListener(type, handler, { capture: true, signal: ctrl.signal });
    }
  }

  function attemptPlay(video) {
    video.play().catch((err) => {
      if (err.name !== 'NotAllowedError') {
        console.log(`${TAG} AutoPlay failed: ${err.name}`);
        return;
      }


      const wasMuted = video.muted;
      video.muted = true;
      video.play().then(() => {
        console.log(`${TAG} AutoPlay: started muted (autoplay policy) — allow autoplay for crunchyroll.com in the site permissions to avoid this.`);
        onNextGesture(() => { video.muted = wasMuted; });
      }).catch(() => {

        video.muted = wasMuted;
        console.log(`${TAG} AutoPlay fully blocked — allow autoplay for crunchyroll.com in the site permissions.`);
        onNextGesture(() => video.play().catch(() => {}));
      });
    });
  }

  const MAX_MARK = 'data-cr-auto-skip-maximised';

  function applyMaximise() {
    const on = settings.maximisePlayer;

    const header = document.querySelector('header');
    const headerParent = header?.parentElement;
    if (headerParent) {
      if (on && !headerParent.hasAttribute(MAX_MARK)) {
        headerParent.setAttribute(MAX_MARK, 'display');
        headerParent.style.setProperty('display', 'none', 'important');
      } else if (!on && headerParent.getAttribute(MAX_MARK) === 'display') {
        headerParent.style.removeProperty('display');
        headerParent.removeAttribute(MAX_MARK);
      }
    }

    const playerContainer = document.querySelector('.player-container');
    if (playerContainer) {
      if (on && !playerContainer.hasAttribute(MAX_MARK)) {
        playerContainer.setAttribute(MAX_MARK, 'height');
        playerContainer.style.setProperty('height', '100vh', 'important');
      } else if (!on && playerContainer.getAttribute(MAX_MARK) === 'height') {
        playerContainer.style.removeProperty('height');
        playerContainer.removeAttribute(MAX_MARK);
      }
    }
  }

  const ACCENT = '#f47521';
  let panel = null;
  let hideTimer = null;

  function buildPanel() {
    panel = document.createElement('div');
    panel.id = 'cr-auto-skip-panel';
    panel.style.cssText = [
      'position: fixed', 'top: 16px', 'right: 16px', 'z-index: 2147483647',
      'background: rgba(20, 20, 24, 0.92)', 'color: #fff',
      'border-radius: 10px', 'padding: 10px 14px',
      'font-family: Lato, "Helvetica Neue", Arial, sans-serif', 'font-size: 13px',
      'display: flex', 'flex-direction: column', 'gap: 8px',
      'opacity: 0', 'pointer-events: none',
      'transition: opacity 0.2s ease-in-out',
      'box-shadow: 0 4px 16px rgba(0,0,0,0.4)',
      'user-select: none',
    ].join(';');

    const rows = [
      ['skipRecap', 'Skip Recap'],
      ['skipIntro', 'Skip Intro'],
      ['skipCredits', 'Skip Credits'],
      ['maximisePlayer', 'Maximise Player'],
      ['autoPlay', 'AutoPlay'],
    ];

    for (const [key, label] of rows) {
      const row = document.createElement('label');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:14px;cursor:pointer;';

      const text = document.createElement('span');
      text.textContent = label;

      const track = document.createElement('span');
      track.style.cssText = 'position:relative;width:34px;height:18px;border-radius:9px;transition:background 0.15s;flex-shrink:0;';
      const knob = document.createElement('span');
      knob.style.cssText = 'position:absolute;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left 0.15s;';
      track.appendChild(knob);

      const paint = () => {
        const on = settings[key];
        track.style.background = on ? ACCENT : '#555';
        knob.style.left = on ? '18px' : '2px';
      };
      paint();

      row.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        settings[key] = !settings[key];
        saveSettings();
        paint();
        if (key === 'maximisePlayer') applyMaximise();
        if (key === 'autoPlay' && settings.autoPlay) checkAutoPlay();
      });

      row.append(text, track);
      panel.appendChild(row);
    }

    document.body.appendChild(panel);

    document.addEventListener('fullscreenchange', () => {
      (document.fullscreenElement || document.body).appendChild(panel);
    });
  }

  function showPanel() {
    if (!panel || !document.querySelector('video')) return;
    panel.style.opacity = '1';
    panel.style.pointerEvents = 'auto';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hidePanel, 3000);
  }

  function hidePanel() {
    if (!panel) return;
    if (panel.matches(':hover')) {
      hideTimer = setTimeout(hidePanel, 1000);
      return;
    }
    panel.style.opacity = '0';
    panel.style.pointerEvents = 'none';
  }

  let scheduled = false;
  function schedule() {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(() => { scheduled = false; checkAll(); });
    }
  }

  function observeRoot(root) {
    new MutationObserver(() => {
      if (buttons.size > 0) schedule();
    }).observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['class', 'aria-hidden', 'style', 'aria-label'],
    });
  }

  function start() {
    console.log(`${TAG} v${VER} running in ${window === window.top ? 'TOP page' : 'IFRAME'}: ${location.href}`);
    buildPanel();
    observeRoot(document.documentElement);
    deepScan();

    document.addEventListener('mousemove', showPanel, { passive: true });
    document.addEventListener('touchstart', showPanel, { passive: true });

    setInterval(() => {
      deepScan();
      checkAll();
      checkAutoPlay();
      applyMaximise();
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
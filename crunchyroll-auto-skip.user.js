// ==UserScript==
// @name         Crunchyroll Auto Skip
// @namespace    crunchyroll-auto-skip
// @version      1.0
// @description  Automatically clicks the Skip Recap / Skip Credits / Skip Intro buttons the moment they become visible
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

  const SELECTOR =
    'button[aria-label="Skip Recap"], button[aria-label="Skip Credits"], button[aria-label="Skip Intro"]';

  const lastClicked = new WeakMap();
  const CLICK_COOLDOWN_MS = 5000;

  function isVisible(btn) {
    if (btn.getAttribute('aria-hidden') === 'true') return false;
    if (btn.tabIndex === -1 && btn.getAttribute('aria-hidden') !== 'false') return false;

    const style = getComputedStyle(btn);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    if (parseFloat(style.opacity) === 0) return false;
    if (style.pointerEvents === 'none') return false;

    return true;
  }

  function tryClick() {
    for (const btn of document.querySelectorAll(SELECTOR)) {
      if (!isVisible(btn)) continue;

      const last = lastClicked.get(btn) || 0;
      if (Date.now() - last < CLICK_COOLDOWN_MS) continue;

      lastClicked.set(btn, Date.now());
      btn.click();
      console.log(`[Auto Skip] Clicked "${btn.getAttribute('aria-label')}"`);
    }
  }

  const observer = new MutationObserver(tryClick);
  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class', 'aria-hidden', 'style'],
  });

  setInterval(tryClick, 500);
})();
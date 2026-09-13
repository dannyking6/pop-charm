/* game-driver.js - neutral offline driver (Pop Charm build).
 * Replaces the Poki SDK surface this game calls. No network, no ads.
 * Loaded FIRST in <head>, before any game script. */
(function () {
  'use strict';
  function noop() {}
  function ok(v) { return Promise.resolve(v); }

  var PokiSDK = {
    init: function () { return ok(); },
    setDebug: noop,
    gameLoadingStart: noop,
    gameLoadingProgress: noop,
    gameLoadingFinished: noop,
    gameplayStart: noop,
    gameplayStop: noop,
    happyTime: noop,
    commercialBreak: function () { return ok(); },
    rewardedBreak: function () { return ok(false); },
    captureError: noop,
    shareableURL: function () { return ok(''); },
    getURLParam: function () { return null; },
    log: { event: noop }
  };
  window.PokiSDK = PokiSDK;
  window.__flagPokiInitialized = true;
})();

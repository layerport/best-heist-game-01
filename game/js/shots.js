// shots.js — screenshot staging for The Midnight Vault.
// The game is fully playable with no query string. Adding ?shot=<name> puts
// it in a fixed, frozen pose so a screenshot shows a chosen moment:
//   title | cover | approach | cone-close | loot-getaway | win
// The pose is deterministic: guards, alarm and loot are set exactly, and
// the simulation is frozen, so the same URL always renders the same frame.

(function stageHeistFromUrl() {
  function applyShotFromUrl() {
    if (!window.HeistGame) return;
    const params = new URLSearchParams(window.location.search);
    const shot = params.get('shot');
    if (shot) window.HeistGame.stage(shot);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyShotFromUrl);
  } else {
    applyShotFromUrl();
  }
})();

// Expose the staging call for Playwright or a curious player: run
//   HeistGame.stage('cone-close')
// in the console to jump to that moment. The game keeps working afterwards
// with HeistGame.unfreeze() — or just reload the page for a fresh run.

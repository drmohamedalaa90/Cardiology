(() => {
  /*
   * Artwork is now rendered directly by modules-live-core-20260820.js.
   * This file intentionally does NOT observe or rewrite the module grid.
   * The old MutationObserver could repeatedly mutate cards on iOS Safari/PWA
   * and block the main thread while the catalogue was loading.
   */
  const style = document.createElement('style');
  style.textContent = `
    .acl-command-module-grid .module-card .forced-module-logo{
      position:absolute!important;left:12px!important;top:50%!important;
      transform:translateY(-50%)!important;width:45px!important;height:45px!important;
      display:block!important;object-fit:contain!important;object-position:center!important;
      border-radius:50%!important;background:#fff!important;
      box-shadow:0 2px 7px rgba(70,80,100,.14)!important;z-index:4!important
    }
    .acl-command-module-grid .module-card .forced-module-logo[src*="echo-module-logo"]{
      border-radius:12px!important;background:transparent!important
    }
    .acl-command-module-grid .module-card .forced-module-logo[src*="esc-guideline-mark"]{
      background:#fff4f4!important;padding:2px!important
    }
    @media(max-width:820px){
      .acl-command-module-grid .module-card .forced-module-logo{width:42px!important;height:42px!important}
    }
  `;
  document.head.appendChild(style);
})();
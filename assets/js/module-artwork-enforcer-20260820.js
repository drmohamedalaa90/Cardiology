(() => {
  const INTERVENTION_RX = /\b(CTO|TAVI|MITRAL|TRICUSPID|PCI|INTERVENTION|INTERVENTIONS|LEFT MAIN|BIFURCATION|CORONARY INTERVENTION)\b/i;
  const ECG_RX = /\bECG\b/i;
  const ECHO_RX = /\b(ECHO|ECHOCARDIOGRAPHY|TTE|TEE|DOPPLER)\b/i;
  const MENTAL_HEALTH_RX = /\b(MENTAL HEALTH|MENTAL WELLBEING|MENTAL WELLNESS|MENTAL HEALTHY)\b/i;

  if (!document.querySelector('link[data-acl-universal-drawer]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.dataset.aclUniversalDrawer = 'true';
    link.href = 'assets/css/acl-universal-drawer-20260820.css?v=3';
    document.head.appendChild(link);
  }
  import('./acl-universal-drawer-20260820.js?v=3').catch(error=>console.warn('ACL universal drawer',error));

  function setLogo(card, src, alt, kind) {
    card.classList.remove('module-imaging','module-ecg','module-intervention');
    if (kind === 'intervention') card.classList.add('module-intervention');
    if (kind === 'ecg') card.classList.add('module-ecg');
    if (kind === 'echo') card.classList.add('module-imaging');
    if (kind === 'esc') card.classList.add('is-esc-guideline');
    const body = card.querySelector('.module-card-body');
    if (!body) return;
    body.classList.add('forced-module-logo-body');
    let img = body.querySelector(':scope > img.forced-module-logo');
    if (!img) { img = document.createElement('img'); img.className = 'forced-module-logo'; body.prepend(img); }
    img.src = src; img.alt = alt;
  }

  function applyArtwork() {
    document.querySelectorAll('.acl-command-module-grid .module-card').forEach(card => {
      const title = (card.querySelector('h2')?.textContent || '').trim();
      if (!title) return;
      if (MENTAL_HEALTH_RX.test(title)) setLogo(card, 'assets/images/esc-guideline-mark.svg?v=3', 'ESC guideline', 'esc');
      else if (INTERVENTION_RX.test(title)) setLogo(card, 'assets/images/coronary-anatomy-module.svg?v=3', 'Intervention', 'intervention');
      else if (ECG_RX.test(title)) setLogo(card, 'assets/images/ecg-module-logo.svg?v=3', 'ECG', 'ecg');
      else if (ECHO_RX.test(title)) setLogo(card, 'assets/images/echo-module-logo.svg?v=3', 'Echocardiography', 'echo');
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .acl-command-module-grid .module-card .module-card-body.forced-module-logo-body::before{display:none!important;content:none!important}
    .acl-command-module-grid .module-card .forced-module-logo{position:absolute!important;left:12px!important;top:50%!important;transform:translateY(-50%)!important;width:45px!important;height:45px!important;display:block!important;object-fit:contain!important;object-position:center!important;border-radius:50%!important;background:#fff!important;box-shadow:0 2px 7px rgba(70,80,100,.14)!important;z-index:4!important}
    .acl-command-module-grid .module-card .forced-module-logo[src*="echo-module-logo"]{border-radius:12px!important;padding:0!important;background:transparent!important}
    .acl-command-module-grid .module-card .forced-module-logo[src*="esc-guideline-mark"]{border-radius:50%!important;background:#fff4f4!important;padding:2px!important}
    @media(max-width:820px){.acl-command-module-grid .module-card .forced-module-logo{width:42px!important;height:42px!important}}
  `;
  document.head.appendChild(style);

  applyArtwork();
  const host = document.getElementById('modules');
  if (host) new MutationObserver(applyArtwork).observe(host, { childList:true, subtree:true });
  document.addEventListener('DOMContentLoaded', applyArtwork);
  window.addEventListener('load', applyArtwork);
})();
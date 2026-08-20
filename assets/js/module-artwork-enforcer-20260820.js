(() => {
  const INTERVENTION_RX = /\b(CTO|TAVI|MITRAL|TRICUSPID|PCI|INTERVENTION|INTERVENTIONS|LEFT MAIN|BIFURCATION|CORONARY INTERVENTION)\b/i;
  const ECG_RX = /\bECG\b/i;

  function applyArtwork() {
    document.querySelectorAll('.acl-command-module-grid .module-card').forEach(card => {
      const title = (card.querySelector('h2')?.textContent || '').trim();
      if (!title) return;

      if (INTERVENTION_RX.test(title)) {
        card.classList.add('module-intervention');
        card.classList.remove('module-imaging','module-ecg');
        const body = card.querySelector('.module-card-body');
        if (body) {
          body.style.setProperty('--forced-module-art', 'url("../images/coronary-anatomy-module.svg")');
          body.classList.add('forced-intervention-art');
        }
      } else if (ECG_RX.test(title)) {
        card.classList.add('module-ecg');
        card.classList.remove('module-imaging','module-intervention');
        const body = card.querySelector('.module-card-body');
        if (body) {
          body.style.setProperty('--forced-module-art', 'url("../images/ecg-module-logo.svg")');
          body.classList.add('forced-ecg-art');
        }
      }
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .acl-command-module-grid .module-card .module-card-body.forced-intervention-art::before,
    .acl-command-module-grid .module-card .module-card-body.forced-ecg-art::before{
      content:""!important;
      display:grid!important;
      background-color:#fff!important;
      background-image:var(--forced-module-art)!important;
      background-position:center!important;
      background-size:contain!important;
      background-repeat:no-repeat!important;
      color:transparent!important;
      border-radius:50%!important;
      box-shadow:0 2px 7px rgba(70,80,100,.14)!important;
    }
  `;
  document.head.appendChild(style);

  applyArtwork();
  const host = document.getElementById('modules');
  if (host) new MutationObserver(applyArtwork).observe(host, { childList:true, subtree:true });
  document.addEventListener('DOMContentLoaded', applyArtwork);
  window.addEventListener('load', applyArtwork);
})();

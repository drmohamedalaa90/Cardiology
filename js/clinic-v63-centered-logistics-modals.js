(() => {
  const style = document.createElement("style");
  style.textContent = `
    /* V80 consolidated modal styling: centered, compact, stable, no horizontal ruler. */
    #modalRoot:not(.hidden){
      position:fixed!important;
      inset:0!important;
      z-index:99999!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      padding:16px!important;
      overflow:hidden!important;
      background:transparent!important;
      box-sizing:border-box!important;
    }

    #modalRoot .modal-backdrop{
      position:fixed!important;
      inset:0!important;
      width:100vw!important;
      height:100vh!important;
      display:flex!important;
      align-items:center!important;
      justify-content:center!important;
      padding:16px!important;
      overflow:hidden!important;
      background:rgba(10,24,40,.46)!important;
      backdrop-filter:blur(4px)!important;
      box-sizing:border-box!important;
    }

    #modalRoot .modal-card{
      position:relative!important;
      inset:auto!important;
      transform:none!important;
      margin:auto!important;
      box-sizing:border-box!important;
      overflow-x:hidden!important;
      scrollbar-width:none!important;
      -ms-overflow-style:none!important;
    }
    #modalRoot .modal-card::-webkit-scrollbar{width:0!important;height:0!important;display:none!important}

    /* Critical Logistics popup */
    #modalRoot .v62-critical-modal{
      width:min(470px,calc(100vw - 28px))!important;
      max-width:470px!important;
      max-height:none!important;
      height:auto!important;
      overflow:hidden!important;
      padding:14px!important;
      border-radius:18px!important;
      box-shadow:0 24px 70px rgba(8,24,40,.28)!important;
    }
    #modalRoot .v62-critical-modal .v62-alarm-icon{font-size:32px!important;line-height:1!important;margin:0 0 4px!important}
    #modalRoot .v62-critical-modal h2{font-size:21px!important;line-height:1.2!important;margin:4px 0 5px!important}
    #modalRoot .v62-critical-modal>p{font-size:12px!important;line-height:1.35!important;margin:0 0 10px!important}
    #modalRoot .v62-critical-list{width:100%!important;display:grid!important;gap:6px!important;margin:8px 0 10px!important;overflow:hidden!important}
    #modalRoot .v62-critical-row{
      width:100%!important;
      min-width:0!important;
      display:grid!important;
      grid-template-columns:40px minmax(0,1fr) auto!important;
      align-items:center!important;
      gap:8px!important;
      padding:7px 8px!important;
      overflow:hidden!important;
      box-sizing:border-box!important;
    }
    #modalRoot .v62-critical-row img,
    #modalRoot .v62-critical-row .v62-mini-placeholder{
      width:40px!important;height:40px!important;min-width:40px!important;border-radius:8px!important;object-fit:cover!important;
    }
    #modalRoot .v62-critical-row>div:nth-child(2){min-width:0!important;padding-inline-start:6px!important}
    #modalRoot .v62-critical-row strong,
    #modalRoot .v62-critical-row small{white-space:normal!important;overflow-wrap:anywhere!important;word-break:break-word!important}
    #modalRoot .v62-critical-row .primary-button{width:auto!important;min-width:68px!important;padding:7px 10px!important;font-size:11px!important;white-space:nowrap!important}

    /* Add/Edit + Bought + Electricity dialogs */
    #modalRoot .v62-modal,
    #modalRoot .v61-modal,
    #modalRoot .v60-modal{
      width:min(520px,calc(100vw - 28px))!important;
      max-width:520px!important;
      max-height:calc(100vh - 28px)!important;
      overflow-y:auto!important;
      overflow-x:hidden!important;
      padding:14px!important;
      border-radius:18px!important;
      box-shadow:0 24px 70px rgba(8,24,40,.28)!important;
    }
    #modalRoot .v62-modal .modal-header,
    #modalRoot .v61-modal .modal-header,
    #modalRoot .v60-modal .modal-header{margin:0 0 8px!important;padding:0 0 8px!important;min-height:auto!important}
    #modalRoot .v62-modal .modal-header h3,
    #modalRoot .v61-modal .modal-header h3,
    #modalRoot .v60-modal .modal-header h3{font-size:20px!important;margin:2px 0 0!important}
    #modalRoot .v62-form,
    #modalRoot .v61-form,
    #modalRoot .v60-form{gap:9px!important}
    #modalRoot .v62-form label,
    #modalRoot .v61-form label,
    #modalRoot .v60-form label{gap:4px!important;margin:0!important;font-size:13px!important}
    #modalRoot .v62-form .control,
    #modalRoot .v61-form .control,
    #modalRoot .v60-form .control{min-height:42px!important;height:42px!important;padding:8px 12px!important;border-radius:11px!important;font-size:14px!important;margin:0!important}
    #modalRoot .v62-edit-preview,
    #modalRoot .v61-edit-preview,
    #modalRoot .v60-edit-preview{width:105px!important;height:105px!important;object-fit:cover!important;border-radius:11px!important;margin:2px 0 4px!important}
    #modalRoot .v62-form-grid,
    #modalRoot .v61-form-grid{gap:8px!important}

    .notification-header-actions{display:flex;align-items:center;gap:8px;margin-inline-start:auto}
    .notification-mark-all-button{
      border:0;background:#eafaf6;color:#0f8b78;font-weight:800;font-size:12px;
      cursor:pointer;padding:7px 10px;border-radius:9px;white-space:nowrap
    }
    .notification-mark-all-button:disabled{opacity:.55;cursor:default}

    @media(max-width:520px){
      #modalRoot:not(.hidden),#modalRoot .modal-backdrop{padding:8px!important}
      #modalRoot .v62-critical-modal,
      #modalRoot .v62-modal,
      #modalRoot .v61-modal,
      #modalRoot .v60-modal{width:calc(100vw - 16px)!important;max-width:calc(100vw - 16px)!important}
      #modalRoot .v62-critical-row{grid-template-columns:36px minmax(0,1fr) auto!important;gap:6px!important}
      #modalRoot .v62-critical-row img,
      #modalRoot .v62-critical-row .v62-mini-placeholder{width:36px!important;height:36px!important;min-width:36px!important}
    }
  `;
  document.head.appendChild(style);
})();
import { protectAndRender } from "./session-ui.js?v=5.0.0";

const VALID_EDITIONS = new Set(["basic", "expert"]);
const EDITION_STORAGE_KEY = "aclSelectedEdition";
const byId = id => document.getElementById(id);
const normalizeEdition = value => {
  const edition = String(value || "").trim().toLowerCase();
  return VALID_EDITIONS.has(edition) ? edition : "";
};

function rememberChoiceEnabled(){ return Boolean(byId("rememberEditionChoice")?.checked); }
function setPreferenceStatus(message){ const el=byId("editionPreferenceStatus"); if(el) el.textContent=message; }
function readRememberedEdition(){ try{return normalizeEdition(localStorage.getItem(EDITION_STORAGE_KEY));}catch{return "";} }
function saveRememberedEdition(edition){ try{localStorage.setItem(EDITION_STORAGE_KEY,edition);return true;}catch{return false;} }
function clearRememberedEdition(){ try{localStorage.removeItem(EDITION_STORAGE_KEY);}catch{} }
function saveSessionEdition(edition){ try{sessionStorage.setItem(EDITION_STORAGE_KEY,edition);return true;}catch{return false;} }
function readSessionEdition(){ try{return normalizeEdition(sessionStorage.getItem(EDITION_STORAGE_KEY));}catch{return "";} }

function initializePreferenceControl(){
  const checkbox=byId("rememberEditionChoice"); if(!checkbox)return;
  const remembered=readRememberedEdition(); checkbox.checked=Boolean(remembered);
  setPreferenceStatus(remembered?`Your ${remembered} edition choice is remembered on this device.`:"Your choice has not been saved permanently.");
  checkbox.addEventListener("change",()=>{
    if(!checkbox.checked){clearRememberedEdition();setPreferenceStatus("Your choice will only remain active for this browser session.");return;}
    const active=readSessionEdition();
    if(active){saveRememberedEdition(active);setPreferenceStatus(`Your ${active} edition choice is now remembered on this device.`);}
    else setPreferenceStatus("Choose Basic or Expert Edition to save your preference.");
  });
}

/* Fail-safe navigation: cards are real anchors and NEVER depend on JS to enter the app. */
function bindPathwayControls(){
  document.querySelectorAll("a[data-edition]").forEach(card=>{
    const edition=normalizeEdition(card.dataset.edition); if(!edition)return;
    card.classList.remove("pathway-disabled"); card.setAttribute("aria-disabled","false");
    card.href=`modules.html?edition=${encodeURIComponent(edition)}`;
    if(card.dataset.aclPathwayBound==="true")return;
    card.dataset.aclPathwayBound="true";
    card.addEventListener("click",()=>{
      saveSessionEdition(edition);
      if(rememberChoiceEnabled()) saveRememberedEdition(edition); else clearRememberedEdition();
      /* Do not preventDefault: native anchor navigation is the safety path. */
    });
  });
}

async function initializePathways(){
  /* Bind first, before auth/profile calls, so entry buttons can never be stranded disabled. */
  initializePreferenceControl();
  bindPathwayControls();
  document.body.classList.add("pathways-ready");

  try{
    const profile=await protectAndRender("login.html");
    if(!profile)return;
    /* Re-bind in case any DOM was refreshed by shared session UI. */
    bindPathwayControls();
  }catch(error){
    console.error("ACL PATHWAYS INITIALIZATION ERROR:",error);
    /* Keep native edition links working even if profile enrichment fails. */
  }
}

if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",()=>void initializePathways(),{once:true});
else void initializePathways();

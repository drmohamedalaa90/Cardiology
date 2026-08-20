import { supabaseClient } from "./supabase-client.js";

console.log("ACL PATHWAYS FAIL-SAFE v3.1.0 LOADED");

const VALID_EDITIONS = new Set(["basic", "expert"]);
const EDITION_STORAGE_KEY = "aclSelectedEdition";

function normalizeEdition(value) {
  const edition = String(value || "").trim().toLowerCase();
  return VALID_EDITIONS.has(edition) ? edition : "";
}

function rememberChoiceEnabled() {
  return Boolean(document.getElementById("rememberEditionChoice")?.checked);
}

function saveEdition(edition) {
  const normalized = normalizeEdition(edition);
  if (!normalized) return;
  try { sessionStorage.setItem(EDITION_STORAGE_KEY, normalized); } catch {}
  try {
    if (rememberChoiceEnabled()) localStorage.setItem(EDITION_STORAGE_KEY, normalized);
    else localStorage.removeItem(EDITION_STORAGE_KEY);
  } catch {}
}

function initializePreferenceControl() {
  const checkbox = document.getElementById("rememberEditionChoice");
  const status = document.getElementById("editionPreferenceStatus");
  if (!checkbox) return;

  let remembered = "";
  try { remembered = normalizeEdition(localStorage.getItem(EDITION_STORAGE_KEY)); } catch {}
  checkbox.checked = Boolean(remembered);

  const updateStatus = () => {
    if (!status) return;
    status.textContent = checkbox.checked
      ? "Your edition choice will be remembered on this device."
      : "Your choice will remain active only for this browser session.";
  };
  updateStatus();

  checkbox.addEventListener("change", () => {
    if (!checkbox.checked) {
      try { localStorage.removeItem(EDITION_STORAGE_KEY); } catch {}
    }
    updateStatus();
  });
}

function makeCardsFailSafe() {
  document.querySelectorAll("a.pathway-card[data-edition]").forEach(card => {
    const edition = normalizeEdition(card.dataset.edition);
    if (!edition) return;

    const target = `modules.html?edition=${encodeURIComponent(edition)}`;
    card.href = target;
    card.removeAttribute("aria-disabled");
    card.classList.remove("pathway-disabled");
    card.style.pointerEvents = "auto";
    card.style.touchAction = "manipulation";
    card.style.cursor = "pointer";

    /* Save preference only. NEVER cancel native anchor navigation. */
    card.addEventListener("pointerdown", () => saveEdition(edition), { passive: true });
    card.addEventListener("touchstart", () => saveEdition(edition), { passive: true });
    card.addEventListener("click", () => saveEdition(edition), { passive: true });
  });
}

async function verifySessionWithoutBlockingNavigation() {
  try {
    const { data } = await Promise.race([
      supabaseClient.auth.getSession(),
      new Promise(resolve => setTimeout(() => resolve({ data: null }), 2500))
    ]);
    if (data?.session) return;
    /* Do not disable pathway links. If the session truly expired,
       modules/session protection will route to sign-in itself. */
  } catch (error) {
    console.warn("ACL pathway session check skipped:", error);
  }
}

function init() {
  initializePreferenceControl();
  makeCardsFailSafe();
  document.body.classList.add("pathways-ready");
  void verifySessionWithoutBlockingNavigation();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}

import {
  getAclSettings,
  saveAclSettings
} from "./user-settings.js?v=5.1.0";

const byId = (id) => document.getElementById(id);

const card = byId("expertLearningToolsCard");
const confidence = byId("confidenceEnabled");
const lifelines = byId("lifelinesEnabled");
const expert = byId("lifelineExpert");
const filter = byId("lifelineFilter");
const guideline = byId("lifelineGuideline");
const vault = byId("lifelineVault");
const status = byId("expertToolsStatus");

const edition = (new URLSearchParams(location.search).get("edition") || localStorage.getItem("aclSelectedEdition") || "expert").toLowerCase();

if (card) {
  card.hidden = edition !== "expert";
}

function setChildrenDisabled(disabled) {
  [expert, filter, guideline, vault].forEach((el) => {
    if (el) el.disabled = disabled;
  });
}

function showStatus(message, isError = false) {
  if (!status) return;
  status.textContent = message;
  status.style.color = isError ? "#b42318" : "#16805f";
  if (message) setTimeout(() => {
    if (status.textContent === message) status.textContent = "";
  }, 2600);
}

function readForm() {
  return {
    confidenceEnabled: Boolean(confidence?.checked),
    lifelinesEnabled: Boolean(lifelines?.checked),
    enabledLifelines: {
      expert: Boolean(expert?.checked),
      filter: Boolean(filter?.checked),
      guideline: Boolean(guideline?.checked),
      vault: Boolean(vault?.checked)
    }
  };
}

async function save() {
  try {
    const saved = await saveAclSettings(readForm());
    if (confidence) confidence.checked = saved.confidenceEnabled;
    if (lifelines) lifelines.checked = saved.lifelinesEnabled;
    if (expert) expert.checked = saved.enabledLifelines.expert;
    if (filter) filter.checked = saved.enabledLifelines.filter;
    if (guideline) guideline.checked = saved.enabledLifelines.guideline;
    if (vault) vault.checked = saved.enabledLifelines.vault;
    setChildrenDisabled(!saved.lifelinesEnabled);
    showStatus("✓ Expert learning settings saved.");
  } catch (error) {
    console.error("ACL expert settings save error", error);
    showStatus("Could not save Expert learning settings.", true);
  }
}

async function init() {
  if (!card || edition !== "expert") return;
  try {
    const settings = await getAclSettings({ forceRefresh: true });
    if (confidence) confidence.checked = settings.confidenceEnabled;
    if (lifelines) lifelines.checked = settings.lifelinesEnabled;
    if (expert) expert.checked = settings.enabledLifelines.expert;
    if (filter) filter.checked = settings.enabledLifelines.filter;
    if (guideline) guideline.checked = settings.enabledLifelines.guideline;
    if (vault) vault.checked = settings.enabledLifelines.vault;
    setChildrenDisabled(!settings.lifelinesEnabled);
  } catch (error) {
    console.error("ACL expert settings load error", error);
    showStatus("Could not load Expert learning settings.", true);
  }
}

[confidence, expert, filter, guideline, vault].forEach((el) => el?.addEventListener("change", save));
lifelines?.addEventListener("change", () => {
  setChildrenDisabled(!lifelines.checked);
  void save();
});

void init();

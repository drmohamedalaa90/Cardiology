import {
  getAclSettings,
  saveAclSettings
} from "./user-settings.js?v=5.1.0";

const edition = String(
  new URLSearchParams(location.search).get("edition") ||
  localStorage.getItem("aclSelectedEdition") ||
  "expert"
).toLowerCase();

if (edition === "expert") {
  const grid = document.querySelector(".settings-grid");

  if (grid && !document.getElementById("expertLearningToolsCard")) {
    const card = document.createElement("article");
    card.id = "expertLearningToolsCard";
    card.className = "settings-card full expert-learning-tools";
    card.innerHTML = `
      <h2>Expert learning tools</h2>
      <p class="desc">Choose the decision-support tools available while answering Expert Edition questions.</p>

      <div class="setting-row">
        <div class="setting-label">
          <strong>Confidence answering</strong>
          <small>After answering, record how confident you were in your decision.</small>
        </div>
        <label class="switch">
          <input id="confidenceEnabled" type="checkbox">
          <span class="switch-track"></span>
        </label>
      </div>

      <div class="setting-row">
        <div class="setting-label">
          <strong>Life Savers</strong>
          <small>Show the Expert Edition lifeline tools during eligible questions.</small>
        </div>
        <label class="switch">
          <input id="lifelinesEnabled" type="checkbox">
          <span class="switch-track"></span>
        </label>
      </div>

      <div id="lifeSaverOptions" class="life-saver-options">
        <div class="setting-row compact-tool-row">
          <div class="setting-label">
            <strong>Ask Dr. Corazón</strong>
            <small>Get an expert-style clue without directly revealing the answer.</small>
          </div>
          <label class="switch"><input id="lifelineExpert" type="checkbox"><span class="switch-track"></span></label>
        </div>

        <div class="setting-row compact-tool-row">
          <div class="setting-label">
            <strong>Filter the options</strong>
            <small>Remove weaker distractors when this Life Saver is available.</small>
          </div>
          <label class="switch"><input id="lifelineFilter" type="checkbox"><span class="switch-track"></span></label>
        </div>

        <div class="setting-row compact-tool-row">
          <div class="setting-label">
            <strong>Guideline clue</strong>
            <small>Reveal a focused guideline-based hint relevant to the decision.</small>
          </div>
          <label class="switch"><input id="lifelineGuideline" type="checkbox"><span class="switch-track"></span></label>
        </div>

        <div class="setting-row compact-tool-row">
          <div class="setting-label">
            <strong>Knowledge Vault</strong>
            <small>Open a concise high-yield reference clue when available.</small>
          </div>
          <label class="switch"><input id="lifelineVault" type="checkbox"><span class="switch-track"></span></label>
        </div>
      </div>

      <div id="expertSettingsStatus" class="save-status" role="status" aria-live="polite"></div>
    `;

    const displayCard = [...grid.querySelectorAll(".settings-card")]
      .find(el => /display and quiz behaviour/i.test(el.textContent || ""));
    grid.insertBefore(card, displayCard || null);

    const confidence = document.getElementById("confidenceEnabled");
    const master = document.getElementById("lifelinesEnabled");
    const expert = document.getElementById("lifelineExpert");
    const filter = document.getElementById("lifelineFilter");
    const guideline = document.getElementById("lifelineGuideline");
    const vault = document.getElementById("lifelineVault");
    const options = document.getElementById("lifeSaverOptions");
    const status = document.getElementById("expertSettingsStatus");

    function setOptionState() {
      const enabled = master.checked;
      [expert, filter, guideline, vault].forEach(input => {
        input.disabled = !enabled;
      });
      options.classList.toggle("is-disabled", !enabled);
    }

    async function load() {
      try {
        const s = await getAclSettings({ forceRefresh: true });
        confidence.checked = s.confidenceEnabled !== false;
        master.checked = s.lifelinesEnabled !== false;
        expert.checked = s.enabledLifelines?.expert !== false;
        filter.checked = s.enabledLifelines?.filter !== false;
        guideline.checked = s.enabledLifelines?.guideline !== false;
        vault.checked = s.enabledLifelines?.vault !== false;
        setOptionState();
      } catch (error) {
        console.error("ACL expert settings load error", error);
        status.textContent = "Could not load Expert learning settings.";
      }
    }

    let saveTimer = null;
    async function save() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(async () => {
        try {
          status.textContent = "Saving…";
          await saveAclSettings({
            confidenceEnabled: confidence.checked,
            lifelinesEnabled: master.checked,
            enabledLifelines: {
              expert: expert.checked,
              filter: filter.checked,
              guideline: guideline.checked,
              vault: vault.checked
            }
          });
          status.textContent = "✓ Expert learning settings saved.";
          setTimeout(() => {
            if (status.textContent.includes("saved")) status.textContent = "";
          }, 1800);
        } catch (error) {
          console.error("ACL expert settings save error", error);
          status.textContent = "Could not save Expert learning settings.";
        }
      }, 120);
    }

    [confidence, master, expert, filter, guideline, vault].forEach(input => {
      input.addEventListener("change", () => {
        if (input === master) setOptionState();
        void save();
      });
    });

    const style = document.createElement("style");
    style.textContent = `
      .expert-learning-tools{border-color:#cbdcf0!important;background:linear-gradient(180deg,#fff,#fbfdff)!important}
      .expert-learning-tools h2:before{content:"✦";margin-right:8px;color:#e0a500}
      .life-saver-options{margin:2px 0 0 20px;padding-left:16px;border-left:3px solid #e5eef8;transition:opacity .2s ease}
      .life-saver-options.is-disabled{opacity:.46}
      .compact-tool-row{padding:11px 0!important}
      @media(max-width:760px){.life-saver-options{margin-left:4px;padding-left:11px}.expert-learning-tools .setting-row{align-items:center!important}.expert-learning-tools .setting-label{padding-right:8px}}
    `;
    document.head.appendChild(style);

    void load();
  }
}

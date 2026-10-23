import { supabaseClient } from "./supabase-client.js";
import { ACL_CONFIG } from "./config.js";

const byId = (id) => document.getElementById(id);
const REMEMBER_KEY = "aclRememberMe";
const REMEMBER_IDENTIFIER_KEY = "aclRememberIdentifier";
let deferredInstallPrompt = null;

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandaloneApp() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true;
}

function setPasswordVisibility(inputIds, visible) {
  inputIds.forEach(id => {
    const input = byId(id);
    if (input) input.type = visible ? "text" : "password";
  });
}

function installInstructionsHtml() {
  if (isStandaloneApp()) {
    return "<p>ACL is already installed on this device.</p>";
  }

  if (isIosDevice()) {
    return `
      <ol>
        <li>Open this page in <strong>Safari</strong>.</li>
        <li>Tap the <strong>Share</strong> button.</li>
        <li>Choose <strong>Add to Home Screen</strong>.</li>
        <li>Tap <strong>Add</strong> to install ACL.</li>
      </ol>
    `;
  }

  if (deferredInstallPrompt) {
    return "<p>Install ACL on this device for faster full-screen access from your home screen.</p>";
  }

  return `
    <p>Open this page in Chrome or another supported browser, then use the browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
  `;
}

function openInstallModal() {
  const modal = byId("aclInstallModal");
  const instructions = byId("aclInstallInstructions");
  const action = byId("aclInstallAction");

  if (!modal || !instructions || !action) return;

  instructions.innerHTML = installInstructionsHtml();

  const canPrompt =
    !isStandaloneApp() &&
    !isIosDevice() &&
    Boolean(deferredInstallPrompt);

  action.hidden = !canPrompt;
  action.disabled = false;
  action.textContent = "Install app";
  modal.hidden = false;
}

function closeInstallModal() {
  const modal = byId("aclInstallModal");
  if (modal) modal.hidden = true;
}

function setMessage(id, message = "") { const el = byId(id); if (el) el.textContent = message; }
function normalizeUsername(value) { return String(value || "").trim().toLowerCase(); }
function validUsername(value) { return /^[a-z0-9._]{3,30}$/.test(value); }
function normalizeEgyptWhatsapp(value) {
  let raw = String(value || "").replace(/[^0-9+]/g, "");
  if (raw.startsWith("+20")) raw = "0" + raw.slice(3);
  if (raw.startsWith("0020")) raw = "0" + raw.slice(4);
  if (!/^01\d{9}$/.test(raw)) return null;
  return "+20" + raw.slice(1);
}

function clearEditionChoice() {
  try {
    sessionStorage.removeItem("aclSelectedEdition");
    sessionStorage.removeItem("aclEditionEntryGranted");
  } catch {}

  try {
    localStorage.removeItem("aclSelectedEdition");
  } catch {}
}

function openAclHome() {
  clearEditionChoice();
  window.location.href = "edition-select.html";
}

function showPanel(panel) {
  const signIn = panel === "signin";
  byId("signInForm").hidden = !signIn;
  byId("registerForm").hidden = signIn;
  byId("signInTab").classList.toggle("active", signIn);
  byId("registerTab").classList.toggle("active", !signIn);
  history.replaceState(null, "", signIn ? "acl-access.html?build=20261023-clean" : "acl-access.html?build=20261023-clean#register");
}

byId("signInTab")?.addEventListener("click", () => showPanel("signin"));
byId("registerTab")?.addEventListener("click", () => showPanel("register"));
if (location.hash === "#register") showPanel("register");

try {
  const remembered = localStorage.getItem(REMEMBER_IDENTIFIER_KEY);
  const rememberSetting = localStorage.getItem(REMEMBER_KEY);

  if (remembered && byId("identifier")) {
    byId("identifier").value = remembered;
  }

  if (byId("rememberMe")) {
    byId("rememberMe").checked = rememberSetting !== "0";
  }
} catch {}

byId("showLoginPassword")?.addEventListener("change", event => {
  setPasswordVisibility(["loginPassword"], event.target.checked);
});

byId("showRegisterPassword")?.addEventListener("change", event => {
  setPasswordVisibility(
    ["registerPassword", "confirmPassword"],
    event.target.checked
  );
});

window.addEventListener("beforeinstallprompt", event => {
  event.preventDefault();
  deferredInstallPrompt = event;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  closeInstallModal();

  const installButton = byId("installAclApp");
  if (installButton) {
    installButton.disabled = true;
    installButton.querySelector("strong").textContent = "ACL app installed";
    installButton.querySelector("small").textContent = "Ready on this device";
  }
});

byId("installAclApp")?.addEventListener("click", openInstallModal);
byId("aclInstallClose")?.addEventListener("click", closeInstallModal);

byId("aclInstallModal")?.addEventListener("click", event => {
  if (event.target === byId("aclInstallModal")) closeInstallModal();
});

byId("aclInstallAction")?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;

  const action = byId("aclInstallAction");
  action.disabled = true;

  try {
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
  } catch {}

  deferredInstallPrompt = null;
  closeInstallModal();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeInstallModal();
});

if (isStandaloneApp() && byId("installAclApp")) {
  byId("installAclApp").disabled = true;
  byId("installAclApp").querySelector("strong").textContent = "ACL app installed";
  byId("installAclApp").querySelector("small").textContent = "Ready on this device";
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register(`${ACL_CONFIG.siteBase}service-worker.js?v=7.19.0`, {
      scope: ACL_CONFIG.siteBase,
      updateViaCache: "none"
    })
    .catch(error => console.warn("ACL service worker:", error));
}

byId("signInForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("signInError"); setMessage("signInSuccess");
  const identifier = byId("identifier").value.trim();
  const password = byId("loginPassword").value;
  const rememberMe = byId("rememberMe")?.checked !== false;

  try {
    localStorage.setItem(REMEMBER_KEY, rememberMe ? "1" : "0");

    if (rememberMe) {
      localStorage.setItem(REMEMBER_IDENTIFIER_KEY, identifier);
    } else {
      localStorage.removeItem(REMEMBER_IDENTIFIER_KEY);
    }
  } catch {}

  const submit = event.submitter; if (submit) submit.disabled = true;
  try {
    const { data, error } = await supabaseClient.functions.invoke("username-login", { body: { identifier, password } });

    const serverMessage = String(data?.error || "").trim();

    if (error) {
      if (/suspend|hold/i.test(serverMessage)) {
        throw new Error("This account is currently on hold. Please contact the ACL administrator.");
      }
      throw new Error("Wrong email or password.");
    }

    if (!data?.session?.access_token || !data?.session?.refresh_token) {
      if (/suspend|hold/i.test(serverMessage)) {
        throw new Error("This account is currently on hold. Please contact the ACL administrator.");
      }
      throw new Error("Wrong email or password.");
    }

    const { error: sessionError } = await supabaseClient.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });

    if (sessionError) throw new Error("Wrong email or password.");

    openAclHome();
  } catch (error) {
    const raw = String(error?.message || "");
    const message =
      /suspend|hold/i.test(raw)
        ? "This account is currently on hold. Please contact the ACL administrator."
        : "Wrong email or password.";

    setMessage("signInError", message);
  } finally {
    if (submit) submit.disabled = false;
  }
});

byId("registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("registerError"); setMessage("registerSuccess");
  const fullName = byId("name").value.trim();
  const username = normalizeUsername(byId("username").value);
  const email = byId("email").value.trim().toLowerCase();
  const whatsapp = normalizeEgyptWhatsapp(byId("whatsapp").value);
  const academicYear = byId("academicYear").value.trim();
  const institution = byId("institution").value.trim();
  const password = byId("registerPassword").value;
  const confirmation = byId("confirmPassword").value;
  if (!fullName || !email || !whatsapp || !academicYear || !institution) return setMessage("registerError", "Please complete all required fields.");
  if (!validUsername(username)) return setMessage("registerError", "Username must be 3–30 characters using letters, numbers, dots or underscores.");
  if (password.length < 8) return setMessage("registerError", "Password must contain at least 8 characters.");
  if (password !== confirmation) return setMessage("registerError", "Passwords do not match.");
  const submit = event.submitter; if (submit) submit.disabled = true;
  try {
    const { data: taken } = await supabaseClient.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (taken) throw new Error("This username is already taken.");
    const { data, error } = await supabaseClient.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}${ACL_CONFIG.siteBase}confirm.html`, data: { full_name: fullName, username, whatsapp, academic_year: academicYear, institution } }
    });
    if (error) throw error;
    if (!data.session) {
      setMessage("registerSuccess", "Account created. Open the confirmation email, confirm your address, then return to sign in.");
      event.target.reset();
    } else {
      openAclHome();
    }
  } catch (error) {
    setMessage("registerError", error.message || "Could not create account.");
  } finally { if (submit) submit.disabled = false; }
});

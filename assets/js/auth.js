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
function normalizeWhatsapp(code,value){
 const prefix=String(code||'').trim();if(!/^\+[1-9]\d{0,3}$/.test(prefix))return null;
 let raw=String(value||'').trim().replace(/[\s().-]/g,'');
 if(raw.startsWith('00'))raw='+'+raw.slice(2);
 if(raw.startsWith('+')){if(!raw.startsWith(prefix))return null;raw=raw.slice(prefix.length);}
 if(!/^\d+$/.test(raw))return null;
 if(prefix!=='+39')raw=raw.replace(/^0+/,'');
 if(prefix==='+20'&&!/^1[0125]\d{8}$/.test(raw))return null;
 const result=prefix+raw;return /^\+[1-9]\d{7,14}$/.test(result)?result:null;
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
  if(!validateRegistration())return;
  const fullName = byId("name").value.trim();
  const username = normalizeUsername(byId("username").value);
  const email = byId("email").value.trim().toLowerCase();
  const whatsapp = normalizeWhatsapp(byId("countryCode").value,byId("whatsapp").value);
  const professionalRole=byId("professionalRole").value;
  const studyYear=byId("academicYear").disabled?'':byId("academicYear").value;
  const roleLabel=byId("professionalRole").selectedOptions[0]?.textContent||'';
  const academicYear=roleLabel+(studyYear?' · Year '+studyYear:'');
  const institution = byId("institution").value.trim();
  const password = byId("registerPassword").value;
  const confirmation = byId("confirmPassword").value;
  if (!fullName || !email || !whatsapp || !professionalRole || !institution) return setMessage("registerError", "Please complete all required fields.");
  if (!validUsername(username)) return setMessage("registerError", "Username must be 3–30 characters using letters, numbers, dots or underscores.");
  if (password.length < 8) return setMessage("registerError", "Password must contain at least 8 characters.");
  if (password !== confirmation) return setMessage("registerError", "Passwords do not match.");
  const submit = event.submitter; if (submit) submit.disabled = true;
  try {
    const { data: taken } = await supabaseClient.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (taken) throw new Error("This username is already taken.");
    const { data, error } = await supabaseClient.auth.signUp({
      email, password,
      options: { emailRedirectTo: `${window.location.origin}${ACL_CONFIG.siteBase}confirm.html`, data: { full_name: fullName, username, whatsapp, academic_year: academicYear, institution, professional_role:professionalRole, study_year:studyYear||null, whatsapp_country_code:byId("countryCode").value.trim() } }
    });
    if (error) throw error;
    if (!data.session) {
      setMessage("registerSuccess", "Account created. Open the confirmation email, confirm your address, then return to sign in.");
      event.target.reset();updateRegistrationYear();showRegistrationStep(0);
    } else {
      openAclHome();
    }
  } catch (error) {
    setMessage("registerError", error.message || "Could not create account.");
  } finally { if (submit) submit.disabled = false; }
});

let registrationStep=0;
function showRegistrationStep(step){
 registrationStep=step;
 document.querySelectorAll('[data-reg-panel]').forEach(el=>el.hidden=Number(el.dataset.regPanel)!==step);
 document.querySelectorAll('[data-reg-step]').forEach(el=>{const n=Number(el.dataset.regStep);el.classList.toggle('is-current',n===step);el.classList.toggle('is-done',n<step);el.setAttribute('aria-current',n===step?'step':'false');});
 byId('regBack').hidden=step===0;byId('regNext').hidden=step===2;byId('regSubmit').hidden=step!==2;
 byId('regStepCaption').textContent=['Let’s start with your details.','Where are you in your medical journey?','Choose a password to protect your account.'][step];
}
function updateRegistrationYear(){
 const role=byId('professionalRole').value,year=byId('academicYear'),count=role==='undergraduate'?5:role==='intern'?2:0;
 byId('regYearField').hidden=!count;year.disabled=!count;year.required=!!count;year.value='';
 byId('regYearLabel').textContent=role==='intern'?'Internship year':'Academic year';
 year.innerHTML='<option value="">Choose your year</option>'+Array.from({length:count},(_,i)=>'<option value="'+(i+1)+'">Year '+(i+1)+'</option>').join('');
}
function validateRegistrationStep(step){
 const panel=document.querySelector('[data-reg-panel="'+step+'"]');
 for(const field of panel.querySelectorAll('input,select')){if(field.disabled)continue;field.setCustomValidity('');if(!field.checkValidity()){showRegistrationStep(step);field.reportValidity();return false;}}
 if(step===0){
 const number=normalizeWhatsapp(byId('countryCode').value,byId('whatsapp').value);
 if(!number){showRegistrationStep(0);byId('whatsapp').setCustomValidity('Enter a valid WhatsApp number for the selected country code.');byId('whatsapp').reportValidity();return false;}
 if(byId('name').value.trim().length<2){byId('name').setCustomValidity('Enter your full name.');byId('name').reportValidity();return false;}
 }
 if(step===2&&byId('registerPassword').value!==byId('confirmPassword').value){showRegistrationStep(2);byId('confirmPassword').setCustomValidity('Passwords do not match.');byId('confirmPassword').reportValidity();return false;}
 return true;
}
function validateRegistration(){for(let i=0;i<3;i++)if(!validateRegistrationStep(i))return false;return true;}
byId('regNext')?.addEventListener('click',()=>{if(validateRegistrationStep(registrationStep)){showRegistrationStep(registrationStep+1);document.querySelector('[data-reg-panel="'+registrationStep+'"] input,[data-reg-panel="'+registrationStep+'"] select')?.focus();}});
byId('regBack')?.addEventListener('click',()=>showRegistrationStep(Math.max(0,registrationStep-1)));
document.querySelectorAll('[data-reg-step]').forEach(b=>b.addEventListener('click',()=>{const target=Number(b.dataset.regStep);if(target<=registrationStep){showRegistrationStep(target);return;}for(let i=0;i<target;i++)if(!validateRegistrationStep(i))return;showRegistrationStep(target);}));
byId('professionalRole')?.addEventListener('change',updateRegistrationYear);
byId('registerForm')?.addEventListener('input',e=>{e.target.setCustomValidity?.('');if(['countryCode','whatsapp'].includes(e.target.id)){byId('whatsapp').setCustomValidity('');const n=normalizeWhatsapp(byId('countryCode').value,byId('whatsapp').value);byId('regPhonePreview').textContent=n?'WhatsApp: '+n:'';}if(['registerPassword','confirmPassword'].includes(e.target.id)){byId('confirmPassword').setCustomValidity('');byId('regPasswordMatch').textContent=byId('confirmPassword').value?(byId('confirmPassword').value===byId('registerPassword').value?'Passwords match ✓':'Passwords do not match yet'):'';}});
if(byId('regNext')){updateRegistrationYear();showRegistrationStep(0);}

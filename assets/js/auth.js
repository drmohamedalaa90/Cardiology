import { supabaseClient } from "./supabase-client.js";
import { ACL_CONFIG } from "./config.js";

const byId = (id) => document.getElementById(id);

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

function showPanel(panel) {
  const signIn = panel === "signin";
  byId("signInForm").hidden = !signIn;
  byId("registerForm").hidden = signIn;
  byId("signInTab").classList.toggle("active", signIn);
  byId("registerTab").classList.toggle("active", !signIn);
  history.replaceState(null, "", signIn ? "login.html" : "login.html#register");
}

byId("signInTab")?.addEventListener("click", () => showPanel("signin"));
byId("registerTab")?.addEventListener("click", () => showPanel("register"));
if (location.hash === "#register") showPanel("register");

byId("signInForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("signInError"); setMessage("signInSuccess");
  const identifier = byId("identifier").value.trim();
  const password = byId("loginPassword").value;
  const submit = event.submitter; if (submit) submit.disabled = true;
  try {
    const { data, error } = await supabaseClient.functions.invoke("username-login", {
      body: { identifier, password }
    });
    if (error) throw error;
    if (!data?.session?.access_token || !data?.session?.refresh_token) {
      throw new Error(data?.error || "Invalid username/email or password.");
    }
    const { error: sessionError } = await supabaseClient.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token
    });
    if (sessionError) throw sessionError;
    const { data: isAdmin, error: adminError } = await supabaseClient.rpc("acl_is_admin");
    window.location.href = (!adminError && isAdmin === true) ? "admin.html" : "modules.html";
  } catch (error) {
    setMessage("signInError", error.message || "Could not sign in.");
  } finally { if (submit) submit.disabled = false; }
});

byId("registerForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("registerError"); setMessage("registerSuccess");
  const fullName =
  byId("name")
    ?.value
    ?.trim() || "";

const username =
  normalizeUsername(
    byId("username")
      ?.value
  );

const email =
  byId("email")
    ?.value
    ?.trim()
    ?.toLowerCase() || "";

const whatsapp =
  normalizeEgyptWhatsapp(
    byId("whatsapp")
      ?.value
  );

const position =
  (
    byId("position") ||
    byId("academicYear")
  )
    ?.value
    ?.trim() || "";

const institution =
  byId("institution")
    ?.value
    ?.trim() || "";

const password =
  byId("registerPassword")
    ?.value || "";

const confirmation =
  byId("confirmPassword")
    ?.value || "";
  if (!fullName || !email || !whatsapp || !position || !institution) return setMessage("registerError", "Please complete all required fields.");
  if (!validUsername(username)) return setMessage("registerError", "Username must be 3–30 characters using letters, numbers, dots or underscores.");
  if (password.length < 8) return setMessage("registerError", "Password must contain at least 8 characters.");
  if (password !== confirmation) return setMessage("registerError", "Passwords do not match.");
  const submit = event.submitter; if (submit) submit.disabled = true;
  try {
    const { data: taken } = await supabaseClient.from("profiles").select("id").ilike("username", username).maybeSingle();
    if (taken) throw new Error("This username is already taken.");
   const { data, error } = await supabaseClient.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}${ACL_CONFIG.siteBase}confirm.html`,
 data: {
  full_name:
    fullName,

  display_name:
    fullName,

  username,

  whatsapp,

  position,

  institution
}
  }
});

console.log("SIGNUP DATA:", data);
console.log("SIGNUP ERROR:", error);

if (error) throw error;    if (!data.session) {
      setMessage("registerSuccess", "Account created. Open the confirmation email, confirm your address, then return to sign in.");
      event.target.reset();
    } else {
      const { data: isAdmin, error: adminError } = await supabaseClient.rpc("acl_is_admin");
      window.location.href = (!adminError && isAdmin === true) ? "admin.html" : "modules.html";
    }
 } catch (error) {
    console.error(
      "REGISTER ERROR:",
      error
    );

    alert(
      JSON.stringify(
        error,
        null,
        2
      )
    );

    setMessage(
      "registerError",
      error.message ||
      "Could not create account."
    );
  } finally {
    if (submit) {
      submit.disabled =
        false;
    }
  }
});

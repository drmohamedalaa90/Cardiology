import { ACL_CONFIG } from "./config.js";
const el = (id) => document.getElementById(id);

el("forgotForm")?.addEventListener("submit", event => {
  event.preventDefault();
  el("forgotError").textContent = "";
  el("forgotSuccess").textContent = "";
  const email = el("recoveryEmail").value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    el("forgotError").textContent = "Enter your registered ACL email.";
    return;
  }
  // Existing Supabase reset links do not update ACL's migrated legacy bcrypt
  // credentials in Neon. Until a verified recovery service is available,
  // direct members to the ACL administrator instead of promising a dead link.
  const subject = "ACL account recovery request";
  const message = "Hello,\n\nI cannot sign in to ACL.\nMy registered email is: " + email +
    "\n\nPlease help me recover my account securely.\n\nI will not send my password by email.";
  const link = "mailto:drmohamedalaa90@gmail.com?subject=" + encodeURIComponent(subject) +
    "&body=" + encodeURIComponent(message);
  el("forgotSuccess").textContent = "Your email app will open with an account-recovery request. Send it to the ACL administrator. Do not include your password.";
  const a = document.createElement("a");
  a.href = link;
  a.click();
});

el("resetForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  el("resetError").textContent = "";
  el("resetSuccess").textContent = "";
  const submit = event.submitter;
  if (submit) submit.disabled = true;
  try {
    const password = el("newPassword").value;
    const confirmation = el("newPasswordConfirm").value;
    const params = new URLSearchParams(window.location.search);
    const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || params.get("token");
    if (!token || params.get("error")) throw new Error("This recovery link is invalid or expired. Request a new one.");
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) throw new Error("Use at least 12 characters, including letters and numbers.");
    if (password !== confirmation) throw new Error("Passwords do not match.");
    const response = await fetch("https://acl-neon-api.drmohamedalaa90.workers.dev/auth/recovery/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ newPassword: password, token })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.error) {
      throw new Error(result?.error?.message || result?.message || "This recovery link is invalid or expired.");
    }
    window.history.replaceState(null, "", window.location.pathname);
    el("resetSuccess").textContent = "Password changed successfully. Redirecting to sign in…";
    setTimeout(() => { window.location.href = "./neon-google-login-test.html"; }, 1400);
  } catch (error) {
    el("resetError").textContent = error?.message || "Could not change the password.";
    if (submit) submit.disabled = false;
  }
});

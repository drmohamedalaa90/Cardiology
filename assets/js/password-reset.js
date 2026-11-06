import { supabaseClient } from "./supabase-client.js";
import { ACL_CONFIG } from "./config.js";
const el = (id) => document.getElementById(id);

el("forgotForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  el("forgotError").textContent = "";
  el("forgotSuccess").textContent = "";
  const submit = event.submitter;
  if (submit) submit.disabled = true;
  try {
    const email = el("recoveryEmail").value.trim().toLowerCase();
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + ACL_CONFIG.siteBase + "reset-password.html"
    });
    if (error) throw error;
    el("forgotSuccess").textContent = "If this email is registered, a recovery link has been sent. Check your inbox and spam folder.";
  } catch (error) {
    el("forgotError").textContent = error?.message || "Could not send the recovery email. Please try again.";
  } finally {
    if (submit) submit.disabled = false;
  }
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
    const token = params.get("token");
    if (!token || params.get("error")) throw new Error("This recovery link is invalid or expired. Request a new one.");
    if (password.length < 8) throw new Error("Password must contain at least 8 characters.");
    if (password !== confirmation) throw new Error("Passwords do not match.");
    const response = await fetch(ACL_CONFIG.neonAuthUrl.replace(/\/$/, "") + "/reset-password", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword: password, token })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result?.error) {
      throw new Error(result?.error?.message || result?.message || "This recovery link is invalid or expired.");
    }
    el("resetSuccess").textContent = "Password changed successfully. Redirecting to sign in…";
    setTimeout(() => { window.location.href = "./neon-google-login-test.html"; }, 1400);
  } catch (error) {
    el("resetError").textContent = error?.message || "Could not change the password.";
    if (submit) submit.disabled = false;
  }
});

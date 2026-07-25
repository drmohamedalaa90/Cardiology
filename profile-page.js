import { supabaseClient } from "./supabase-client.js";
import { ACL_CONFIG } from "./config.js";
const el = (id) => document.getElementById(id);

el("forgotForm")?.addEventListener("submit", async (event) => {
  event.preventDefault(); el("forgotError").textContent = ""; el("forgotSuccess").textContent = "";
  const email = el("recoveryEmail").value.trim().toLowerCase();
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}${ACL_CONFIG.siteBase}reset-password.html`
  });
  if (error) el("forgotError").textContent = error.message;
  else el("forgotSuccess").textContent = "Recovery email sent. Check your inbox and spam folder.";
});

el("resetForm")?.addEventListener("submit", async (event) => {
  event.preventDefault(); el("resetError").textContent = ""; el("resetSuccess").textContent = "";
  const password = el("newPassword").value;
  const confirmation = el("newPasswordConfirm").value;
  if (password.length < 8) return el("resetError").textContent = "Password must contain at least 8 characters.";
  if (password !== confirmation) return el("resetError").textContent = "Passwords do not match.";
  const { data } = await supabaseClient.auth.getSession();
  if (!data.session) return el("resetError").textContent = "This recovery link is invalid or expired. Request a new one.";
  const { error } = await supabaseClient.auth.updateUser({ password });
  if (error) el("resetError").textContent = error.message;
  else {
    el("resetSuccess").textContent = "Password changed successfully. Redirecting to sign in…";
    await supabaseClient.auth.signOut();
    setTimeout(() => { window.location.href = "login.html"; }, 1600);
  }
});

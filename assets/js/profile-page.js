import { supabaseClient } from "./supabase-client.js";
import { protectAndRender, loadProfile } from "./session-ui.js";

const form = document.getElementById("profileForm");
const status = document.getElementById("profileStatus");
let currentProfile = null;

function showStatus(message, type) {
  status.textContent = message;
  status.className = `status-box show ${type}`;
}

function initials(name) {
  return String(name || "ACL").split(/\s+/).slice(0,2).map(x => x[0] || "").join("").toUpperCase();
}

function renderAvatar(url, name) {
  const img = document.getElementById("avatarPreview");
  const placeholder = document.getElementById("avatarPlaceholder");
  if (url) {
    img.src = url; img.style.display = "block"; placeholder.style.display = "none";
  } else {
    img.style.display = "none"; placeholder.style.display = "grid"; placeholder.textContent = initials(name);
  }
}

async function init() {
  currentProfile = await protectAndRender("login.html");
  if (!currentProfile) return;
  document.getElementById("name").value = currentProfile.full_name || "";
  document.getElementById("email").value = currentProfile.email || "";
  document.getElementById("whatsapp").value = currentProfile.phone_e164 || "";
  document.getElementById("academicYear").value = currentProfile.academic_year || "";
  document.getElementById("institution").value = currentProfile.institution || "";
  renderAvatar(currentProfile.avatar_url, currentProfile.full_name);
}

async function uploadAvatar(file, userId) {
  if (!file) return currentProfile.avatar_url || null;
  if (file.size > 5 * 1024 * 1024) throw new Error("Photo must be smaller than 5 MB.");
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabaseClient.storage.from("avatars").upload(path, file, { upsert: true });
  if (error) throw error;
  const { data } = supabaseClient.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw new Error("Session expired. Sign in again.");
    const avatarUrl = await uploadAvatar(document.getElementById("avatarFile").files[0], user.id);
    const { data, error } = await supabaseClient.from("profiles").update({
      phone_e164: document.getElementById("whatsapp").value.trim(),
      academic_year: document.getElementById("academicYear").value.trim(),
      institution: document.getElementById("institution").value.trim(),
      avatar_url: avatarUrl,
      last_seen_at: new Date().toISOString()
    }).eq("id", user.id).select().single();
    if (error) throw error;
    currentProfile = { ...data, email: user.email };
    renderAvatar(currentProfile.avatar_url, currentProfile.full_name);
    showStatus("Profile saved successfully.", "success");
  } catch (error) {
    showStatus(error.message || "Could not save profile.", "error");
  }
});

init();

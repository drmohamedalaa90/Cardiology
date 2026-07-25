import { supabaseClient } from "./supabase-client.js";
import { ACL_CONFIG } from "./config.js";

const qs = (id) => document.getElementById(id);

function normalizeEgyptWhatsapp(value) {
  let raw = String(value || "").replace(/[^0-9+]/g, "");
  if (raw.startsWith("+20")) raw = "0" + raw.slice(3);
  if (raw.startsWith("0020")) raw = "0" + raw.slice(4);
  if (!/^01\d{9}$/.test(raw)) return null;
  return "+20" + raw.slice(1);
}

async function updateProfile(user, profile) {
  const payload = {
    phone_e164: profile.whatsapp,
    academic_year: profile.academicYear,
    institution: profile.institution,
    last_seen_at: new Date().toISOString()
  };
  const { data, error } = await supabaseClient
    .from("profiles")
    .update(payload)
    .eq("id", user.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function handleLogin(event) {
  event.preventDefault();
  const errorBox = qs("authError");
  const successBox = qs("authSuccess");
  errorBox.textContent = "";
  successBox.textContent = "";

  const name = qs("name").value.trim();
  const email = qs("email").value.trim().toLowerCase();
  const pin = qs("pin").value;
  const whatsapp = normalizeEgyptWhatsapp(qs("whatsapp").value);
  const academicYear = qs("academicYear").value.trim();
  const institution = qs("institution").value.trim();

  if (!name || !email || !pin || !whatsapp || !academicYear || !institution) {
    errorBox.textContent = "Please complete all required fields.";
    return;
  }
  if (pin.length < 6) {
    errorBox.textContent = "PIN must be at least 6 characters.";
    return;
  }

  let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: pin });

  if (error) {
    const signup = await supabaseClient.auth.signUp({
      email,
      password: pin,
      options: {
        emailRedirectTo: `${window.location.origin}${ACL_CONFIG.siteBase}confirm.html`,
        data: { full_name: name, whatsapp, academic_year: academicYear, institution }
      }
    });
    if (signup.error) {
      errorBox.textContent = signup.error.message;
      return;
    }
    if (!signup.data.session) {
      successBox.textContent = "Confirmation email sent. Open it, confirm your email, then return and sign in.";
      return;
    }
    data = signup.data;
  }

  const user = data.session?.user || data.user;
  if (!user) {
    errorBox.textContent = "No active session was returned. Confirm your email first.";
    return;
  }

  try {
    await updateProfile(user, { whatsapp, academicYear, institution });
    window.location.href = "modules.html";
  } catch (profileError) {
    errorBox.textContent = profileError.message;
  }
}

document.getElementById("loginForm")?.addEventListener("submit", handleLogin);

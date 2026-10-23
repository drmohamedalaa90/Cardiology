import { supabaseClient } from "./supabase-client.js";

const $ = id => document.getElementById(id);

const expertLevelKeywords = [
  "assistant lecturer",
  "lecturer",
  "resident",
  "registrar",
  "fellow",
  "specialist",
  "consultant",
  "professor"
];

function initials(name = "ACL") {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase() || "ACL";
}

function hasExpertAccess(profile) {
  const role =
    String(profile?.role || "")
      .trim()
      .toLowerCase();

  const academicYear =
    String(profile?.academic_year || "")
      .trim()
      .toLowerCase();

  if (role === "admin") {
    return true;
  }

  return expertLevelKeywords.some(
    keyword =>
      academicYear.includes(keyword)
  );
}

const {
  data: { session }
} = await supabaseClient.auth.getSession();

if (!session?.user) {
  location.replace("acl-access.html?build=20261023-clean");
} else {
  const user = session.user;

  const { data: profile } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

  const name =
    profile?.display_name ||
    profile?.full_name ||
    profile?.name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Member";

  const level =
    profile?.academic_year ||
    profile?.role ||
    "ACL learner";

  const photo =
    profile?.avatar_url ||
    profile?.photo_url ||
    profile?.profile_photo_url ||
    user.user_metadata?.avatar_url ||
    user.user_metadata?.picture ||
    "";

  $("editionUserName").textContent =
    name;

  $("editionUserLevel").textContent =
    level;

  const avatar =
    $("editionAvatar");

  if (photo) {
    const image =
      document.createElement("img");

    image.src =
      photo;

    image.alt =
      "";

    avatar.replaceChildren(image);
  } else {
    avatar.textContent =
      initials(name);
  }

  const expertAllowed =
    hasExpertAccess(profile);

  const expertCard =
    $("expertEditionCard");

  const expertStatus =
    $("expertStatus");

  const expertButton =
    $("expertEditionButton");

  const expertButtonText =
    $("expertButtonText");

  const expertButtonIcon =
    $("expertButtonIcon");

  const expertAccessNote =
    $("expertAccessNote");

  if (expertAllowed) {
    expertCard.classList.remove("is-locked");

    expertStatus.textContent =
      "Available";

    expertStatus.classList.remove("locked");
    expertStatus.classList.add("available-expert");

    expertButtonText.textContent =
      "Enter Expert Edition";

    expertButtonIcon.textContent =
      "→";

    expertAccessNote.hidden =
      true;

    expertButton.addEventListener(
      "click",
      () => {
        try {
          localStorage.setItem(
            "aclSelectedEdition",
            "expert"
          );

          sessionStorage.setItem(
            "aclSelectedEdition",
            "expert"
          );

          sessionStorage.setItem(
            "aclEditionEntryGranted",
            "expert"
          );
        } catch {}

        location.href =
          "home.html?edition=expert";
      }
    );
  } else {
    expertButton.addEventListener(
      "click",
      () => {
        $("editionLockModal").hidden =
          false;
      }
    );
  }

  $("basicEditionCard")
    ?.addEventListener(
      "click",
      () => {
        try {
          localStorage.setItem(
            "aclSelectedEdition",
            "basic"
          );

          sessionStorage.setItem(
            "aclSelectedEdition",
            "basic"
          );

          sessionStorage.setItem(
            "aclEditionEntryGranted",
            "basic"
          );
        } catch {}
      }
    );
}

$("editionLogout")
  ?.addEventListener(
    "click",
    async () => {
      try {
        await supabaseClient.auth.signOut();
      } catch {}

      try {
        localStorage.removeItem("aclSelectedEdition");
        sessionStorage.removeItem("aclSelectedEdition");
      } catch {}

      location.replace("acl-access.html?build=20261023-clean");
    }
  );

const lockModal =
  $("editionLockModal");

const closeLockModal =
  () => {
    if (lockModal) {
      lockModal.hidden =
        true;
    }
  };

$("editionLockClose")
  ?.addEventListener(
    "click",
    closeLockModal
  );

lockModal
  ?.addEventListener(
    "click",
    event => {
      if (event.target === lockModal) {
        closeLockModal();
      }
    }
  );

document.addEventListener(
  "keydown",
  event => {
    if (event.key === "Escape") {
      closeLockModal();
    }
  }
);
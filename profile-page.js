import {
  supabaseClient
} from "./supabase-client.js";


import {
  protectAndRender
} from "./session-ui.js?v=5.3.0";


const el = (id) =>
  document.getElementById(id);


/* =========================================================
   STATUS
========================================================= */

function setProfileStatus(
  message = "",
  error = false
) {
  const status =
    el("profileStatus");

  if (!status) {
    return;
  }

  status.textContent =
    message;

  status.hidden =
    !message;

  status.classList.toggle(
    "error",
    error
  );

  status.classList.toggle(
    "success",
    Boolean(message) &&
    !error
  );
}


function setPasswordStatus(
  message = "",
  error = false
) {
  const status =
    el("passwordStatus");

  if (!status) {
    return;
  }

  status.textContent =
    message;

  status.hidden =
    !message;

  status.classList.toggle(
    "error",
    error
  );

  status.classList.toggle(
    "success",
    Boolean(message) &&
    !error
  );
}


/* =========================================================
   AVATAR
========================================================= */

function profileInitials(
  profile
) {
  const name =
    profile.display_name ||
    profile.full_name ||
    profile.username ||
    "ACL";

  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(
      (part) =>
        part.charAt(0)
    )
    .join("")
    .toUpperCase() ||
    "ACL";
}


function renderAvatar(
  profile
) {
  const image =
    el("avatarPreview");

  const placeholder =
    el("avatarPlaceholder");

  if (
    !image ||
    !placeholder
  ) {
    return;
  }

  placeholder.textContent =
    profileInitials(
      profile
    );

  if (profile.avatar_url) {
    image.src =
      profile.avatar_url;

    image.style.display =
      "block";

    placeholder.style.display =
      "none";

    image.onerror =
      () => {
        image.style.display =
          "none";

        placeholder.style.display =
          "grid";
      };
  } else {
    image.style.display =
      "none";

    placeholder.style.display =
      "grid";
  }
}


async function uploadAvatar(
  userId
) {
  const file =
    el("avatarFile")
      ?.files?.[0];

  if (!file) {
    return null;
  }

  const extension =
    file.name
      .split(".")
      .pop()
      ?.toLowerCase() ||
    "webp";

  const filePath =
    `${userId}/avatar-${Date.now()}.${extension}`;

  const {
    error: uploadError
  } =
    await supabaseClient
      .storage
      .from(
        "avatars"
      )
      .upload(
        filePath,
        file,
        {
          upsert:
            true
        }
      );

  if (uploadError) {
    throw uploadError;
  }

  const {
    data
  } =
    supabaseClient
      .storage
      .from(
        "avatars"
      )
      .getPublicUrl(
        filePath
      );

  return (
    data?.publicUrl ||
    null
  );
}


/* =========================================================
   PROFILE FORM
========================================================= */

async function loadProfilePage() {
  const profile =
    await protectAndRender(
      "login.html"
    );

  if (!profile) {
    return;
  }


  el("displayName").value =
    profile.display_name ||
    profile.full_name ||
    profile.username ||
    "";

  el("email").value =
    profile.email ||
    "";

  el("username").value =
    profile.username ||
    "";

  el("whatsapp").value =
    profile.whatsapp ||
    profile.phone_e164 ||
    "";

  el("academicYear").value =
    profile.academic_year ||
    profile.position ||
    "";

  el("institution").value =
    profile.institution ||
    "";

  renderAvatar(
    profile
  );
}


el("profileForm")
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      setProfileStatus(
        "Saving profile…"
      );

      const {
        data: userData,
        error: userError
      } =
        await supabaseClient
          .auth
          .getUser();

      if (userError) {
        setProfileStatus(
          userError.message,
          true
        );

        return;
      }

      const user =
        userData?.user;

      if (!user) {
        setProfileStatus(
          "Your session has expired. Please sign in again.",
          true
        );

        return;
      }

      const displayName =
        el("displayName")
          ?.value
          ?.trim() ||
        "";

      const whatsapp =
        el("whatsapp")
          ?.value
          ?.trim() ||
        "";

      const position =
        el("academicYear")
          ?.value
          ?.trim() ||
        "";

      const institution =
        el("institution")
          ?.value
          ?.trim() ||
        "";

      if (
        displayName.length < 2
      ) {
        setProfileStatus(
          "Display Name must contain at least 2 characters.",
          true
        );

        return;
      }

      try {
        const avatarUrl =
          await uploadAvatar(
            user.id
          );

        const updates = {
          display_name:
            displayName,

          whatsapp,

          academic_year:
            position,

          institution
        };

        if (avatarUrl) {
          updates.avatar_url =
            avatarUrl;
        }

        const {
          data,
          error
        } =
          await supabaseClient
            .from(
              "profiles"
            )
            .update(
              updates
            )
            .eq(
              "id",
              user.id
            )
            .select("*")
            .single();

        if (error) {
          throw error;
        }

        window.aclCurrentProfile =
          {
            ...window
              .aclCurrentProfile,

            ...data,

            email:
              user.email
          };

        renderAvatar(
          window
            .aclCurrentProfile
        );

        setProfileStatus(
          "Profile saved successfully."
        );
      } catch (error) {
        console.error(
          "PROFILE SAVE ERROR:",
          error
        );

        setProfileStatus(
          error.message ||
          "The profile could not be saved.",
          true
        );
      }
    }
  );


/* =========================================================
   CHANGE PASSWORD
========================================================= */

el("passwordForm")
  ?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      setPasswordStatus(
        ""
      );

      const currentPassword =
        el("currentPassword")
          ?.value ||
        "";

      const newPassword =
        el("profileNewPassword")
          ?.value ||
        "";

      const confirmation =
        el("profileConfirmPassword")
          ?.value ||
        "";

      if (
        newPassword.length < 8
      ) {
        setPasswordStatus(
          "New password must contain at least 8 characters.",
          true
        );

        return;
      }

      if (
        newPassword !==
        confirmation
      ) {
        setPasswordStatus(
          "The new passwords do not match.",
          true
        );

        return;
      }

      try {
        const {
          data: userData,
          error: userError
        } =
          await supabaseClient
            .auth
            .getUser();

        if (userError) {
          throw userError;
        }

        const email =
          userData
            ?.user
            ?.email;

        if (!email) {
          throw new Error(
            "The signed-in email could not be found."
          );
        }

        const {
          error: signInError
        } =
          await supabaseClient
            .auth
            .signInWithPassword({
              email,
              password:
                currentPassword
            });

        if (signInError) {
          throw new Error(
            "The current password is incorrect."
          );
        }

        const {
          error: updateError
        } =
          await supabaseClient
            .auth
            .updateUser({
              password:
                newPassword
            });

        if (updateError) {
          throw updateError;
        }

        event.target.reset();

        setPasswordStatus(
          "Password changed successfully."
        );
      } catch (error) {
        console.error(
          "PASSWORD CHANGE ERROR:",
          error
        );

        setPasswordStatus(
          error.message ||
          "The password could not be changed.",
          true
        );
      }
    }
  );


loadProfilePage();

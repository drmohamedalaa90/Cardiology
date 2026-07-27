import {
  supabaseClient
} from "./supabase-client.js";


export const DEFAULT_ACL_SETTINGS = {
  confidenceEnabled: true,

  lifelinesEnabled: true,

  enabledLifelines: {
    expert: true,
    filter: true,
    guideline: true,
    vault: true
  }
};


function cloneDefaults() {
  return {
    ...DEFAULT_ACL_SETTINGS,

    enabledLifelines: {
      ...DEFAULT_ACL_SETTINGS
        .enabledLifelines
    }
  };
}


export function normalizeAclSettings(
  settings = {}
) {
  const defaults =
    cloneDefaults();

  return {
    confidenceEnabled:
      typeof settings
        ?.confidenceEnabled ===
      "boolean"
        ? settings
            .confidenceEnabled
        : defaults
            .confidenceEnabled,

    lifelinesEnabled:
      typeof settings
        ?.lifelinesEnabled ===
      "boolean"
        ? settings
            .lifelinesEnabled
        : defaults
            .lifelinesEnabled,

    enabledLifelines: {
      expert:
        typeof settings
          ?.enabledLifelines
          ?.expert ===
        "boolean"
          ? settings
              .enabledLifelines
              .expert
          : defaults
              .enabledLifelines
              .expert,

      filter:
        typeof settings
          ?.enabledLifelines
          ?.filter ===
        "boolean"
          ? settings
              .enabledLifelines
              .filter
          : defaults
              .enabledLifelines
              .filter,

      guideline:
        typeof settings
          ?.enabledLifelines
          ?.guideline ===
        "boolean"
          ? settings
              .enabledLifelines
              .guideline
          : defaults
              .enabledLifelines
              .guideline,

      vault:
        typeof settings
          ?.enabledLifelines
          ?.vault ===
        "boolean"
          ? settings
              .enabledLifelines
              .vault
          : defaults
              .enabledLifelines
              .vault
    }
  };
}


async function currentUser() {
  const {
    data,
    error
  } =
    await supabaseClient.auth
      .getSession();

  if (error) {
    throw error;
  }

  const user =
    data.session?.user;

  if (!user) {
    throw new Error(
      "You must sign in before loading settings."
    );
  }

  return user;
}


export async function getAclSettings() {
  const user =
    await currentUser();

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "user_settings"
      )
      .select(
        "settings"
      )
      .eq(
        "user_id",
        user.id
      )
      .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    const settings =
      cloneDefaults();

    const {
      error: insertError
    } =
      await supabaseClient
        .from(
          "user_settings"
        )
        .insert({
          user_id:
            user.id,

          settings
        });

    if (insertError) {
      throw insertError;
    }

    return settings;
  }

  return normalizeAclSettings(
    data.settings
  );
}


export async function saveAclSettings(
  settings
) {
  const user =
    await currentUser();

  const normalized =
    normalizeAclSettings(
      settings
    );

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "user_settings"
      )
      .upsert(
        {
          user_id:
            user.id,

          settings:
            normalized
        },
        {
          onConflict:
            "user_id"
        }
      )
      .select(
        "settings"
      )
      .single();

  if (error) {
    throw error;
  }

  const savedSettings =
    normalizeAclSettings(
      data.settings
    );

  window.dispatchEvent(
    new CustomEvent(
      "acl:settings-changed",
      {
        detail:
          savedSettings
      }
    )
  );

  return savedSettings;
}

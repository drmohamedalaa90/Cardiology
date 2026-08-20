import {
  supabaseClient
} from "./supabase-client.js";


console.log(
  "ACL USER SETTINGS v5.1.0 LOADED"
);


/* =========================================================
   DEFAULT SETTINGS
========================================================= */

export const DEFAULT_ACL_SETTINGS = {
  confidenceEnabled:
    true,

  lifelinesEnabled:
    true,

  enabledLifelines: {
    expert:
      true,

    filter:
      true,

    guideline:
      true,

    vault:
      true
  }
};


/* =========================================================
   INTERNAL STATE
========================================================= */

const settingsState = {
  loadingPromise:
    null,

  savingPromise:
    null,

  cachedUserId:
    "",

  cachedSettings:
    null
};


/* =========================================================
   SETTINGS HELPERS
========================================================= */

function cloneSettings(
  settings
) {
  const normalized =
    normalizeAclSettings(
      settings
    );


  return {
    confidenceEnabled:
      normalized
        .confidenceEnabled,

    lifelinesEnabled:
      normalized
        .lifelinesEnabled,

    enabledLifelines: {
      expert:
        normalized
          .enabledLifelines
          .expert,

      filter:
        normalized
          .enabledLifelines
          .filter,

      guideline:
        normalized
          .enabledLifelines
          .guideline,

      vault:
        normalized
          .enabledLifelines
          .vault
    }
  };
}


function cloneDefaults() {
  return cloneSettings(
    DEFAULT_ACL_SETTINGS
  );
}


export function normalizeAclSettings(
  settings = {}
) {
  const source =
    settings &&
    typeof settings ===
      "object" &&
    !Array.isArray(
      settings
    )
      ? settings
      : {};


  const lifelineSource =
    source.enabledLifelines &&
    typeof source.enabledLifelines ===
      "object" &&
    !Array.isArray(
      source.enabledLifelines
    )
      ? source.enabledLifelines
      : {};


  return {
    confidenceEnabled:
      typeof source
        .confidenceEnabled ===
      "boolean"
        ? source
            .confidenceEnabled
        : DEFAULT_ACL_SETTINGS
            .confidenceEnabled,

    lifelinesEnabled:
      typeof source
        .lifelinesEnabled ===
      "boolean"
        ? source
            .lifelinesEnabled
        : DEFAULT_ACL_SETTINGS
            .lifelinesEnabled,

    enabledLifelines: {
      expert:
        typeof lifelineSource
          .expert ===
        "boolean"
          ? lifelineSource
              .expert
          : DEFAULT_ACL_SETTINGS
              .enabledLifelines
              .expert,

      filter:
        typeof lifelineSource
          .filter ===
        "boolean"
          ? lifelineSource
              .filter
          : DEFAULT_ACL_SETTINGS
              .enabledLifelines
              .filter,

      guideline:
        typeof lifelineSource
          .guideline ===
        "boolean"
          ? lifelineSource
              .guideline
          : DEFAULT_ACL_SETTINGS
              .enabledLifelines
              .guideline,

      vault:
        typeof lifelineSource
          .vault ===
        "boolean"
          ? lifelineSource
              .vault
          : DEFAULT_ACL_SETTINGS
              .enabledLifelines
              .vault
    }
  };
}


/* =========================================================
   USER SESSION
========================================================= */

async function currentUser() {
  const {
    data,
    error
  } =
    await supabaseClient
      .auth
      .getUser();


  if (error) {
    throw error;
  }


  const user =
    data?.user;


  if (!user) {
    throw new Error(
      "You must sign in before loading settings."
    );
  }


  return user;
}


/* =========================================================
   CACHE
========================================================= */

function cacheSettings(
  userId,
  settings
) {
  settingsState.cachedUserId =
    userId;


  settingsState.cachedSettings =
    cloneSettings(
      settings
    );
}


function cachedSettingsFor(
  userId
) {
  if (
    settingsState.cachedUserId !==
      userId ||
    !settingsState.cachedSettings
  ) {
    return null;
  }


  return cloneSettings(
    settingsState.cachedSettings
  );
}


export function clearAclSettingsCache() {
  settingsState.cachedUserId =
    "";


  settingsState.cachedSettings =
    null;


  settingsState.loadingPromise =
    null;


  settingsState.savingPromise =
    null;
}


/* =========================================================
   SETTINGS EVENT
========================================================= */

function dispatchSettingsChanged(
  settings
) {
  const detail =
    cloneSettings(
      settings
    );


  window.dispatchEvent(
    new CustomEvent(
      "acl:settings-changed",
      {
        detail
      }
    )
  );
}


/* =========================================================
   LOAD SETTINGS
========================================================= */

export async function getAclSettings({
  forceRefresh = false
} = {}) {
  const user =
    await currentUser();


  if (!forceRefresh) {
    const cached =
      cachedSettingsFor(
        user.id
      );


    if (cached) {
      return cached;
    }
  }


  if (
    settingsState.loadingPromise
  ) {
    return settingsState
      .loadingPromise;
  }


  settingsState.loadingPromise =
    (async () => {
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


      if (data) {
        const settings =
          normalizeAclSettings(
            data.settings
          );


        cacheSettings(
          user.id,
          settings
        );


        return cloneSettings(
          settings
        );
      }


      const defaults =
        cloneDefaults();


      const {
        data: createdRow,
        error: createError
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
                defaults
            },
            {
              onConflict:
                "user_id",

              ignoreDuplicates:
                false
            }
          )
          .select(
            "settings"
          )
          .single();


      if (createError) {
        throw createError;
      }


      const savedSettings =
        normalizeAclSettings(
          createdRow?.settings ||
          defaults
        );


      cacheSettings(
        user.id,
        savedSettings
      );


      return cloneSettings(
        savedSettings
      );
    })()
      .finally(
        () => {
          settingsState.loadingPromise =
            null;
        }
      );


  return settingsState
    .loadingPromise;
}


/* =========================================================
   SAVE SETTINGS
========================================================= */

export async function saveAclSettings(
  settings
) {
  const user =
    await currentUser();


  const normalized =
    normalizeAclSettings(
      settings
    );


  if (
    settingsState.savingPromise
  ) {
    await settingsState
      .savingPromise;
  }


  settingsState.savingPromise =
    (async () => {
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
          data?.settings ||
          normalized
        );


      cacheSettings(
        user.id,
        savedSettings
      );


      dispatchSettingsChanged(
        savedSettings
      );


      return cloneSettings(
        savedSettings
      );
    })()
      .finally(
        () => {
          settingsState.savingPromise =
            null;
        }
      );


  return settingsState
    .savingPromise;
}


/* =========================================================
   RESET SETTINGS
========================================================= */

export async function resetAclSettings() {
  return saveAclSettings(
    cloneDefaults()
  );
}


/* =========================================================
   AUTH CHANGES
========================================================= */

supabaseClient
  .auth
  .onAuthStateChange(
    (
      event
    ) => {
      if (
        event ===
          "SIGNED_OUT" ||
        event ===
          "USER_DELETED"
      ) {
        clearAclSettingsCache();
      }
    }
  );

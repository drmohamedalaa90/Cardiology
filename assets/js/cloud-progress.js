import {
  supabaseClient
} from "./supabase-client.js";


console.log(
  "ACL CLOUD PROGRESS v2.1.0 LOADED"
);


/* =========================================================
   INTERNAL STATE
========================================================= */

const cloudProgressState = {
  moduleEditionMap:
    null,

  moduleEditionMapPromise:
    null
};


/* =========================================================
   CURRENT USER
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
      "You must sign in before accessing quiz progress."
    );
  }


  return user;
}


/* =========================================================
   VALUE HELPERS
========================================================= */

function safeArray(
  value
) {
  return Array.isArray(
    value
  )
    ? value
    : [];
}


function safeObject(
  value
) {
  return (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  )
    ? value
    : {};
}


function safeNumber(
  value,
  fallback = 0
) {
  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : fallback;
}


/* =========================================================
   ATTEMPT STATE NORMALIZATION
========================================================= */

function normalizeAttemptState(
  state = {},
  lifelinesOverride = null
) {
  const source =
    safeObject(
      state
    );


  const lifelines =
    lifelinesOverride !==
      null
      ? safeObject(
          lifelinesOverride
        )
      : Object.keys(
          safeObject(
            source.lifelinesState
          )
        ).length
        ? safeObject(
            source.lifelinesState
          )
        : safeObject(
            source.lifelines
          );


  const questionIds =
    safeArray(
      source.questionIds ??
      source.question_ids
    );


  const answers =
    safeArray(
      source.answers
    );


  return {
    questionIds,

    currentIndex:
      Math.max(
        0,
        Math.floor(
          safeNumber(
            source.currentIndex ??
            source.current_question_index,
            0
          )
        )
      ),

    answers,

    score:
      safeNumber(
        source.score,
        0
      ),

    correctCount:
      Math.max(
        0,
        Math.floor(
          safeNumber(
            source.correctCount ??
            source.correct_count,
            0
          )
        )
      ),

    incorrectCount:
      Math.max(
        0,
        Math.floor(
          safeNumber(
            source.incorrectCount ??
            source.incorrect_count,
            0
          )
        )
      ),

    timedOutCount:
      Math.max(
        0,
        Math.floor(
          safeNumber(
            source.timedOutCount ??
            source.timed_out_count,
            0
          )
        )
      ),

    confidenceEnabled:
      Boolean(
        source.confidenceEnabled ??
        source.confidence_enabled
      ),

    lifelines
  };
}


/* =========================================================
   EDITION HELPERS
========================================================= */

function normalizeEdition(
  value
) {
  const edition =
    String(
      value ||
      ""
    )
      .trim()
      .toLowerCase();


  return (
    edition ===
      "basic" ||
    edition ===
      "expert"
  )
    ? edition
    : null;
}


function activeEdition() {
  try {
    const parameters =
      new URLSearchParams(
        window.location.search
      );


    const urlEdition =
      normalizeEdition(
        parameters.get(
          "edition"
        )
      );


    if (urlEdition) {
      return urlEdition;
    }


    return normalizeEdition(
      localStorage.getItem(
        "aclSelectedEdition"
      )
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL ACTIVE EDITION READ ERROR:",
      error
    );


    return null;
  }
}


/* =========================================================
   MODULE EDITION MAP
========================================================= */

function moduleMapEntry(
  module
) {
  const edition =
    normalizeEdition(
      module?.edition
    );


  if (!edition) {
    return null;
  }


  return {
    edition,

    title:
      String(
        module?.title ||
        ""
      ),

    id:
      module?.id ??
      null,

    slug:
      String(
        module?.slug ||
        ""
      )
  };
}


async function loadModuleEditionMap({
  forceRefresh = false
} = {}) {
  if (
    !forceRefresh &&
    cloudProgressState
      .moduleEditionMap
  ) {
    return cloudProgressState
      .moduleEditionMap;
  }


  if (
    cloudProgressState
      .moduleEditionMapPromise
  ) {
    return cloudProgressState
      .moduleEditionMapPromise;
  }


  cloudProgressState
    .moduleEditionMapPromise =
      (async () => {
        const {
          data,
          error
        } =
          await supabaseClient
            .from(
              "modules"
            )
            .select(`
              id,
              slug,
              title,
              edition
            `);


        if (error) {
          throw error;
        }


        const map =
          new Map();


        safeArray(
          data
        ).forEach(
          (
            module
          ) => {
            const entry =
              moduleMapEntry(
                module
              );


            if (!entry) {
              return;
            }


            if (
              module.id !==
                null &&
              module.id !==
                undefined
            ) {
              map.set(
                String(
                  module.id
                ),
                entry
              );
            }


            if (module.slug) {
              map.set(
                String(
                  module.slug
                ),
                entry
              );
            }
          }
        );


        cloudProgressState
          .moduleEditionMap =
            map;


        return map;
      })()
        .finally(
          () => {
            cloudProgressState
              .moduleEditionMapPromise =
                null;
          }
        );


  return cloudProgressState
    .moduleEditionMapPromise;
}


export function clearModuleEditionCache() {
  cloudProgressState
    .moduleEditionMap =
      null;


  cloudProgressState
    .moduleEditionMapPromise =
      null;
}


/* =========================================================
   ENRICH ATTEMPTS
========================================================= */

function enrichAttempt(
  attempt,
  moduleMap
) {
  const moduleKey =
    String(
      attempt?.module_id ||
      ""
    );


  const matchedModule =
    moduleMap?.get(
      moduleKey
    ) ||
    null;


  const existingEdition =
    normalizeEdition(
      attempt?.module_edition ||
      attempt?.edition ||
      attempt?.modules?.edition
    );


  return {
    ...attempt,

    module_edition:
      existingEdition ||
      matchedModule?.edition ||
      null,

    module_title:
      attempt?.module_title ||
      attempt?.modules?.title ||
      matchedModule?.title ||
      "ACL Module",

    module_slug:
      attempt?.module_slug ||
      attempt?.modules?.slug ||
      matchedModule?.slug ||
      null
  };
}


async function enrichAttemptSafely(
  attempt
) {
  try {
    const moduleMap =
      await loadModuleEditionMap();


    return enrichAttempt(
      attempt,
      moduleMap
    );
  } catch (
    error
  ) {
    console.warn(
      "ACL ATTEMPT MODULE ENRICHMENT ERROR:",
      error
    );


    return enrichAttempt(
      attempt,
      new Map()
    );
  }
}


/* =========================================================
   GET OPEN ATTEMPT
========================================================= */

export async function getOpenAttempt(
  moduleId,
  quizId = null
) {
  if (!moduleId) {
    throw new Error(
      "A module ID is required to load an open attempt."
    );
  }


  const user =
    await currentUser();


  let query =
    supabaseClient
      .from(
        "quiz_attempts"
      )
      .select(
        "*"
      )
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "module_id",
        moduleId
      )
      .eq(
        "status",
        "in_progress"
      );


  if (
    quizId !==
      null &&
    quizId !==
      undefined &&
    quizId !==
      ""
  ) {
    query =
      query.eq(
        "quiz_id",
        quizId
      );
  } else {
    query =
      query.is(
        "quiz_id",
        null
      );
  }


  const {
    data,
    error
  } =
    await query
      .order(
        "updated_at",
        {
          ascending:
            false
        }
      )
      .limit(
        1
      )
      .maybeSingle();


  if (error) {
    throw error;
  }


  if (!data) {
    return null;
  }


  return enrichAttemptSafely(
    data
  );
}


/* =========================================================
   CREATE ATTEMPT
========================================================= */

export async function createAttempt({
  moduleId,
  moduleTitle,
  quizId = null,
  quizTitle = null,
  mode = "learning",
  questionIds = [],
  lifelines = {}
}) {
  if (!moduleId) {
    throw new Error(
      "A module ID is required to create an attempt."
    );
  }


  const user =
    await currentUser();


  const safeQuestionIds =
    safeArray(
      questionIds
    );


  const safeModuleTitle =
    String(
      moduleTitle ||
      "ACL Module"
    ).trim() ||
    "ACL Module";


  const row = {
    user_id:
      user.id,

    module_id:
      moduleId,

    module_title:
      safeModuleTitle,

    quiz_id:
      quizId,

    quiz_title:
      String(
        quizTitle ||
        safeModuleTitle
      ),

    mode:
      String(
        mode ||
        "learning"
      ),

    question_count:
      safeQuestionIds.length,

    question_ids:
      safeQuestionIds,

    current_question_index:
      0,

    answers:
      [],

    lifelines:
      safeObject(
        lifelines
      ),

    score:
      0,

    status:
      "in_progress"
  };


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "quiz_attempts"
      )
      .insert(
        row
      )
      .select(
        "*"
      )
      .single();


  if (error) {
    /*
     * An open-attempt uniqueness constraint may reject
     * duplicate starts. In that case, recover the existing
     * unfinished attempt instead of creating another one.
     */

    if (
      error.code ===
      "23505"
    ) {
      const existingAttempt =
        await getOpenAttempt(
          moduleId,
          quizId
        );


      if (existingAttempt) {
        return existingAttempt;
      }
    }


    throw error;
  }


  return enrichAttemptSafely(
    data
  );
}


/* =========================================================
   UPDATE ATTEMPT
========================================================= */

async function updateAttempt(
  attemptId,
  updates
) {
  if (!attemptId) {
    throw new Error(
      "An attempt ID is required."
    );
  }


  const user =
    await currentUser();


  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "quiz_attempts"
      )
      .update(
        updates
      )
      .eq(
        "id",
        attemptId
      )
      .eq(
        "user_id",
        user.id
      )
      .select(
        "*"
      )
      .maybeSingle();


  if (error) {
    throw error;
  }


  if (!data) {
    throw new Error(
      "The attempt was not found or does not belong to your account."
    );
  }


  return data;
}


/* =========================================================
   SAVE ATTEMPT
========================================================= */

export async function saveAttempt(
  attemptId,
  state,
  lifelinesOverride = null
) {
  const normalized =
    normalizeAttemptState(
      state,
      lifelinesOverride
    );


  return updateAttempt(
    attemptId,
    {
      question_ids:
        normalized.questionIds,

      current_question_index:
        normalized.currentIndex,

      answers:
        normalized.answers,

      score:
        normalized.score,

      lifelines:
        normalized.lifelines,

      status:
        "in_progress"
    }
  );
}


/* =========================================================
   COMPLETE ATTEMPT
========================================================= */

export async function completeAttempt(
  attemptId,
  state,
  lifelinesOverride = null
) {
  const normalized =
    normalizeAttemptState(
      state,
      lifelinesOverride
    );


  return updateAttempt(
    attemptId,
    {
      question_ids:
        normalized.questionIds,

      current_question_index:
        normalized.currentIndex,

      answers:
        normalized.answers,

      score:
        normalized.score,

      lifelines:
        normalized.lifelines,

      status:
        "completed",

      completed_at:
        new Date()
          .toISOString()
    }
  );
}


/* =========================================================
   LIST ATTEMPTS
========================================================= */

export async function listAttempts({
  edition = activeEdition(),
  includeUnmatched = false,
  forceModuleRefresh = false
} = {}) {
  const user =
    await currentUser();


  const attemptPromise =
    supabaseClient
      .from(
        "quiz_attempts"
      )
      .select(
        "*"
      )
      .eq(
        "user_id",
        user.id
      )
      .order(
        "updated_at",
        {
          ascending:
            false
        }
      );


  const moduleMapPromise =
    loadModuleEditionMap({
      forceRefresh:
        forceModuleRefresh
    })
      .catch(
        (
          error
        ) => {
          console.warn(
            "ACL MODULE EDITION MAP LOAD ERROR:",
            error
          );


          return new Map();
        }
      );


  const [
    attemptResult,
    moduleMap
  ] =
    await Promise.all([
      attemptPromise,
      moduleMapPromise
    ]);


  if (
    attemptResult.error
  ) {
    throw attemptResult.error;
  }


  const selectedEdition =
    normalizeEdition(
      edition
    );


  const enrichedAttempts =
    safeArray(
      attemptResult.data
    ).map(
      (
        attempt
      ) =>
        enrichAttempt(
          attempt,
          moduleMap
        )
    );


  if (!selectedEdition) {
    return enrichedAttempts;
  }


  return enrichedAttempts.filter(
    (
      attempt
    ) => {
      const editionValue =
        normalizeEdition(
          attempt.module_edition
        );


      if (!editionValue) {
        return Boolean(
          includeUnmatched
        );
      }


      return (
        editionValue ===
        selectedEdition
      );
    }
  );
}


/* =========================================================
   AUTH STATE
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
        clearModuleEditionCache();
      }
    }
  );

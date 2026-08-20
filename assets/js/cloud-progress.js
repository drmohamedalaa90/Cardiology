import {
  supabaseClient
} from "./supabase-client.js";


console.log(
  "ACL CLOUD PROGRESS v2.2.0 LOADED"
);


/* =========================================================
   CONSTANTS
========================================================= */

const ACL_META_KEY =
  "_aclMeta";


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
  if (
    Array.isArray(
      value
    )
  ) {
    return value;
  }


  if (
    typeof value ===
      "string"
  ) {
    const trimmed =
      value.trim();


    if (!trimmed) {
      return [];
    }


    try {
      const parsed =
        JSON.parse(
          trimmed
        );


      return Array.isArray(
        parsed
      )
        ? parsed
        : [];
    } catch (
      error
    ) {
      console.warn(
        "ACL ARRAY PARSE ERROR:",
        error
      );
    }
  }


  return [];
}


function safeObject(
  value
) {
  if (
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  ) {
    return value;
  }


  if (
    typeof value ===
      "string"
  ) {
    const trimmed =
      value.trim();


    if (!trimmed) {
      return {};
    }


    try {
      const parsed =
        JSON.parse(
          trimmed
        );


      return (
        parsed &&
        typeof parsed ===
          "object" &&
        !Array.isArray(
          parsed
        )
      )
        ? parsed
        : {};
    } catch (
      error
    ) {
      console.warn(
        "ACL OBJECT PARSE ERROR:",
        error
      );
    }
  }


  return {};
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


function safeNonNegativeNumber(
  value,
  fallback = 0
) {
  return Math.max(
    0,
    safeNumber(
      value,
      fallback
    )
  );
}


function safeInteger(
  value,
  fallback = 0
) {
  return Math.max(
    0,
    Math.floor(
      safeNumber(
        value,
        fallback
      )
    )
  );
}


function safeNullableNumber(
  value
) {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    return null;
  }


  const parsed =
    Number(
      value
    );


  return Number.isFinite(
    parsed
  )
    ? parsed
    : null;
}


function safeString(
  value,
  fallback = ""
) {
  const normalized =
    String(
      value ??
      fallback
    ).trim();


  return (
    normalized ||
    fallback
  );
}


/* =========================================================
   TIMER HELPERS
========================================================= */

function normalizeTimerMode(
  value
) {
  const normalized =
    String(
      value ||
      "none"
    )
      .trim()
      .toLowerCase();


  const aliases = {
    none:
      "none",

    off:
      "none",

    disabled:
      "none",

    quiz:
      "quiz",

    per_quiz:
      "quiz",

    "per-quiz":
      "quiz",

    whole_quiz:
      "quiz",

    question:
      "question",

    per_question:
      "question",

    "per-question":
      "question"
  };


  return (
    aliases[
      normalized
    ] ||
    "none"
  );
}


/* =========================================================
   ANTI-CHEAT HELPERS
========================================================= */

function normalizeFinalViolationAction(
  value
) {
  const normalized =
    String(
      value ||
      "none"
    )
      .trim()
      .toLowerCase();


  if (
    normalized ===
      "terminate" ||
    normalized ===
      "omit"
  ) {
    return normalized;
  }


  return "none";
}


/* =========================================================
   METADATA HELPERS
========================================================= */

function metadataFromLifelines(
  lifelines
) {
  const source =
    safeObject(
      lifelines
    );


  return safeObject(
    source[
      ACL_META_KEY
    ]
  );
}


function cleanLifelines(
  lifelines
) {
  const source = {
    ...safeObject(
      lifelines
    )
  };


  delete source[
    ACL_META_KEY
  ];


  return source;
}


function mergeMetadataIntoLifelines(
  lifelines,
  metadata
) {
  return {
    ...cleanLifelines(
      lifelines
    ),

    [
      ACL_META_KEY
    ]: {
      ...safeObject(
        metadata
      )
    }
  };
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


  const rawLifelines =
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


  const existingMetadata =
    metadataFromLifelines(
      rawLifelines
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


  const activeTimeSeconds =
    safeNonNegativeNumber(
      source.activeTimeSeconds ??
      source.active_time_seconds ??
      source.durationSeconds ??
      source.duration_seconds ??
      existingMetadata.activeTimeSeconds ??
      existingMetadata.durationSeconds,
      0
    );


  const questionTimeSeconds =
    safeNonNegativeNumber(
      source.questionTimeSeconds ??
      source.question_time_seconds ??
      existingMetadata.questionTimeSeconds,
      0
    );


  const metadata = {
    ...existingMetadata,

    correctCount:
      safeInteger(
        source.correctCount ??
        source.correct_count ??
        existingMetadata.correctCount,
        0
      ),

    incorrectCount:
      safeInteger(
        source.incorrectCount ??
        source.incorrect_count ??
        existingMetadata.incorrectCount,
        0
      ),

    timedOutCount:
      safeInteger(
        source.timedOutCount ??
        source.timed_out_count ??
        existingMetadata.timedOutCount,
        0
      ),

    answeredCount:
      safeInteger(
        source.answeredCount ??
        source.answered_count ??
        answers.length,
        answers.length
      ),

    confidenceEnabled:
      Boolean(
        source.confidenceEnabled ??
        source.confidence_enabled ??
        existingMetadata.confidenceEnabled
      ),

    timerMode:
      normalizeTimerMode(
        source.timerMode ??
        source.timer_mode ??
        existingMetadata.timerMode
      ),

    quizDurationSeconds:
      safeNonNegativeNumber(
        source.quizDurationSeconds ??
        source.quiz_duration_seconds ??
        existingMetadata.quizDurationSeconds,
        0
      ),

    defaultQuestionTimeSeconds:
      safeNonNegativeNumber(
        source.defaultQuestionTimeSeconds ??
        source.default_question_time_seconds ??
        existingMetadata.defaultQuestionTimeSeconds,
        0
      ),

    activeTimeSeconds,

    durationSeconds:
      activeTimeSeconds,

    questionTimeSeconds,

    questionStartedAt:
      source.questionStartedAt ??
      source.question_started_at ??
      existingMetadata.questionStartedAt ??
      null,

    quizRemainingSeconds:
      safeNullableNumber(
        source.quizRemainingSeconds ??
        source.quiz_remaining_seconds ??
        existingMetadata.quizRemainingSeconds
      ),

    questionRemainingSeconds:
      safeNullableNumber(
        source.questionRemainingSeconds ??
        source.question_remaining_seconds ??
        existingMetadata.questionRemainingSeconds
      ),

    antiCheatEnabled:
      Boolean(
        source.antiCheatEnabled ??
        source.anti_cheat_enabled ??
        existingMetadata.antiCheatEnabled
      ),

    violationCount:
      safeInteger(
        source.violationCount ??
        source.violation_count ??
        existingMetadata.violationCount,
        0
      ),

    antiCheatPenalty:
      safeNumber(
        source.antiCheatPenalty ??
        source.anti_cheat_penalty ??
        existingMetadata.antiCheatPenalty,
        0
      ),

    antiCheatStatus:
      safeString(
        source.antiCheatStatus ??
        source.anti_cheat_status ??
        existingMetadata.antiCheatStatus,
        "active"
      ),

    finalViolationAction:
      normalizeFinalViolationAction(
        source.finalViolationAction ??
        source.final_violation_action ??
        existingMetadata.finalViolationAction
      ),

    savedAt:
      new Date()
        .toISOString()
  };


  return {
    questionIds,

    currentIndex:
      safeInteger(
        source.currentIndex ??
        source.current_question_index,
        0
      ),

    answers,

    score:
      safeNumber(
        source.score,
        0
      ),

    lifelines:
      cleanLifelines(
        rawLifelines
      ),

    metadata
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
      ),

    launchPath:
      String(
        module?.launch_path ||
        module?.launchPath ||
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
              edition,
              launch_path
            `);


        if (error) {
          /*
           * Some older module tables may not yet contain
           * launch_path. Retry with the confirmed core fields.
           */

          const fallbackResult =
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


          if (
            fallbackResult.error
          ) {
            throw fallbackResult.error;
          }


          return fallbackResult.data;
        }


        return data;
      })()
        .then(
          (
            modules
          ) => {
            const map =
              new Map();


            safeArray(
              modules
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


                if (
                  module.slug
                ) {
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
          }
        )
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


  const lifelines =
    safeObject(
      attempt?.lifelines
    );


  const metadata =
    metadataFromLifelines(
      lifelines
    );


  return {
    ...attempt,

    lifelines:
      cleanLifelines(
        lifelines
      ),

    lifelines_state:
      cleanLifelines(
        lifelines
      ),

    lifelinesState:
      cleanLifelines(
        lifelines
      ),

    module_edition:
      existingEdition ||
      matchedModule?.edition ||
      null,

    edition:
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
      null,

    launch_path:
      attempt?.launch_path ||
      attempt?.module_launch_path ||
      attempt?.modules?.launch_path ||
      matchedModule?.launchPath ||
      null,

    correct_count:
      safeInteger(
        attempt?.correct_count ??
        metadata.correctCount,
        0
      ),

    incorrect_count:
      safeInteger(
        attempt?.incorrect_count ??
        metadata.incorrectCount,
        0
      ),

    timed_out_count:
      safeInteger(
        attempt?.timed_out_count ??
        metadata.timedOutCount,
        0
      ),

    confidence_enabled:
      Boolean(
        attempt?.confidence_enabled ??
        metadata.confidenceEnabled
      ),

    timer_mode:
      normalizeTimerMode(
        attempt?.timer_mode ??
        metadata.timerMode
      ),

    quiz_duration_seconds:
      safeNonNegativeNumber(
        attempt?.quiz_duration_seconds ??
        metadata.quizDurationSeconds,
        0
      ),

    default_question_time_seconds:
      safeNonNegativeNumber(
        attempt?.default_question_time_seconds ??
        metadata.defaultQuestionTimeSeconds,
        0
      ),

    active_time_seconds:
      safeNonNegativeNumber(
        attempt?.active_time_seconds ??
        attempt?.duration_seconds ??
        metadata.activeTimeSeconds ??
        metadata.durationSeconds,
        0
      ),

    duration_seconds:
      safeNonNegativeNumber(
        attempt?.duration_seconds ??
        attempt?.active_time_seconds ??
        metadata.durationSeconds ??
        metadata.activeTimeSeconds,
        0
      ),

    question_time_seconds:
      safeNonNegativeNumber(
        attempt?.question_time_seconds ??
        metadata.questionTimeSeconds,
        0
      ),

    question_started_at:
      attempt?.question_started_at ??
      metadata.questionStartedAt ??
      null,

    quiz_remaining_seconds:
      safeNullableNumber(
        attempt?.quiz_remaining_seconds ??
        metadata.quizRemainingSeconds
      ),

    question_remaining_seconds:
      safeNullableNumber(
        attempt?.question_remaining_seconds ??
        metadata.questionRemainingSeconds
      ),

    anti_cheat_enabled:
      Boolean(
        attempt?.anti_cheat_enabled ??
        metadata.antiCheatEnabled
      ),

    violation_count:
      safeInteger(
        attempt?.violation_count ??
        metadata.violationCount,
        0
      ),

    anti_cheat_penalty:
      safeNumber(
        attempt?.anti_cheat_penalty ??
        metadata.antiCheatPenalty,
        0
      ),

    anti_cheat_status:
      safeString(
        attempt?.anti_cheat_status ??
        metadata.antiCheatStatus,
        "active"
      ),

    final_violation_action:
      normalizeFinalViolationAction(
        attempt?.final_violation_action ??
        metadata.finalViolationAction
      ),

    acl_metadata:
      metadata
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
  lifelines = {},
  state = {}
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


  const normalized =
    normalizeAttemptState(
      {
        ...safeObject(
          state
        ),

        questionIds:
          safeQuestionIds,

        currentIndex:
          0,

        answers:
          []
      },
      lifelines
    );


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
      mergeMetadataIntoLifelines(
        normalized.lifelines,
        normalized.metadata
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
    if (
      error.code ===
      "23505"
    ) {
      const existingAttempt =
        await getOpenAttempt(
          moduleId,
          quizId
        );


      if (
        existingAttempt
      ) {
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


  return enrichAttemptSafely(
    data
  );
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
        mergeMetadataIntoLifelines(
          normalized.lifelines,
          normalized.metadata
        ),

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
        mergeMetadataIntoLifelines(
          normalized.lifelines,
          normalized.metadata
        ),

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
  includeUnmatched = true,
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


  if (
    !selectedEdition
  ) {
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


      if (
        !editionValue
      ) {
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

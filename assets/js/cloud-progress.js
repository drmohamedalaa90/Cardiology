import {
  supabaseClient
} from "./supabase-client.js";


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
      "You must sign in before starting a quiz."
    );
  }

  return user;
}


function normalizeAttemptState(
  state = {},
  lifelinesOverride = null
) {
  const lifelines =
    lifelinesOverride &&
    typeof lifelinesOverride ===
      "object"
      ? lifelinesOverride
      : state.lifelinesState &&
          typeof state.lifelinesState ===
            "object"
        ? state.lifelinesState
        : state.lifelines &&
            typeof state.lifelines ===
              "object"
          ? state.lifelines
          : {};

  return {
    questionIds:
      Array.isArray(
        state.questionIds
      )
        ? state.questionIds
        : [],

    currentIndex:
      Number.isFinite(
        Number(
          state.currentIndex
        )
      )
        ? Number(
            state.currentIndex
          )
        : 0,

    answers:
      Array.isArray(
        state.answers
      )
        ? state.answers
        : [],

    score:
      Number.isFinite(
        Number(
          state.score
        )
      )
        ? Number(
            state.score
          )
        : 0,

    correctCount:
      Number.isFinite(
        Number(
          state.correctCount
        )
      )
        ? Number(
            state.correctCount
          )
        : 0,

    incorrectCount:
      Number.isFinite(
        Number(
          state.incorrectCount
        )
      )
        ? Number(
            state.incorrectCount
          )
        : 0,

    timedOutCount:
      Number.isFinite(
        Number(
          state.timedOutCount
        )
      )
        ? Number(
            state.timedOutCount
          )
        : 0,

    confidenceEnabled:
      Boolean(
        state.confidenceEnabled
      ),

    lifelines
  };
}


export async function getOpenAttempt(
  moduleId,
  quizId = null
) {
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

  if (quizId) {
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
          ascending: false
        }
      )
      .limit(1)
      .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}


export async function createAttempt({
  moduleId,
  moduleTitle,
  quizId = null,
  quizTitle = null,
  mode = "learning",
  questionIds,
  lifelines = {}
}) {
  const user =
    await currentUser();

  const safeQuestionIds =
    Array.isArray(
      questionIds
    )
      ? questionIds
      : [];

  const row = {
    user_id:
      user.id,

    module_id:
      moduleId,

    module_title:
      moduleTitle,

    quiz_id:
      quizId,

    quiz_title:
      quizTitle ||
      moduleTitle,

    mode,

    question_count:
      safeQuestionIds.length,

    question_ids:
      safeQuestionIds,

    current_question_index:
      0,

    answers:
      [],

    lifelines:
      lifelines &&
      typeof lifelines ===
        "object"
        ? lifelines
        : {},

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
      return getOpenAttempt(
        moduleId,
        quizId
      );
    }

    throw error;
  }

  return data;
}


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

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "quiz_attempts"
      )
      .update({
        question_ids:
          normalized
            .questionIds,

        current_question_index:
          normalized
            .currentIndex,

        answers:
          normalized
            .answers,

        score:
          normalized
            .score,

        lifelines:
          normalized
            .lifelines,

        status:
          "in_progress"
      })
      .eq(
        "id",
        attemptId
      )
      .select(
        "*"
      )
      .single();

  if (error) {
    throw error;
  }

  return data;
}


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

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "quiz_attempts"
      )
      .update({
        question_ids:
          normalized
            .questionIds,

        current_question_index:
          normalized
            .currentIndex,

        answers:
          normalized
            .answers,

        score:
          normalized
            .score,

        lifelines:
          normalized
            .lifelines,

        status:
          "completed",

        completed_at:
          new Date()
            .toISOString()
      })
      .eq(
        "id",
        attemptId
      )
      .select(
        "*"
      )
      .single();

  if (error) {
    throw error;
  }

  return data;
}


export async function listAttempts() {
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
          ascending: false
        }
      );

  if (error) {
    throw error;
  }

  return data || [];
}

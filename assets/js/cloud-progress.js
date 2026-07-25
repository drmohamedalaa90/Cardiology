import { supabaseClient } from "./supabase-client.js";

export async function saveAttempt(payload) {
  const { data: sessionData } = await supabaseClient.auth.getSession();
  const user = sessionData.session?.user;
  if (!user) return;

  const { error } = await supabaseClient
    .from("quiz_attempts")
    .upsert({
      user_id: user.id,
      module_id: payload.moduleId,
      question_count: payload.questionCount,
      question_ids: payload.questionIds,
      current_question_index: payload.currentIndex,
      score: payload.score,
      status: payload.status,
      lifelines: payload.lifelines
    });

  if (error) throw error;
}

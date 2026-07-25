import { supabaseClient } from "./supabase-client.js";

async function currentUser() {
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) throw error;
  const user = data.session?.user;
  if (!user) throw new Error("You must sign in before starting a quiz.");
  return user;
}

export async function getOpenAttempt(moduleId) {
  const user = await currentUser();
  const { data, error } = await supabaseClient
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", user.id)
    .eq("module_id", moduleId)
    .eq("status", "in_progress")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createAttempt({ moduleId, moduleTitle, questionIds, lifelines = {} }) {
  const user = await currentUser();
  const row = {
    user_id: user.id,
    module_id: moduleId,
    module_title: moduleTitle,
    question_count: questionIds.length,
    question_ids: questionIds,
    current_question_index: 0,
    answers: [],
    lifelines,
    score: 0,
    status: "in_progress"
  };
  const { data, error } = await supabaseClient
    .from("quiz_attempts")
    .insert(row)
    .select("*")
    .single();
  if (error) {
    if (error.code === "23505") return getOpenAttempt(moduleId);
    throw error;
  }
  return data;
}

export async function saveAttempt(attemptId, state, lifelines = {}) {
  const { data, error } = await supabaseClient
    .from("quiz_attempts")
    .update({
      question_ids: state.questionIds,
      current_question_index: state.currentIndex,
      answers: state.answers,
      score: state.score,
      lifelines,
      status: "in_progress"
    })
    .eq("id", attemptId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function completeAttempt(attemptId, state, lifelines = {}) {
  const { data, error } = await supabaseClient
    .from("quiz_attempts")
    .update({
      question_ids: state.questionIds,
      current_question_index: state.currentIndex,
      answers: state.answers,
      score: state.score,
      lifelines,
      status: "completed",
      completed_at: new Date().toISOString()
    })
    .eq("id", attemptId)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function listAttempts() {
  const user = await currentUser();
  const { data, error } = await supabaseClient
    .from("quiz_attempts")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

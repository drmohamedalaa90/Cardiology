// Merge the returned properties into the object used to insert or update a quiz.
export function getStep37To39QuizSettings() {
  return {
    feedback_mode:
      document.getElementById("feedbackMode").value,

    show_flashcards:
      document.getElementById("showFlashcards").checked,

    show_final_review:
      document.getElementById("showFinalReview").checked,

    require_review_before_next:
      document.getElementById("requireReviewBeforeNext").checked
  };
}

// Example:
// const quizPayload = {
//   title,
//   ...getStep37To39QuizSettings()
// };

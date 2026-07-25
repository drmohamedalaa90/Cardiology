export class QuizEngine {
  constructor({ questions, count = 5, questionIds = null, currentIndex = 0, answers = [] }) {
    const byId = new Map(questions.map((q) => [q.id, q]));
    this.questions = Array.isArray(questionIds) && questionIds.length
      ? questionIds.map((id) => byId.get(id)).filter(Boolean)
      : [...questions].sort(() => Math.random() - 0.5).slice(0, count);
    this.index = Math.min(Math.max(Number(currentIndex) || 0, 0), this.questions.length);
    this.answers = Array.isArray(answers) ? answers : [];
  }

  current() {
    return this.questions[this.index] || null;
  }

  currentAnswer() {
    const q = this.current();
    return q ? this.answers.find((a) => a.questionId === q.id) || null : null;
  }

  answer(choice) {
    const question = this.current();
    if (!question) return false;
    const existing = this.answers.find((item) => item.questionId === question.id);
    if (existing) return existing.correct;
    const correct = Number(choice) === Number(question.answer);
    this.answers.push({
      questionId: question.id,
      choice: Number(choice),
      correct,
      answeredAt: new Date().toISOString()
    });
    return correct;
  }

  next() {
    if (this.index < this.questions.length) this.index += 1;
    return this.current();
  }

  score() {
    return this.answers.filter((item) => item.correct).length;
  }

  state() {
    return {
      questionIds: this.questions.map((q) => q.id),
      currentIndex: this.index,
      answers: this.answers,
      score: this.score()
    };
  }
}

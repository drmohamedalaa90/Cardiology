export class QuizEngine {
  constructor({ questions, count = 5 }) {
    this.questions = [...questions].sort(() => Math.random() - 0.5).slice(0, count);
    this.index = 0;
    this.answers = [];
  }

  current() {
    return this.questions[this.index] || null;
  }

  answer(choice) {
    const question = this.current();
    const correct = choice === question.answer;
    this.answers.push({ questionId: question.id, choice, correct });
    return correct;
  }

  next() {
    this.index += 1;
    return this.current();
  }

  score() {
    return this.answers.filter((item) => item.correct).length;
  }
}

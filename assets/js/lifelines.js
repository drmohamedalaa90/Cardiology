export function availableLifelines(questionCount) {
  return {
    askDrCorazon: true,
    fiftyFifty: questionCount >= 10,
    questionSwap: questionCount >= 20
  };
}

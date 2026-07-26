window.ACL_QUIZ_CONFIG = {
  quizId: "acl-expert-demo-001",
  title: "ACL Expert Edition Demo",
  description: "A demonstration package for scheduled entry, participant verification, eligibility rules, and one-question-at-a-time quiz delivery.",

  // Use ISO 8601 dates. Change these before deployment.
  opensAt: "2026-07-01T08:00:00+03:00",
  closesAt: "2027-07-31T22:00:00+03:00",

  durationMinutes: 15,

  access: {
    type: "public", 
    // Allowed values: "public", "passcode", "minimumScore"
    passcode: "mitral2026",
    minimumAclScore: 70
  },

  behavior: {
    allowResume: true,
    oneActiveAttempt: true,
    randomizeQuestions: false,
    randomizeOptions: false,
    requireAnswerBeforeNext: false
  },

  questions: [
    {
      id: "q1",
      type: "single",
      text: "Which finding most strongly supports hemodynamically significant left main coronary artery disease?",
      scenario: "A 64-year-old patient has exertional angina and an angiographically intermediate distal left main lesion.",
      image: "",
      options: [
        "Minimal luminal area of 8.5 mm² on IVUS",
        "Fractional flow reserve of 0.92",
        "Minimal luminal area of 4.2 mm² on IVUS",
        "Normal pressure damping during catheter engagement"
      ]
    },
    {
      id: "q2",
      type: "single",
      text: "Which feature favors a provisional one-stent strategy in a coronary bifurcation?",
      scenario: "",
      image: "",
      options: [
        "Long, severely diseased side branch",
        "Large side branch with difficult re-access",
        "Short side-branch lesion with preserved flow",
        "Complex distal left main bifurcation with extensive disease in both branches"
      ]
    },
    {
      id: "q3",
      type: "single",
      text: "What is the main purpose of proximal optimization technique after bifurcation stenting?",
      scenario: "",
      image: "",
      options: [
        "To reduce distal vessel diameter",
        "To optimize proximal stent expansion and facilitate side-branch access",
        "To create intentional stent underexpansion",
        "To replace final kissing balloon inflation in every case"
      ]
    }
  ]
};

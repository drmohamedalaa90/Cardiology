/* =========================================================
   ACL EXPERT EDITION
   LEARNING MODE AUTOMATIC THEME — VERSION 1.0.0

   Interventional Cardiology → Red
   Electrocardiography       → Yellow
   Imaging                   → Green
   General Cardiology        → Blue
========================================================= */

const THEME_CLASSES = [
  "learning-theme-intervention",
  "learning-theme-ecg",
  "learning-theme-imaging",
  "learning-theme-general"
];


/* =========================================================
   TEXT HELPERS
========================================================= */

function normalizeText(value = "") {
  return String(value)
    .trim()
    .toLowerCase();
}


function includesAny(
  text,
  keywords
) {
  return keywords.some(
    (keyword) =>
      text.includes(keyword)
  );
}


/* =========================================================
   THEME DETECTION
========================================================= */

function detectLearningTheme(text = "") {
  const searchableText =
    normalizeText(text);


  const isECG =
    includesAny(
      searchableText,
      [
        "ecg",
        "electrocardiograph",
        "electrocardiography",
        "rhythm",
        "arrhythmia",
        "tachycardia",
        "bradycardia",
        "heart block",
        "conduction",
        "atrial fibrillation",
        "ventricular tachycardia"
      ]
    );


  const isImaging =
    includesAny(
      searchableText,
      [
        "imaging",
        "echocardiograph",
        "echocardiography",
        "echo",
        "cardiac ct",
        "coronary ct",
        "ct angiography",
        "ccta",
        "mri",
        "cmr",
        "nuclear imaging",
        "nuclear cardiology",
        "ivus",
        "oct",
        "ultrasound"
      ]
    );


  const isIntervention =
    includesAny(
      searchableText,
      [
        "intervention",
        "interventional",
        "pci",
        "angioplasty",
        "stent",
        "catheter",
        "coronary intervention",
        "bifurcation",
        "left main",
        "calcified lesion",
        "rotablation",
        "atherectomy",
        "cto",
        "structural",
        "tavi",
        "tavr",
        "teer",
        "mitraclip",
        "device closure",
        "asd closure",
        "vsd closure",
        "pda closure",
        "transcatheter"
      ]
    );


  if (isECG) {
    return {
      className:
        "learning-theme-ecg",

      categoryLabel:
        "Electrocardiography"
    };
  }


  if (isImaging) {
    return {
      className:
        "learning-theme-imaging",

      categoryLabel:
        "Imaging"
    };
  }


  if (isIntervention) {
    return {
      className:
        "learning-theme-intervention",

      categoryLabel:
        "Interventional Cardiology"
    };
  }


  return {
    className:
      "learning-theme-general",

    categoryLabel:
      "General Cardiology"
  };
}


/* =========================================================
   APPLY THEME
========================================================= */

function applyLearningTheme() {
  const moduleTitleElement =
    document.getElementById(
      "moduleTitle"
    );

  const quizTitleElement =
    document.getElementById(
      "quizTitle"
    );

  const categoryElement =
    document.querySelector(
      ".learning-module-corner span"
    );


  const moduleTitle =
    moduleTitleElement?.textContent ||
    "";

  const quizTitle =
    quizTitleElement?.textContent ||
    "";

  const pageText = [
    moduleTitle,
    quizTitle,
    document.title,
    window.location.pathname,
    window.location.search
  ]
    .filter(Boolean)
    .join(" ");


  const theme =
    detectLearningTheme(
      pageText
    );


  document.body.classList.remove(
    ...THEME_CLASSES
  );


  document.body.classList.add(
    theme.className
  );


  if (categoryElement) {
    categoryElement.textContent =
      theme.categoryLabel;
  }


  const stage =
    document.querySelector(
      ".learning-stage"
    );


  if (stage) {
    stage.dataset.learningTheme =
      theme.className;
  }
}


/* =========================================================
   WATCH FOR SUPABASE CONTENT
========================================================= */

function startLearningThemeObserver() {
  applyLearningTheme();


  const moduleTitleElement =
    document.getElementById(
      "moduleTitle"
    );

  const quizTitleElement =
    document.getElementById(
      "quizTitle"
    );


  const observer =
    new MutationObserver(
      () => {
        applyLearningTheme();
      }
    );


  if (moduleTitleElement) {
    observer.observe(
      moduleTitleElement,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );
  }


  if (quizTitleElement) {
    observer.observe(
      quizTitleElement,
      {
        childList: true,
        subtree: true,
        characterData: true
      }
    );
  }


  window.addEventListener(
    "popstate",
    applyLearningTheme
  );
}


/* =========================================================
   START
========================================================= */

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    startLearningThemeObserver
  );
} else {
  startLearningThemeObserver();
}

export const PPCI_QUESTIONS = [
  {
    id:
      "ppci-v2-001",

    topic:
      "Reperfusion Strategy",

    stem:
      "A patient with anterior STEMI presents within 90 minutes of symptom onset. Which system-level priority most directly determines whether primary PCI remains the preferred reperfusion strategy?",

    options: [
      "The patient's baseline LDL cholesterol",
      "The expected first-medical-contact-to-device delay",
      "The presence of mild mitral regurgitation",
      "Whether radial access is available",
      "The operator's preferred guide catheter"
    ],

    answer:
      1,

    explanation:
      "The key system-level determinant is whether timely primary PCI can be delivered within guideline-recommended delay targets. The decision between primary PCI and fibrinolysis is therefore strongly influenced by the anticipated delay from first medical contact to PCI-mediated reperfusion.",

    expertHint:
      "Focus on the time-dependent reperfusion decision. The decisive system factor is not a procedural preference or a chronic risk marker; it is whether mechanical reperfusion can be delivered within the accepted first-medical-contact-to-device delay.",

    guidelineHint:
      "Primary PCI is the preferred reperfusion strategy when it can be delivered within the recommended system delay. When timely PCI cannot be achieved in an eligible early presenter, fibrinolysis followed by transfer to a PCI-capable centre may become the appropriate reperfusion pathway.",

    flashcard: {
      type:
        "FLASHCARD",

      title:
        "Primary PCI versus Fibrinolysis in STEMI",

      sections: [
        {
          heading:
            "Core concept",

          bullets: [
            "STEMI reperfusion is a time-critical intervention intended to restore coronary blood flow before irreversible myocardial injury progresses.",
            "Primary PCI is generally the preferred reperfusion strategy when it can be performed rapidly by an experienced team.",
            "The superiority of primary PCI depends on avoiding excessive system-related treatment delay.",
            "The choice is therefore not simply PCI versus fibrinolysis; it is timely PCI versus timely pharmacological reperfusion.",
            "The first-medical-contact-to-device interval is a central system-performance measure."
          ]
        },

        {
          heading:
            "Assessment",

          bullets: [
            "Confirm that the patient has a clinical and electrocardiographic indication for emergency reperfusion.",
            "Record the time of symptom onset because the expected benefit from reperfusion is greatest in early presenters.",
            "Determine whether the first medical contact occurred at a PCI-capable or non-PCI-capable facility.",
            "Estimate transfer time, cath-lab activation time and expected delay to wire crossing or device treatment.",
            "Assess contraindications to fibrinolysis when PCI cannot be delivered promptly."
          ]
        },

        {
          heading:
            "Management",

          bullets: [
            "Proceed directly to primary PCI when guideline-recommended treatment delays can be achieved.",
            "Activate the catheterisation laboratory immediately rather than waiting for unnecessary investigations.",
            "Use organised regional STEMI networks to reduce inter-hospital transfer delay.",
            "Consider fibrinolysis in an eligible early presenter when timely primary PCI cannot be achieved.",
            "After fibrinolysis, transfer the patient to a PCI-capable centre for a pharmacoinvasive strategy.",
            "Perform rescue PCI when fibrinolysis fails or there is persistent ischaemia, instability or inadequate reperfusion."
          ]
        },

        {
          heading:
            "Pitfalls and high-yield points",

          bullets: [
            "Do not allow access-site preference, guide-catheter preference or other secondary procedural details to delay reperfusion.",
            "A theoretically superior treatment can become clinically inferior when delivered too late.",
            "The relevant delay begins at first medical contact, not merely at hospital arrival.",
            "Early diagnosis, pre-hospital ECG transmission and direct cath-lab transfer can substantially shorten treatment delay.",
            "Always distinguish patient-related delay from healthcare-system delay."
          ]
        }
      ]
    }
  },

  {
    id:
      "ppci-v2-002",

    topic:
      "Coronary Thrombus Management",

    stem:
      "During PPCI, angiography shows heavy thrombus but preserved distal flow. Which statement best reflects contemporary evidence regarding routine manual aspiration thrombectomy?",

    options: [
      "It should be performed in every STEMI case",
      "It is routinely preferred before wiring",
      "Routine use is not recommended, but selective bailout use may be considered",
      "It eliminates the risk of distal embolization",
      "It is mandatory before direct stenting"
    ],

    answer:
      2,

    explanation:
      "Large randomized trials did not demonstrate clinical benefit from routine aspiration thrombectomy in unselected STEMI patients and raised concern about harm, including stroke. Routine use is therefore not recommended, although selective bailout aspiration may still be considered in carefully chosen situations.",

    expertHint:
      "Separate routine treatment from selective bailout treatment. A therapy may remain technically useful in an individual case even when large randomized trials do not support applying it routinely to all STEMI patients.",

    guidelineHint:
      "Routine manual thrombus aspiration before primary PCI is not recommended. Selective or bailout aspiration may be considered when there is a large residual thrombus burden, impaired flow or a specific procedural need.",

    flashcard: {
      type:
        "FLASHCARD",

      title:
        "Manual Aspiration Thrombectomy During Primary PCI",

      sections: [
        {
          heading:
            "Definition and rationale",

          bullets: [
            "Manual aspiration thrombectomy uses a catheter to remove intracoronary thrombus during primary PCI.",
            "Its proposed benefits include reducing thrombus burden, distal embolisation and microvascular obstruction.",
            "Early observational experience and smaller studies suggested improved angiographic reperfusion.",
            "This led to widespread use of routine aspiration before definitive PCI.",
            "Later large randomized trials changed the clinical position of the technique."
          ]
        },

        {
          heading:
            "Evidence",

          bullets: [
            "Large trials failed to show a consistent reduction in mortality or major cardiovascular events with routine aspiration.",
            "Routine aspiration did not reliably prevent no-reflow or distal embolisation in unselected patients.",
            "A signal for increased stroke risk contributed to concern about universal use.",
            "The findings demonstrate why improvement in a surrogate angiographic endpoint may not translate into clinical benefit.",
            "Current practice therefore distinguishes routine aspiration from selective bailout aspiration."
          ]
        },

        {
          heading:
            "Selective use",

          bullets: [
            "Bailout aspiration may be considered when a large residual thrombus burden interferes with PCI.",
            "It may be used when thrombus limits visualisation of the distal vessel or lesion anatomy.",
            "It may be considered when there is impaired flow attributable to removable thrombotic material.",
            "The decision should be individualised according to anatomy, thrombus burden and procedural circumstances.",
            "Aspiration should not automatically precede wiring or stent implantation in every STEMI case."
          ]
        },

        {
          heading:
            "Technical and safety considerations",

          bullets: [
            "Maintain careful catheter manipulation to reduce the risk of vessel injury and embolisation.",
            "Avoid deep or forceful engagement that may cause dissection or trauma.",
            "Ensure adequate aspiration before withdrawal and maintain appropriate guide-catheter control.",
            "Do not assume that aspiration eliminates the risk of distal embolisation or no-reflow.",
            "Additional pharmacological and mechanical strategies may still be required when microvascular obstruction occurs."
          ]
        },

        {
          heading:
            "High-yield takeaway",

          bullets: [
            "Routine aspiration thrombectomy is not recommended in unselected primary PCI.",
            "Selective bailout use remains different from routine systematic use.",
            "The presence of thrombus alone does not make aspiration mandatory.",
            "Clinical outcome evidence should take priority over attractive procedural theory.",
            "Remember the exam distinction: not routine, but potentially selective."
          ]
        }
      ]
    }
  }
];

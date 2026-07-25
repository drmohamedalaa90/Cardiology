import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const questionSchema = {
  type: "object",
  additionalProperties: false,
  required: ["questions"],
  properties: {
    questions: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "clinical_scenario",
          "stem",
          "question_type",
          "difficulty",
          "topic",
          "subtopic",
          "explanation",
          "reference_text",
          "default_seconds",
          "options"
        ],
        properties: {
          clinical_scenario: { type: "string" },
          stem: { type: "string" },
          question_type: {
            type: "string",
            enum: ["single_best_answer", "multiple_response", "true_false", "image_based"]
          },
          difficulty: {
            type: "string",
            enum: ["foundation", "intermediate", "advanced", "expert"]
          },
          topic: { type: "string" },
          subtopic: { type: "string" },
          explanation: { type: "string" },
          reference_text: { type: "string" },
          default_seconds: { type: "integer", minimum: 10, maximum: 600 },
          options: {
            type: "array",
            minItems: 2,
            maxItems: 6,
            items: {
              type: "object",
              additionalProperties: false,
              required: ["key", "text", "is_correct"],
              properties: {
                key: { type: "string" },
                text: { type: "string" },
                is_correct: { type: "boolean" }
              }
            }
          }
        }
      }
    }
  }
};

function extractOutputText(response: any): string {
  if (typeof response?.output_text === "string") return response.output_text;
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content?.text === "string") {
        return content.text;
      }
    }
  }
  throw new Error("The AI response did not contain structured output.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Authentication required.");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openAiKey = Deno.env.get("OPENAI_API_KEY");
    const model = Deno.env.get("OPENAI_MODEL") || "gpt-5-mini";

    if (!openAiKey) throw new Error("OPENAI_API_KEY is not configured.");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData?.user) throw new Error("Invalid authenticated session.");

    const { data: isAdmin, error: adminError } = await userClient.rpc("acl_is_admin");
    if (adminError || isAdmin !== true) throw new Error("Administrator access required.");

    const body = await req.json();
    const count = Math.max(1, Math.min(10, Number(body.count || 5)));
    const moduleId = String(body.module_id || "").trim();
    const moduleTitle = String(body.module_title || "").trim();
    const prompt = String(body.prompt || "").trim();
    const referenceContext = String(body.reference_context || "").trim();
    const difficulty = String(body.difficulty || "intermediate");
    const questionType = String(body.question_type || "single_best_answer");

    if (!moduleId || !prompt) throw new Error("Module and prompt are required.");

    const instructions = [
      "You are an expert cardiology assessment writer.",
      `Generate exactly ${count} original questions for the module "${moduleTitle || moduleId}".`,
      `Requested question type: ${questionType}. Requested difficulty: ${difficulty}.`,
      "Use clinically realistic scenarios and unambiguous stems.",
      "Distractors must be plausible but clearly incorrect.",
      "For single-best-answer and true/false questions, exactly one option must be correct.",
      "For multiple-response questions, at least two options must be correct.",
      "Do not fabricate guideline classes, trial names, numerical cutoffs, or references.",
      "When the supplied reference context is insufficient for a precise claim, keep reference_text general and flag the issue in the explanation.",
      "The administrator will review every result before it enters the question bank."
    ].join("\n");

    const userInput = [
      `Author instructions:\n${prompt}`,
      referenceContext ? `Mandatory reference context:\n${referenceContext}` : "No reference context was supplied.",
    ].join("\n\n");

    const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        instructions,
        input: userInput,
        text: {
          format: {
            type: "json_schema",
            name: "acl_question_drafts",
            strict: true,
            schema: questionSchema
          }
        }
      })
    });

    const raw = await openAiResponse.json();
    if (!openAiResponse.ok) {
      throw new Error(raw?.error?.message || "OpenAI request failed.");
    }

    const parsed = JSON.parse(extractOutputText(raw));
    const questions = Array.isArray(parsed?.questions) ? parsed.questions.slice(0, count) : [];
    if (!questions.length) throw new Error("No questions were generated.");

    const serviceClient = createClient(supabaseUrl, serviceRoleKey);
    const rows = questions.map((question: any) => ({
      module_id: moduleId,
      prompt,
      reference_context: referenceContext || null,
      payload: {
        ...question,
        question_type: question.question_type || questionType,
        difficulty: question.difficulty || difficulty
      },
      status: "pending",
      created_by: userData.user.id
    }));

    const { data: created, error: insertError } = await serviceClient
      .from("ai_question_drafts")
      .insert(rows)
      .select("id");

    if (insertError) throw insertError;

    return new Response(JSON.stringify({
      created_count: created?.length || rows.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

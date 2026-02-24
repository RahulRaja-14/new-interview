import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, messages, userTranscripts, topic, durationSeconds, cameraEnabled } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const fullUserText = userTranscripts.join("\n");

    let systemPrompt = "";

    if (type === "gd") {
      systemPrompt = `You are an expert Group Discussion evaluator. Analyze the user's performance in a GD on the topic: "${topic}".

The user's spoken responses (transcribed):
${fullUserText}

Full discussion context:
${messages.map((m: any) => `[${m.speaker || m.role}]: ${m.content}`).join("\n")}

Duration: ${Math.round(durationSeconds)} seconds
Number of user turns: ${userTranscripts.length}

Evaluate the user and return a JSON object with these EXACT fields:
{
  "communication": <1-10 score based on clarity, articulation, vocabulary, coherence>,
  "grammarUsage": <1-10 score based on grammatical correctness>,
  "leadership": <1-10 score based on initiative, guiding discussion, building on points>,
  "confidence": <1-10 score based on assertiveness, conviction, minimal hesitation>,
  "overallGDScore": <1-10 weighted average>,
  "whatWentWell": [<2-4 specific positive observations>],
  "lostPoints": [<2-4 specific areas where points were lost>],
  "improvementTips": [<3-5 actionable improvement suggestions>]
}

Be accurate and fair. If the user barely spoke, scores should reflect that. If they used filler words excessively, grammar score should be lower. Judge based on ACTUAL content quality.`;
    } else {
      systemPrompt = `You are an expert Interview evaluator. Analyze the candidate's performance.

The candidate's spoken responses (transcribed):
${fullUserText}

Full interview conversation:
${messages.map((m: any) => `[${m.role}]: ${m.content}`).join("\n")}

Duration: ${Math.round(durationSeconds)} seconds
Camera was ${cameraEnabled ? "on" : "off"}

Evaluate the candidate and return a JSON object with these EXACT fields:
{
  "grammarAccuracy": <1-10 score based on grammatical correctness>,
  "speechClarity": <1-10 score based on clarity, pace, filler words, articulation>,
  "confidenceLevel": <"Low" | "Medium" | "High">,
  "fearIndicator": <"Low" | "Moderate" | "High">,
  "nonVerbalScore": <1-10, give 7 if camera on, 5 if off>,
  "overallScore": <1-10 weighted average>,
  "strengths": [<2-4 specific strengths observed>],
  "nervousHabits": [<list of nervous habits if any, empty array if none>],
  "grammarIssues": [<specific grammar mistakes found, empty if none>],
  "improvementPlan": [<4-5 actionable improvement steps>]
}

Be accurate and fair. Judge based on ACTUAL content quality, grammar, and communication skills.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Evaluate the session and return the JSON evaluation." }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error("Failed to parse AI evaluation response");
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Evaluate Session Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

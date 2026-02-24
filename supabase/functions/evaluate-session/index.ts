// Modern Deno.serve doesn't require an explicit import from std/http
export { };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      type,
      messages,
      userTranscripts,
      topic,
      durationSeconds,
      cameraEnabled,
      resumeText,
      jobDescription,
      userInitiativeCount
    } = await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const fullUserText = userTranscripts.join("\n");

    let systemPrompt = "";

    if (type === "gd") {
      systemPrompt = `You are a highly selective Group Discussion Assessor. Analyze the user's performance in a GD on the topic: "${topic}".

USER INITIATIVE: 
- The user initiated the conversation ${userInitiativeCount || 0} times within a 5-second silence window.

USER TRANSCRIPT:
${fullUserText}

FULL DISCUSSION CONTEXT:
${messages.map((m: any) => `[${m.speaker || m.role}]: ${m.content}`).join("\n")}

DURATION: ${Math.round(durationSeconds)} seconds
TURNS: ${userTranscripts.length}

EVALUATION CRITERIA & RUBRIC (1-10):
- Communication: Clarity, articulation, and coherence. (1-3: Unclear/Stuttering, 4-6: Understandable but simple, 7-10: Eloquent/Fluent)
- Grammar Usage: Correctness of sentence structure and tense.
- Leadership: Influencing the discussion, guiding others, and quality of points.
- Confidence: Lack of hesitation, strong voice, and assertiveness.
- Initiative: Scoring high if userInitiativeCount is high and points were relevant.
- Listening Ability: How well the user responded to or built upon points made by other participants (Priya, Rahul, Ananya).
- Topic Accuracy: Relevance of points to "${topic}".

RETURN FORMAT: JSON
{
  "communication": number,
  "grammarUsage": number,
  "leadership": number,
  "confidence": number,
  "initiative": number,
  "listeningAbility": number,
  "topicAccuracy": number,
  "overallGDScore": number,
  "whatWentWell": ["Point 1 with quote evidence", "Point 2 with quote evidence"],
  "lostPoints": ["Reason 1 with explanation", "Reason 2 with explanation"],
  "improvementTips": ["Tip 1", "Tip 2", "Tip 3"]
}

STRICT RULE: Be extremely critical. If the user barely spoke or gave generic points, scores must be low. Provide specific quotes from the transcript to justify your "whatWentWell" and "lostPoints" sections.`;
    } else {
      systemPrompt = `You are a Senior Technical Recruiter. Analyze the candidate's interview performance for a role matching the provided context.

TARGET JOB CONTEXT:
${jobDescription || "Standard professional role"}

CANDIDATE RESUME:
${resumeText || "No resume provided"}

CANDIDATE RESPONSES:
${fullUserText}

FULL INTERVIEW LOG:
${messages.map((m: any) => `[${m.role}]: ${m.content}`).join("\n")}

DURATION: ${Math.round(durationSeconds)} seconds
CAMERA: ${cameraEnabled ? "Enabled (Analyze non-verbal posture/eye-contact indicators if possible from tone)" : "Disabled"}

Evaluate the candidate and return a JSON object with these EXACT fields:
{
  "grammarAccuracy": <1-10 score based on grammatical correctness>,
  "speechClarity": <1-10 score based on clarity, pace, filler words, articulation, and conversational flow>,
  "problemSolving": <1-10 score based on their responses to on-spot scenario questions>,
  "behavioralFit": <1-10 score based on HR/cultural fit and behavioral answers>,
  "confidenceLevel": <"Low" | "Medium" | "High">,
  "fearIndicator": <"Low" | "Moderate" | "High">,
  "nonVerbalScore": <1-10 based on eye contact, posture, and facial expressions (from tone/webcam logs if camera on)>,
  "overallScore": <1-10 weighted average reflecting real-world employability>,
  "strengths": [<2-4 specific strengths observed, citing examples>],
  "nervousHabits": [<list of nervous habits detected>],
  "grammarIssues": [<specific grammar mistakes found>],
  "improvementPlan": [<4-5 actionable steps targeting their specific weaknesses>]
}

Be accurate and fair. Judge based on ACTUAL content quality, especially their ability to handle real-time problem-solving scenarios and their overall conversational flow.
STRICT RULE: Cite specific examples from the candidate's answers to justify the scores. Be honest and rigorous.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: "Provide a detailed, evidence-based evaluation of the session in JSON format." }
        ],
        max_tokens: 1500,
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

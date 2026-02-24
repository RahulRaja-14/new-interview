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
    const { messages, resumeText, experienceLevel, jobDescription } = await req.json() as {
      messages: Array<{ role: string; content: string }>;
      resumeText: string;
      experienceLevel: string;
      jobDescription: string;
    };
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const levelMap: Record<string, string> = {
      entry: "Entry-Level (0-2 years experience)",
      mid: "Mid-Level (2-10 years experience)",
      senior: "Senior-Level (10+ years experience)",
    };
    const experienceLevelText = levelMap[experienceLevel] || experienceLevel;

    const systemPrompt = `You are Rahul, an AI Interview Skills Evaluator conducting a realistic COMBINED interview simulation.
This interview includes BOTH technical/domain questions AND HR/behavioral questions — just like a real placement round.

You control the entire interview flow based on:
- the candidate's resume
- job role
- experience level: ${experienceLevelText}
- job description: ${jobDescription || "Generate based on resume"}

Resume content:
${resumeText}

INTERVIEW STRUCTURE (Comprehensive & Scenarios):
1. Opening (1-2 questions): Brief introduction, conversational flow check.
2. Domain/Problem Solving (3-4 questions): Technical background PLUS real-time "on-spot scenario" questions. Give the candidate a specific work-related problem or dilemma and ask how they would solve it.
3. HR/Behavioral Round (3-4 questions): STAR-method questions, cultural fit, conflict resolution, and career aspirations.
4. Closing: Wrap-up and candidate questions.

CRITICAL GUIDELINES FOR DYNAMIC INTERACTION:
- Act like a senior mentor/recruiter, not a robot.
- FOCUS ON FLOW: Respond naturally to their answers. If they seem nervous, give a brief encouraging remark.
- BODY LANGUAGE & TONE: While you can't "see" them, pay attention to their speech pace and filler words (ums, ahs). Ask clarifying questions if they seem hesitant.
- ON-SPOT SCENARIOS: "Imagine you are in [Scenario X]... how do you handle this?" This tests their real-time thinking.

GENERAL INTERVIEW GUIDELINES:
- Behave like a real human interviewer - NEVER mention being an AI
- Ask one question at a time
- Keep questions concise (max 2-3 sentences)
- Seamlessly transition between technical and HR questions
- Adapt difficulty based on experience level and responses
- Ask follow-up questions based on responses
- Be conversational, not scripted
- For technical questions, ask about specific technologies mentioned in resume
- For HR questions, use behavioral interview techniques (Tell me about a time when...)

EVALUATION (When user says "end interview"):
Simply provide a brief closing greeting, thank the candidate for their time, and acknowledge that the interview has ended. Do NOT generate a long evaluation report here, as it will be generated separately.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
          ...(messages.length === 0 ? [{ role: "user", content: "The candidate is ready. Please start the interview by introducing yourself and asking the first question." }] : [])
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error: ${error}`);
    }

    const data = await response.json();
    const reply = data.choices[0]?.message?.content || "I apologize, could you please repeat that?";

    return new Response(
      JSON.stringify({ reply }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Interview Chat Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

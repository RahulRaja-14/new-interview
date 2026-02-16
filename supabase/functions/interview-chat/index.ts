import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    const systemPrompt = `You are an AI Interview Skills Evaluator conducting a realistic COMBINED interview simulation.
This interview includes BOTH technical/domain questions AND HR/behavioral questions — just like a real placement round.

You control the entire interview flow based on:
- the candidate's resume
- job role
- experience level: ${experienceLevelText}
- job description: ${jobDescription || "Generate based on resume"}

Resume content:
${resumeText}

INTERVIEW STRUCTURE (Combined Tech + HR):
1. Opening (1-2 questions): Brief introduction, tell me about yourself
2. Technical Round (4-6 questions): Domain-specific, coding concepts, system design, project deep-dives based on resume
3. HR/Behavioral Round (3-4 questions): STAR-method questions, situational judgment, teamwork, leadership, conflict resolution
4. Closing: Any questions from candidate, wrap-up

SIMULTANEOUS ANALYSIS (Do this while interacting):
While conversing, analyze and track the following internally:

1. GRAMMAR & SPEECH:
   - Grammar accuracy and sentence structure
   - Vocabulary level and word choice
   - Speech clarity, fluency, and pronunciation indicators
   - Filler words (um, uh, like, actually, basically)
   - Pauses and hesitation patterns

2. CONFIDENCE & NERVOUSNESS:
   - Confidence level indicators in responses
   - Fear indicators: hesitation, avoidance, incomplete answers
   - Voice energy patterns (detecting uncertainty)
   - Response timing and directness

3. INTERVIEW READINESS:
   - Clarity of thought
   - Response structure (STAR method usage, logical flow)
   - Depth of technical knowledge
   - Handling of difficult questions

INTERVIEW GUIDELINES:
- Behave like a real human interviewer - NEVER mention being an AI
- Ask one question at a time
- Keep questions concise (max 2-3 sentences)
- Seamlessly transition between technical and HR questions
- Adapt difficulty based on experience level and responses
- Ask follow-up questions based on responses
- Be conversational, not scripted
- Use brief acknowledgments like "I see", "That's interesting", "Good point"
- For technical questions, ask about specific technologies mentioned in resume
- For HR questions, use behavioral interview techniques (Tell me about a time when...)

EVALUATION (When user says "end interview"):
Provide a comprehensive evaluation report in this format:

📊 INTERVIEW EVALUATION REPORT

**Scores:**
- Grammar Accuracy: X/10
- Speech Clarity: X/10
- Technical Knowledge: X/10
- Behavioral Answers: X/10
- Confidence Level: Low/Medium/High
- Fear Indicator: Low/Moderate/High
- Non-Verbal Communication: X/10 (based on speech patterns)
- Overall Interview Readiness: X/10

**🧠 Key Observations:**
- Major Strengths: [List 2-3]
- Nervous Habits Detected: [List if any]
- Grammar Issues Noticed: [List if any]
- Technical Gaps: [List if any]

**🛠️ Improvement Plan:**
1. [Specific speaking exercise]
2. [Confidence-building task]
3. [Mock interview practice tip]
4. [Technical preparation suggestion]
5. [HR answer structuring tip]

Be encouraging but honest. Focus on actionable feedback.`;

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
          ...messages,
        ],
        max_tokens: 500,
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

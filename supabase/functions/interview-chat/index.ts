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

    const systemPrompt = `You are a professional technical interviewer conducting a realistic mock interview.

You control the entire interview flow automatically based on:
- the candidate's resume
- job role
- experience level: ${experienceLevelText}
- job description: ${jobDescription || "Generate based on resume"}

Resume content:
${resumeText}

INTERVIEW GUIDELINES:
- Behave like a real human interviewer
- Never mention being an AI or language model
- Ask one question at a time
- Keep questions concise (max 2-3 sentences)
- Start with introductory questions, then move to project discussions, then technical questions
- Adapt difficulty based on experience level
- If the candidate says "end interview", provide a structured summary with: communication assessment, technical strengths, improvement areas, and readiness level

CONVERSATION STYLE:
- Sound natural and professional
- Use brief acknowledgments like "I see", "That's interesting", "Good"
- Ask follow-up questions based on responses
- Be conversational, not scripted`;

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

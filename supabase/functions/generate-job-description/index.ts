import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { resumeText, experienceLevel } = await req.json() as { resumeText: string; experienceLevel: string };
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

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional HR specialist. Generate a realistic job description based on the candidate's resume and experience level. The job description should be relevant to their skills and background. Keep it concise (200-300 words) and include: Job Title, Company Overview (fictional), Key Responsibilities, Required Qualifications, and Nice-to-haves.`,
          },
          {
            role: "user",
            content: `Generate a job description for a ${experienceLevelText} position based on this resume:\n\n${resumeText}`,
          },
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error: ${error}`);
    }

    const data = await response.json();
    const jobDescription = data.choices[0]?.message?.content || "Unable to generate job description.";

    return new Response(
      JSON.stringify({ jobDescription }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Generate JD Error:", error);
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

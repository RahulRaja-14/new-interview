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
    const { messages, topic, participants, turnCount, isStart, isAIInitiating } = await req.json() as {
      messages: Array<{ role: string; content: string; speaker?: string }>;
      topic: string;
      participants: Array<{ name: string; style: string }>;
      turnCount: number;
      isStart?: boolean;
      isAIInitiating?: boolean;
    };

    interface ChatCompletionResponse {
      choices: Array<{
        message: {
          content: string;
        };
      }>;
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const participantsList = participants.map(p => `${p.name} (${p.style})`).join(", ");

    const systemPrompt = `You are an AI Group Discussion Evaluator simulating a realistic GD environment.

TOPIC: ${topic}

PARTICIPANTS: ${participantsList}

YOUR ROLE:
- Simulate a realistic group discussion panel
- Act as both moderator and other participants (Priya, Rahul, Ananya)
- Each participant has a distinct personality:
  * Priya: Analytical, data-driven, asks probing questions
  * Rahul: Assertive, sometimes interrupts, confident opinions
  * Ananya: Balanced, diplomatic, builds on others' points

GD GUIDELINES:
1. TOPIC ADHERENCE:
   - Carefully monitor every participant's input (especially the user's) for relevance to "${topic}".
   - If the user's last response is irrelevant, off-topic, or nonsensical relative to the discussion, set "isOffTopic" to true in the response.
   - The Moderator MUST intervene if anyone deviates. 
   - CRITICAL: The Moderator MUST explicitly name or address the person who is off-topic.
   - Intervention Style (User): "Wait, candidate, I think you're straying from the topic. Let's get back to ${topic}." or "Let's try to keep our discussion focused on ${topic}."
   - Intervention Style (AI): "Rahul, that's an interesting point, but it seems a bit off-topic. Let's stick to ${topic}."

2. CONTINUITY:
${isStart ? `
- The Moderator MUST clearly introduce the topic: "${topic}".
- The Moderator MUST explicitly state the rules and conclude with a phrase like "The floor is now open for discussion. Who would like to initiate?"
- Return exactly 1 response: Moderator intro.
` : isAIInitiating ? `
- Since the user did not speak yet, pick one participant (Priya, Rahul, or Ananya) to start.
- They should start with a strong opening point related to "${topic}".
- Return exactly 1 response: The participant's opening point.
` : `
- Based on what the user said, have 1-2 participants respond.
- Participants should react naturally, showing they are LISTENING and STAYING ON TOPIC.
  * Build on the user's points or challenge them respectfully.
  * Occasionally ask the user questions to test their knowledge.
- Keep responses concise (2-3 sentences each).
`}

${turnCount >= 7 ? `
The GD should end soon. Have the Moderator wrap up and thank participants.
Set shouldEnd to true.
` : ""}

RESPONSE FORMAT:
Return a JSON object with:
{
  "responses": [
    { "speaker": "Participant Name or Moderator", "content": "What they say" }
  ],
  "shouldEnd": false,
  "isOffTopic": boolean (true ONLY if the user's last message was off-topic)
}

Keep the discussion dynamic and engaging. Challenge the user's points constructively.`;

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
          ...messages.map(m => ({
            role: m.role === "user" ? "user" : "assistant",
            content: m.speaker ? `[${m.speaker}]: ${m.content}` : m.content
          })),
          ...(isStart ? [] : isAIInitiating ? [{ role: "user", content: "No one has spoken yet. One participant should start the discussion now." }] : [{ role: "user", content: "Generate participant responses to continue the GD." }])
        ],
        max_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error: ${error}`);
    }

    const data = await response.json() as ChatCompletionResponse;
    const content = data.choices[0]?.message?.content || '{"responses":[],"shouldEnd":false}';

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {
        responses: [{ speaker: "Moderator", content: "Let's continue with our discussion." }],
        shouldEnd: false
      };
    }

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("GD Chat Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

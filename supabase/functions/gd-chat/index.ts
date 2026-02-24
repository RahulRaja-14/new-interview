import { corsHeaders } from "../_shared/cors.ts";

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
${isAIInitiating ? `
AI INITIATING THE GD:
- Since the user did not speak yet, pick one participant (Priya, Rahul, or Ananya) to start.
- They should start with a strong opening point related to "${topic}".
- Return exactly 1 response: The participant's opening point.
` : `
CONTINUING THE GD:
- Based on what the user said, have 1-2 participants respond
- Participants should react naturally, showing they are LISTENING:
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
  "shouldEnd": false
}

Keep the discussion dynamic and engaging. Challenge the user's points constructively.`;

    // Prepare messages for Gemini, ensuring role alternation
    const geminiMessages = messages.map(m => ({
      role: m.role === "user" ? "user" : "assistant",
      content: m.speaker ? `[${m.speaker}]: ${m.content}` : m.content
    }));

    const instruction = isAIInitiating
      ? "No one has spoken yet. One participant (Priya, Rahul, or Ananya) should take the initiative and start the discussion now."
      : "Generate participant responses to continue the GD naturally.";

    // Logic to prevent consecutive 'user' or 'assistant' roles
    if (geminiMessages.length > 0 && geminiMessages[geminiMessages.length - 1].role === "user") {
      // Append instruction to last user message content
      geminiMessages[geminiMessages.length - 1].content += `\n\nInstruction: ${instruction}`;
    } else {
      // Add a new user message for the instruction
      geminiMessages.push({ role: "user", content: instruction });
    }

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
          ...geminiMessages
        ],
        max_tokens: 500,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`AI API error: ${error}`);
    }

    const data = await response.json();
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

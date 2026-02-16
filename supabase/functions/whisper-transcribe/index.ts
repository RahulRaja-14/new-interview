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
    const HF_ACCESS_TOKEN = Deno.env.get("HF_ACCESS_TOKEN");
    if (!HF_ACCESS_TOKEN) {
      throw new Error("HF_ACCESS_TOKEN not configured");
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      throw new Error("No audio file provided");
    }

    const audioBytes = await audioFile.arrayBuffer();

    // Call Hugging Face Whisper large-v3 model
    const response = await fetch(
      "https://api-inference.huggingface.co/models/openai/whisper-large-v3",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${HF_ACCESS_TOKEN}`,
          "Content-Type": audioFile.type || "audio/webm",
        },
        body: new Uint8Array(audioBytes),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HF API error:", response.status, errorText);
      
      // Handle model loading
      if (response.status === 503) {
        return new Response(
          JSON.stringify({ text: "", loading: true, error: "Model is loading, please try again in a moment." }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`Hugging Face API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    const transcribedText = result.text || "";

    return new Response(
      JSON.stringify({ text: transcribedText.trim() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Whisper Transcription Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

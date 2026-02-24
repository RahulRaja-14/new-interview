// Modern Deno.serve doesn't require an explicit import from std/http
export { };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("No file provided");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    let resumeText = "";

    // For plain text files, read directly
    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      resumeText = await file.text();
    } else {
      // For PDF/DOC/DOCX, convert to base64 and use Gemini to extract text
      const arrayBuffer = await file.arrayBuffer();
      const uint8 = new Uint8Array(arrayBuffer);

      // Convert to base64 in chunks to avoid stack overflow
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        const chunk = uint8.subarray(i, Math.min(i + chunkSize, uint8.length));
        binary += String.fromCharCode(...chunk);
      }
      const base64Data = btoa(binary);

      // Determine MIME type
      let mimeType = file.type || "application/pdf";
      if (file.name.endsWith(".pdf")) mimeType = "application/pdf";
      else if (file.name.endsWith(".docx")) mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (file.name.endsWith(".doc")) mimeType = "application/msword";

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-1.5-flash",
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extract ALL text content from this resume document. Return ONLY the raw text content exactly as it appears - including name, contact info, education, skills, experience, projects, certifications, and any other sections. Do not summarize or restructure. Preserve the original structure as much as possible."
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`
                  }
                }
              ]
            }
          ],
          max_tokens: 4000,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Gemini API error:", error);
        throw new Error(`AI extraction failed: ${error}`);
      }

      const data = await response.json();
      resumeText = data.choices?.[0]?.message?.content || "";
    }

    if (!resumeText || resumeText.trim().length < 20) {
      resumeText = `Resume file: ${file.name}. The text could not be extracted. Please describe your background verbally during the interview.`;
    }

    return new Response(
      JSON.stringify({ resumeText }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Parse Resume Error:", error);
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

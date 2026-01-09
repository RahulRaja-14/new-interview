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
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      throw new Error("No file provided");
    }

    // For now, we'll extract text from the file
    // In a production app, you'd use a proper PDF parser
    const text = await file.text();
    
    // If it's binary (PDF), we'll use a simple extraction or return placeholder
    let resumeText = text;
    
    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      // For PDF files, we'll do basic text extraction
      // This is a simplified approach - in production use a proper PDF library
      resumeText = text.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").trim();
      
      if (resumeText.length < 100) {
        // If extraction failed, create a placeholder based on filename
        resumeText = `Resume file: ${file.name}. Please describe your background verbally during the interview.`;
      }
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

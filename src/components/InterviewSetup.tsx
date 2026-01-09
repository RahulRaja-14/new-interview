import { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { ExperienceLevelCard, ExperienceLevel } from "@/components/ExperienceLevelCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Sparkles, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface InterviewSetupProps {
  onStartInterview: (data: {
    resumeFile: File;
    resumeText: string;
    experienceLevel: ExperienceLevel;
    jobDescription: string;
  }) => void;
}

export function InterviewSetup({ onStartInterview }: InterviewSetupProps) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState<string>("");
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [jobDescriptionMode, setJobDescriptionMode] = useState<"paste" | "generate" | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [isGeneratingJD, setIsGeneratingJD] = useState(false);
  const [isParsingResume, setIsParsingResume] = useState(false);

  const { toast } = useToast();

  const canStartInterview = resumeFile && experienceLevel && resumeText && jobDescription;

  const handleFileSelect = async (file: File | null) => {
    setResumeFile(file);
    if (!file) {
      setResumeText("");
      return;
    }

    setIsParsingResume(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-resume`,
        {
          method: "POST",
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const data = await response.json();
      if (data.resumeText) {
        setResumeText(data.resumeText);
      }
    } catch (error) {
      console.error("Failed to parse resume:", error);
      toast({
        variant: "destructive",
        title: "Failed to parse resume",
        description: "Please try uploading again or use a different file format.",
      });
    } finally {
      setIsParsingResume(false);
    }
  };

  const handleGenerateJobDescription = async () => {
    if (!resumeText || !experienceLevel) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please upload a resume and select experience level first.",
      });
      return;
    }

    setIsGeneratingJD(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-job-description", {
        body: { resumeText, experienceLevel },
      });

      if (error) throw error;

      setJobDescription(data.jobDescription);
      toast({
        title: "Job Description Generated",
        description: "AI has created a relevant job description based on your resume.",
      });
    } catch (error) {
      console.error("Failed to generate JD:", error);
      toast({
        variant: "destructive",
        title: "Generation Failed",
        description: "Failed to generate job description. Please try again.",
      });
    } finally {
      setIsGeneratingJD(false);
    }
  };

  const handleStart = () => {
    if (resumeFile && experienceLevel && resumeText && jobDescription) {
      onStartInterview({
        resumeFile,
        resumeText,
        experienceLevel,
        jobDescription,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            AI Voice Interview
          </h1>
          <p className="text-muted-foreground">
            Upload your resume and start a face-to-face voice interview with AI.
          </p>
        </div>

        {/* Resume Upload */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            1. Resume File
          </h2>
          <FileUpload
            onFileSelect={handleFileSelect}
            selectedFile={resumeFile}
            accept=".pdf,.doc,.docx,.txt"
          />
          {isParsingResume && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Parsing resume...
            </div>
          )}
        </div>

        {/* Experience Level */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            2. Your Experience Level
          </h2>
          <div className="space-y-3">
            <ExperienceLevelCard
              level="entry"
              title="Entry-Level"
              description="Students & recent graduates. Less than 2 years of work experience."
              isSelected={experienceLevel === "entry"}
              onSelect={() => setExperienceLevel("entry")}
            />
            <ExperienceLevelCard
              level="mid"
              title="Mid-Level"
              description="You have between 2 and 10 years of relevant work experience."
              isSelected={experienceLevel === "mid"}
              onSelect={() => setExperienceLevel("mid")}
            />
            <ExperienceLevelCard
              level="senior"
              title="Senior-Level"
              description="You have more than 10 years of relevant work experience."
              isSelected={experienceLevel === "senior"}
              onSelect={() => setExperienceLevel("senior")}
            />
          </div>
        </div>

        {/* Job Description */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            3. Job Description
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setJobDescriptionMode("paste");
                setJobDescription("");
              }}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200 ${
                jobDescriptionMode === "paste"
                  ? "bg-secondary border-primary text-foreground"
                  : "bg-secondary/50 border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              <FileText className="h-4 w-4" />
              Paste Description
            </button>
            <button
              type="button"
              onClick={() => {
                setJobDescriptionMode("generate");
                handleGenerateJobDescription();
              }}
              disabled={!resumeText || !experienceLevel || isGeneratingJD}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${
                jobDescriptionMode === "generate"
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-primary/90 border-primary text-primary-foreground hover:bg-primary"
              }`}
            >
              {isGeneratingJD ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Generate with AI
            </button>
          </div>

          {(jobDescriptionMode === "paste" || (jobDescriptionMode === "generate" && jobDescription)) && (
            <Textarea
              placeholder={
                jobDescriptionMode === "paste"
                  ? "Paste the job description here..."
                  : "AI generated job description will appear here..."
              }
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[180px] bg-secondary border-border focus:border-primary resize-none"
              readOnly={jobDescriptionMode === "generate" && isGeneratingJD}
            />
          )}

          {jobDescriptionMode === "generate" && isGeneratingJD && (
            <div className="p-4 rounded-lg bg-secondary/50 border border-border flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">
                AI is generating a relevant job description based on your resume...
              </p>
            </div>
          )}
        </div>

        {/* Start Button */}
        <Button
          onClick={handleStart}
          disabled={!canStartInterview}
          className="w-full py-6 text-lg font-semibold bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Voice Interview
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>

        <p className="text-center text-xs text-muted-foreground">
          The interview will be conducted via voice. Make sure your microphone is enabled.
        </p>
      </div>
    </div>
  );
}

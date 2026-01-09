import { useState } from "react";
import { FileUpload } from "@/components/ui/file-upload";
import { ExperienceLevelCard, ExperienceLevel } from "@/components/ExperienceLevelCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Sparkles, FileText } from "lucide-react";

interface InterviewSetupProps {
  onStartInterview: (data: {
    resume: File;
    experienceLevel: ExperienceLevel;
    jobDescription: string | null;
  }) => void;
}

export function InterviewSetup({ onStartInterview }: InterviewSetupProps) {
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [experienceLevel, setExperienceLevel] = useState<ExperienceLevel | null>(null);
  const [jobDescriptionMode, setJobDescriptionMode] = useState<"paste" | "generate" | null>(null);
  const [jobDescription, setJobDescription] = useState("");

  const canStartInterview = resumeFile && experienceLevel;

  const handleStart = () => {
    if (resumeFile && experienceLevel) {
      onStartInterview({
        resume: resumeFile,
        experienceLevel,
        jobDescription: jobDescriptionMode === "paste" ? jobDescription : null,
      });
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Upload Resume & Job
          </h1>
          <p className="text-muted-foreground">
            Upload your resume and job description to get started.
          </p>
        </div>

        {/* Resume Upload */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            1. Resume File
          </h2>
          <FileUpload
            onFileSelect={setResumeFile}
            selectedFile={resumeFile}
            accept=".pdf,.doc,.docx"
          />
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
              onClick={() => setJobDescriptionMode("paste")}
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
              onClick={() => setJobDescriptionMode("generate")}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all duration-200 ${
                jobDescriptionMode === "generate"
                  ? "bg-primary border-primary text-primary-foreground"
                  : "bg-primary/90 border-primary text-primary-foreground hover:bg-primary"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </button>
          </div>

          {jobDescriptionMode === "paste" && (
            <Textarea
              placeholder="Paste the job description here..."
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="min-h-[120px] bg-secondary border-border focus:border-primary resize-none"
            />
          )}

          {jobDescriptionMode === "generate" && (
            <div className="p-4 rounded-lg bg-secondary/50 border border-border">
              <p className="text-sm text-muted-foreground">
                AI will generate a relevant job description based on your resume and experience level.
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
          Start Interview
          <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </div>
    </div>
  );
}

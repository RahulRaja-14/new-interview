import { useState } from "react";
import { InterviewSetup } from "@/components/InterviewSetup";
import { VoiceInterview } from "@/components/VoiceInterview";
import { ExperienceLevel } from "@/components/ExperienceLevelCard";

interface InterviewData {
  resumeFile: File;
  resumeText: string;
  experienceLevel: ExperienceLevel;
  jobDescription: string;
}

const Index = () => {
  const [interviewData, setInterviewData] = useState<InterviewData | null>(null);
  const [isInterviewActive, setIsInterviewActive] = useState(false);

  const handleStartInterview = (data: InterviewData) => {
    setInterviewData(data);
    setIsInterviewActive(true);
  };

  const handleEndInterview = () => {
    setIsInterviewActive(false);
    setInterviewData(null);
  };

  if (isInterviewActive && interviewData) {
    return (
      <VoiceInterview
        resumeText={interviewData.resumeText}
        experienceLevel={interviewData.experienceLevel}
        jobDescription={interviewData.jobDescription}
        onEndInterview={handleEndInterview}
      />
    );
  }

  return <InterviewSetup onStartInterview={handleStartInterview} />;
};

export default Index;

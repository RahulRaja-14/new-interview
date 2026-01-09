import { useState } from "react";
import { InterviewSetup } from "@/components/InterviewSetup";
import { InterviewChat } from "@/components/InterviewChat";
import { ExperienceLevel } from "@/components/ExperienceLevelCard";

interface InterviewData {
  resume: File;
  experienceLevel: ExperienceLevel;
  jobDescription: string | null;
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

  if (isInterviewActive) {
    return <InterviewChat onEndInterview={handleEndInterview} />;
  }

  return <InterviewSetup onStartInterview={handleStartInterview} />;
};

export default Index;

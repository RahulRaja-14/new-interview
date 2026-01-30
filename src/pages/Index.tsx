import { useState } from "react";
import { ModuleSelector } from "@/components/ModuleSelector";
import { InterviewSetup } from "@/components/InterviewSetup";
import { VoiceInterview } from "@/components/VoiceInterview";
import { GroupDiscussion } from "@/components/GroupDiscussion";
import { EvaluationReport, InterviewEvaluation, GDEvaluation } from "@/components/EvaluationReport";
import { ExperienceLevel } from "@/components/ExperienceLevelCard";
import { GDTopicSelector } from "@/components/GDTopicSelector";

interface InterviewData {
  resumeFile: File;
  resumeText: string;
  experienceLevel: ExperienceLevel;
  jobDescription: string;
}

type AppState = 
  | { screen: "module-select" }
  | { screen: "interview-setup" }
  | { screen: "interview-active"; data: InterviewData }
  | { screen: "interview-result"; evaluation: InterviewEvaluation }
  | { screen: "gd-topic-select" }
  | { screen: "gd-active"; topic: string }
  | { screen: "gd-result"; evaluation: GDEvaluation };

const Index = () => {
  const [appState, setAppState] = useState<AppState>({ screen: "module-select" });

  const handleModuleSelect = (module: "interview" | "gd") => {
    if (module === "interview") {
      setAppState({ screen: "interview-setup" });
    } else {
      setAppState({ screen: "gd-topic-select" });
    }
  };

  const handleStartInterview = (data: InterviewData) => {
    setAppState({ screen: "interview-active", data });
  };

  const handleEndInterview = (evaluation?: InterviewEvaluation) => {
    if (evaluation) {
      setAppState({ screen: "interview-result", evaluation });
    } else {
      setAppState({ screen: "module-select" });
    }
  };

  const handleStartGD = (topic: string) => {
    setAppState({ screen: "gd-active", topic });
  };

  const handleEndGD = (evaluation: GDEvaluation) => {
    setAppState({ screen: "gd-result", evaluation });
  };

  const handleBackToModules = () => {
    setAppState({ screen: "module-select" });
  };

  const handleRestartInterview = () => {
    setAppState({ screen: "interview-setup" });
  };

  const handleRestartGD = () => {
    setAppState({ screen: "gd-topic-select" });
  };

  // Render based on current state
  switch (appState.screen) {
    case "module-select":
      return <ModuleSelector onSelectModule={handleModuleSelect} />;

    case "interview-setup":
      return (
        <InterviewSetup 
          onStartInterview={handleStartInterview}
        />
      );

    case "interview-active":
      return (
        <VoiceInterview
          resumeText={appState.data.resumeText}
          experienceLevel={appState.data.experienceLevel}
          jobDescription={appState.data.jobDescription}
          onEndInterview={handleEndInterview}
        />
      );

    case "interview-result":
      return (
        <EvaluationReport
          evaluation={appState.evaluation}
          onRestart={handleRestartInterview}
          onBackToModules={handleBackToModules}
        />
      );

    case "gd-topic-select":
      return (
        <GDTopicSelector
          onSelectTopic={handleStartGD}
          onCancel={handleBackToModules}
        />
      );

    case "gd-active":
      return (
        <GroupDiscussion
          topic={appState.topic}
          onEndDiscussion={handleEndGD}
          onCancel={handleBackToModules}
        />
      );

    case "gd-result":
      return (
        <EvaluationReport
          evaluation={appState.evaluation}
          onRestart={handleRestartGD}
          onBackToModules={handleBackToModules}
        />
      );

    default:
      return <ModuleSelector onSelectModule={handleModuleSelect} />;
  }
};

export default Index;

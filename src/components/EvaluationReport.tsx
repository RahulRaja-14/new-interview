import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  MessageSquare,
  Volume2,
  Eye,
  Brain,
  Target,
  Users
} from "lucide-react";

export interface InterviewEvaluation {
  type: "interview";
  grammarAccuracy: number;
  speechClarity: number;
  confidenceLevel: "Low" | "Medium" | "High";
  fearIndicator: "Low" | "Moderate" | "High";
  nonVerbalScore: number;
  overallScore: number;
  strengths: string[];
  nervousHabits: string[];
  grammarIssues: string[];
  improvementPlan: string[];
}

export interface GDEvaluation {
  type: "gd";
  communication: number;
  grammarUsage: number;
  leadership: number;
  confidence: number;
  initiative: number;
  listeningAbility: number;
  topicAccuracy: number;
  overallGDScore: number;
  whatWentWell: string[];
  lostPoints: string[];
  improvementTips: string[];
}

type EvaluationType = InterviewEvaluation | GDEvaluation;

interface EvaluationReportProps {
  evaluation: EvaluationType;
  onRestart: () => void;
  onBackToModules: () => void;
}

function ScoreCard({ label, score, icon: Icon }: { label: string; score: number; icon: React.ElementType }) {
  const getScoreColor = (score: number) => {
    if (score >= 8) return "text-green-500";
    if (score >= 6) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <Progress value={score * 10} className="w-20 h-2" />
        <span className={`font-bold ${getScoreColor(score)}`}>{score}/10</span>
      </div>
    </div>
  );
}

function LevelBadge({ level, type }: { level: string; type: "confidence" | "fear" }) {
  const getVariant = () => {
    if (type === "confidence") {
      if (level === "High") return "default";
      if (level === "Medium") return "secondary";
      return "destructive";
    } else {
      if (level === "Low") return "default";
      if (level === "Moderate") return "secondary";
      return "destructive";
    }
  };

  return <Badge variant={getVariant()}>{level}</Badge>;
}

export function EvaluationReport({ evaluation, onRestart, onBackToModules }: EvaluationReportProps) {
  if (evaluation.type === "interview") {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              📊 Interview Evaluation Report
            </h1>
            <p className="text-muted-foreground">
              Your comprehensive interview performance analysis
            </p>
          </div>

          {/* Overall Score */}
          <Card className="border-primary/50 bg-gradient-to-br from-primary/10 to-background">
            <CardContent className="p-6 text-center">
              <div className="text-6xl font-bold text-primary mb-2">
                {evaluation.overallScore}/10
              </div>
              <p className="text-muted-foreground">Overall Interview Readiness</p>
            </CardContent>
          </Card>

          {/* Scores Grid */}
          <div className="grid gap-3">
            <ScoreCard label="Grammar Accuracy" score={evaluation.grammarAccuracy} icon={MessageSquare} />
            <ScoreCard label="Speech Clarity" score={evaluation.speechClarity} icon={Volume2} />
            <ScoreCard label="Non-Verbal Communication" score={evaluation.nonVerbalScore} icon={Eye} />
          </div>

          {/* Confidence & Fear */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="text-sm">Confidence Level</span>
                </div>
                <LevelBadge level={evaluation.confidenceLevel} type="confidence" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  <span className="text-sm">Fear Indicator</span>
                </div>
                <LevelBadge level={evaluation.fearIndicator} type="fear" />
              </CardContent>
            </Card>
          </div>

          {/* Key Observations */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Target className="h-5 w-5 text-primary" />
                🧠 Key Observations
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Major Strengths
                </h4>
                <ul className="space-y-1">
                  {evaluation.strengths.map((strength, i) => (
                    <li key={i} className="text-sm text-muted-foreground pl-6">• {strength}</li>
                  ))}
                </ul>
              </div>

              {evaluation.nervousHabits.length > 0 && (
                <div>
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    Nervous Habits Detected
                  </h4>
                  <ul className="space-y-1">
                    {evaluation.nervousHabits.map((habit, i) => (
                      <li key={i} className="text-sm text-muted-foreground pl-6">• {habit}</li>
                    ))}
                  </ul>
                </div>
              )}

              {evaluation.grammarIssues.length > 0 && (
                <div>
                  <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-red-500" />
                    Grammar Issues Noticed
                  </h4>
                  <ul className="space-y-1">
                    {evaluation.grammarIssues.map((issue, i) => (
                      <li key={i} className="text-sm text-muted-foreground pl-6">• {issue}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Improvement Plan */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5 text-primary" />
                🛠️ Improvement Plan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.improvementPlan.map((tip, i) => (
                  <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                    <span className="text-primary font-bold">{i + 1}.</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-4">
            <Button onClick={onRestart} className="flex-1">
              <RotateCcw className="h-4 w-4 mr-2" />
              Practice Again
            </Button>
            <Button onClick={onBackToModules} variant="outline" className="flex-1">
              Back to Modules
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // GD Evaluation
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            📊 GD Scorecard
          </h1>
          <p className="text-muted-foreground">
            Your Group Discussion performance analysis
          </p>
        </div>

        {/* Overall Score */}
        <Card className="border-primary/50 bg-gradient-to-br from-primary/10 to-background">
          <CardContent className="p-6 text-center">
            <div className="text-6xl font-bold text-primary mb-2">
              {evaluation.overallGDScore}/10
            </div>
            <p className="text-muted-foreground">Overall GD Score</p>
          </CardContent>
        </Card>

        {/* Scores Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ScoreCard label="Communication" score={evaluation.communication} icon={MessageSquare} />
          <ScoreCard label="Grammar Usage" score={evaluation.grammarUsage} icon={Volume2} />
          <ScoreCard label="Leadership" score={evaluation.leadership} icon={Users} />
          <ScoreCard label="Confidence" score={evaluation.confidence} icon={Brain} />
          <ScoreCard label="Initiative" score={evaluation.initiative} icon={TrendingUp} />
          <ScoreCard label="Listening Ability" score={evaluation.listeningAbility} icon={Users} />
          <ScoreCard label="Topic Accuracy" score={evaluation.topicAccuracy} icon={Target} />
        </div>

        {/* Feedback */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-primary" />
              🧠 Feedback
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                What You Did Well
              </h4>
              <ul className="space-y-1">
                {evaluation.whatWentWell.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground pl-6">• {item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Where You Lost Points
              </h4>
              <ul className="space-y-1">
                {evaluation.lostPoints.map((item, i) => (
                  <li key={i} className="text-sm text-muted-foreground pl-6">• {item}</li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-medium text-foreground mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                How to Improve
              </h4>
              <ul className="space-y-1">
                {evaluation.improvementTips.map((tip, i) => (
                  <li key={i} className="text-sm text-muted-foreground pl-6">• {tip}</li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button onClick={onRestart} className="flex-1">
            <RotateCcw className="h-4 w-4 mr-2" />
            Practice Again
          </Button>
          <Button onClick={onBackToModules} variant="outline" className="flex-1">
            Back to Modules
          </Button>
        </div>
      </div>
    </div>
  );
}

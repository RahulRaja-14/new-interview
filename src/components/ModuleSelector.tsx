import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mic, Users, Target, Brain, Eye, MessageSquare } from "lucide-react";

interface ModuleSelectorProps {
  onSelectModule: (module: "interview" | "gd") => void;
}

export function ModuleSelector({ onSelectModule }: ModuleSelectorProps) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold text-foreground">
            AI Interview Skill Evaluator
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Practice and improve your interview skills with AI-powered evaluation.
            Get real-time feedback on grammar, confidence, and non-verbal communication.
          </p>
        </div>

        {/* Module Cards */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Interview Module */}
          <Card 
            className="group cursor-pointer border-2 border-border hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            onClick={() => onSelectModule("interview")}
          >
            <CardContent className="p-6 space-y-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Mic className="h-7 w-7 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  Interview Simulation
                </h2>
                <p className="text-muted-foreground">
                  Face-to-face AI interview with comprehensive skill evaluation
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Grammar & Speech Analysis
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Brain className="h-4 w-4 text-primary" />
                  Confidence & Fear Detection
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4 text-primary" />
                  Face Recognition & Non-verbal Cues
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  Interview Readiness Score
                </div>
              </div>

              <Button className="w-full mt-4 group-hover:bg-primary">
                Start Interview Module
              </Button>
            </CardContent>
          </Card>

          {/* GD Module */}
          <Card 
            className="group cursor-pointer border-2 border-border hover:border-primary transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
            onClick={() => onSelectModule("gd")}
          >
            <CardContent className="p-6 space-y-4">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Users className="h-7 w-7 text-primary" />
              </div>
              
              <div className="space-y-2">
                <h2 className="text-2xl font-semibold text-foreground">
                  Group Discussion
                </h2>
                <p className="text-muted-foreground">
                  Simulate real GD environment with AI participants
                </p>
              </div>

              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Communication Clarity
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Brain className="h-4 w-4 text-primary" />
                  Logical Thinking & Ideas
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Target className="h-4 w-4 text-primary" />
                  Leadership & Initiative
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 text-primary" />
                  Handling Interruptions
                </div>
              </div>

              <Button className="w-full mt-4 group-hover:bg-primary">
                Start GD Module
              </Button>
            </CardContent>
          </Card>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Both modules require microphone and camera access for comprehensive evaluation.
        </p>
      </div>
    </div>
  );
}

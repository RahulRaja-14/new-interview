import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Sparkles, MessageSquare } from "lucide-react";

interface GDTopicSelectorProps {
  onSelectTopic: (topic: string) => void;
  onCancel: () => void;
}

const SUGGESTED_TOPICS = [
  {
    category: "Current Affairs",
    topics: [
      "Is AI a threat to employment?",
      "Work from home vs Work from office",
      "Should social media be regulated?",
      "Climate change: Individual vs Government responsibility"
    ]
  },
  {
    category: "Business & Technology",
    topics: [
      "Startups vs Corporate jobs for freshers",
      "Cryptocurrency: Future of finance or speculation?",
      "Is data privacy a myth in the digital age?",
      "Electric vehicles: Hype or the future of transportation?"
    ]
  },
  {
    category: "Social Issues",
    topics: [
      "Is reservation system still relevant?",
      "Online education vs Traditional classroom",
      "Should voting be made mandatory?",
      "Brain drain: Loss or gain for India?"
    ]
  },
  {
    category: "Abstract Topics",
    topics: [
      "Is the pen mightier than the sword?",
      "Change is the only constant",
      "Actions speak louder than words",
      "Jack of all trades or master of one?"
    ]
  }
];

export function GDTopicSelector({ onSelectTopic, onCancel }: GDTopicSelectorProps) {
  const [customTopic, setCustomTopic] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const handleCustomSubmit = () => {
    if (customTopic.trim()) {
      onSelectTopic(customTopic.trim());
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Choose GD Topic</h1>
            <p className="text-muted-foreground">
              Select a topic for your group discussion simulation
            </p>
          </div>
        </div>

        {/* Custom Topic Input */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Enter your own topic..."
                  value={customTopic}
                  onChange={(e) => setCustomTopic(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCustomSubmit()}
                />
              </div>
              <Button onClick={handleCustomSubmit} disabled={!customTopic.trim()}>
                <Sparkles className="h-4 w-4 mr-2" />
                Use This Topic
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground">
          — or choose from suggested topics —
        </div>

        {/* Topic Categories */}
        <div className="grid gap-6">
          {SUGGESTED_TOPICS.map((category) => (
            <div key={category.category} className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {category.category}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {category.topics.map((topic) => (
                  <Card
                    key={topic}
                    className="group cursor-pointer hover:border-primary transition-colors"
                    onClick={() => onSelectTopic(topic)}
                  >
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-start gap-3">
                        <MessageSquare className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <span className="text-sm text-foreground">{topic}</span>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tips */}
        <Card className="bg-secondary/30">
          <CardContent className="p-4">
            <h4 className="font-medium text-foreground mb-2">💡 GD Tips</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Start with a strong opening point that sets the direction</li>
              <li>• Listen actively and build on others' points</li>
              <li>• Stay calm when interrupted and wait for your turn</li>
              <li>• Use data and examples to support your arguments</li>
              <li>• Summarize key points near the end if possible</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

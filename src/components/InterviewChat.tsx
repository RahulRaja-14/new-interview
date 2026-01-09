import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic, MicOff, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "interviewer" | "candidate";
  content: string;
  timestamp: Date;
}

interface InterviewChatProps {
  onEndInterview: () => void;
}

export function InterviewChat({ onEndInterview }: InterviewChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "interviewer",
      content: "Hello! Thank you for joining today's interview. I've reviewed your resume and I'm excited to learn more about your experience. Before we begin, let me briefly explain the format: we'll start with some introductory questions, then discuss your projects in detail, and finally move into technical questions specific to your role. Are you ready to get started?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "candidate",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Simulate interviewer response
    setTimeout(() => {
      const responses = [
        "That's a great answer. Can you elaborate on the technical challenges you faced during that project?",
        "Interesting! How did you approach problem-solving in that situation?",
        "I appreciate the detail. Now, let's move on to discuss your experience with the technologies mentioned in your resume.",
        "Could you walk me through your decision-making process when you chose that particular approach?",
        "That's helpful context. Tell me more about how you collaborated with your team on this.",
      ];

      const interviewerMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "interviewer",
        content: responses[Math.floor(Math.random() * responses.length)],
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, interviewerMessage]);
      setIsTyping(false);
    }, 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between bg-card">
        <div className="flex items-center gap-4">
          <button
            onClick={onEndInterview}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-muted-foreground" />
          </button>
          <div>
            <h1 className="font-semibold text-foreground">Mock Interview</h1>
            <p className="text-sm text-muted-foreground">Technical Interview Session</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-muted-foreground">In Progress</span>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-4 max-w-3xl",
              message.role === "candidate" ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <div
              className={cn(
                "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                message.role === "interviewer"
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-foreground"
              )}
            >
              {message.role === "interviewer" ? "AI" : "You"}
            </div>
            <div
              className={cn(
                "rounded-2xl px-4 py-3 max-w-xl",
                message.role === "interviewer"
                  ? "bg-card border border-border"
                  : "bg-primary text-primary-foreground"
              )}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>
            </div>
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-4 max-w-3xl">
            <div className="h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
              AI
            </div>
            <div className="rounded-2xl px-4 py-3 bg-card border border-border">
              <div className="flex gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="h-2 w-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        <div className="max-w-3xl mx-auto flex gap-3">
          <button
            onClick={toggleRecording}
            className={cn(
              "p-3 rounded-lg transition-all duration-200",
              isRecording
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "bg-secondary text-muted-foreground hover:text-foreground"
            )}
          >
            {isRecording ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your response..."
            className="flex-1 min-h-[48px] max-h-32 resize-none bg-secondary border-border focus:border-primary"
            rows={1}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            className="px-4 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-3">
          Press Enter to send • Shift + Enter for new line • Say "end interview" to finish
        </p>
      </div>
    </div>
  );
}

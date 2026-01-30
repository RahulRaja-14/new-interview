import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, Users, Volume2, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WebcamFeed } from "@/components/WebcamFeed";
import { GDEvaluation } from "@/components/EvaluationReport";
import { analyzeSpeech, calculateConfidenceIndicators } from "@/components/SpeechAnalyzer";

interface Message {
  role: "user" | "assistant" | "participant";
  content: string;
  speaker?: string;
}

interface GroupDiscussionProps {
  topic: string;
  onEndDiscussion: (evaluation: GDEvaluation) => void;
  onCancel: () => void;
}

const PARTICIPANTS = [
  { name: "Priya", style: "analytical" },
  { name: "Rahul", style: "assertive" },
  { name: "Ananya", style: "balanced" },
];

export function GroupDiscussion({ topic, onEndDiscussion, onCancel }: GroupDiscussionProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [userTranscripts, setUserTranscripts] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [turnCount, setTurnCount] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
    const win = window as any;
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast({
        variant: "destructive",
        title: "Speech Recognition Not Supported",
        description: "Please use Chrome or Edge browser.",
      });
      return null;
    }

    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    return recognition;
  }, [toast]);

  // Text to speech
  const speak = useCallback(async (text: string, speaker: string) => {
    setIsSpeaking(true);
    setCurrentSpeaker(speaker);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          // Use different voices for different speakers
          body: JSON.stringify({ 
            text, 
            voiceId: speaker === "Moderator" ? "JBFqnCBsd6RMkjVDRZzb" :
                     speaker === "Priya" ? "EXAVITQu4vr4xnSDxMaL" :
                     speaker === "Rahul" ? "TX3LPaxmHKxFdv7VOQHJ" :
                     "XrExE9yKIg1WjnnlVkGX"
          }),
        }
      );

      if (!response.ok) throw new Error("TTS failed");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
      }
    } catch (error) {
      console.error("TTS Error:", error);
      setIsSpeaking(false);
      setCurrentSpeaker(null);
    }
  }, []);

  // Get GD response from AI
  const getGDResponse = useCallback(async (userMessage: string) => {
    setIsProcessing(true);

    const newMessages: Message[] = [
      ...messages, 
      { role: "user", content: userMessage, speaker: "You" }
    ];
    setMessages(newMessages);
    setUserTranscripts(prev => [...prev, userMessage]);

    try {
      const { data, error } = await supabase.functions.invoke("gd-chat", {
        body: {
          messages: newMessages,
          topic,
          participants: PARTICIPANTS,
          turnCount,
        },
      });

      if (error) throw error;

      const responses = data.responses as Array<{ speaker: string; content: string }>;
      
      // Add AI participant responses
      const updatedMessages = [...newMessages];
      for (const resp of responses) {
        updatedMessages.push({ 
          role: "participant", 
          content: resp.content, 
          speaker: resp.speaker 
        });
      }
      
      setMessages(updatedMessages);
      setIsProcessing(false);
      setTurnCount(prev => prev + 1);

      // Speak the responses
      for (const resp of responses) {
        await speak(resp.content, resp.speaker);
      }

      // Check if GD should end (after ~8-10 turns)
      if (turnCount >= 7 || data.shouldEnd) {
        endGD();
      }
    } catch (error) {
      console.error("GD Error:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Failed to get response. Please try again.",
      });
      setIsProcessing(false);
    }
  }, [messages, topic, turnCount, speak, toast]);

  // Start GD
  const startGD = useCallback(async () => {
    setIsStarted(true);
    setStartTime(Date.now());
    setCameraActive(true);

    try {
      const { data, error } = await supabase.functions.invoke("gd-chat", {
        body: {
          messages: [],
          topic,
          participants: PARTICIPANTS,
          turnCount: 0,
          isStart: true,
        },
      });

      if (error) throw error;

      const responses = data.responses as Array<{ speaker: string; content: string }>;
      
      setMessages(responses.map(r => ({ 
        role: "participant" as const, 
        content: r.content, 
        speaker: r.speaker 
      })));

      // Speak moderator intro
      for (const resp of responses) {
        await speak(resp.content, resp.speaker);
      }
    } catch (error) {
      console.error("Start GD Error:", error);
      toast({
        variant: "destructive",
        title: "Failed to Start",
        description: "Could not start group discussion. Please try again.",
      });
      setIsStarted(false);
    }
  }, [topic, speak, toast]);

  // End GD and generate evaluation
  const endGD = useCallback(async () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setCameraActive(false);

    const durationSeconds = (Date.now() - startTime) / 1000;
    const speechMetrics = analyzeSpeech(userTranscripts, durationSeconds);
    const confidenceIndicators = calculateConfidenceIndicators(speechMetrics, durationSeconds);

    // Calculate scores based on participation and speech quality
    const participationScore = Math.min(10, Math.round(userTranscripts.length * 1.5));
    const grammarScore = Math.max(4, 10 - speechMetrics.grammarIssues.length);
    const communicationScore = Math.min(10, Math.round(
      (speechMetrics.averageWordsPerMinute >= 120 && speechMetrics.averageWordsPerMinute <= 160) ? 8 : 6
    ) + (speechMetrics.fillerCount < 5 ? 2 : 0));

    const evaluation: GDEvaluation = {
      type: "gd",
      communication: communicationScore,
      grammarUsage: grammarScore,
      leadership: Math.min(10, participationScore + (userTranscripts.length > 3 ? 2 : 0)),
      confidence: confidenceIndicators.confidenceLevel === "High" ? 9 :
                  confidenceIndicators.confidenceLevel === "Medium" ? 7 : 5,
      overallGDScore: Math.round((communicationScore + grammarScore + participationScore + 
                      (confidenceIndicators.confidenceLevel === "High" ? 9 : 7)) / 4),
      whatWentWell: [
        userTranscripts.length >= 3 ? "Good participation - spoke multiple times" : "Participated in discussion",
        speechMetrics.fillerCount < 5 ? "Clear speech with minimal filler words" : "Engaged actively",
        "Stayed on topic throughout the discussion"
      ],
      lostPoints: [
        ...(speechMetrics.grammarIssues.length > 0 ? ["Some grammar issues in responses"] : []),
        ...(userTranscripts.length < 3 ? ["Could have participated more actively"] : []),
        ...(speechMetrics.fillerCount > 5 ? ["Excessive use of filler words"] : [])
      ],
      improvementTips: [
        "Practice speaking on diverse topics daily",
        "Read newspapers to improve vocabulary and current affairs knowledge",
        "Join debate clubs or discussion groups for more practice",
        "Work on reducing filler words by pausing instead"
      ]
    };

    onEndDiscussion(evaluation);
  }, [startTime, userTranscripts, onEndDiscussion]);

  // Handle speech recognition
  useEffect(() => {
    if (!isStarted) return;

    const recognition = initSpeechRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;

    recognition.onresult = (event: any) => {
      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setCurrentTranscript(interimTranscript || finalTranscript);

      if (finalTranscript && !isSpeaking && !isProcessing) {
        setCurrentTranscript("");
        getGDResponse(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "aborted") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (isListening && isStarted && !isSpeaking) {
        recognition.start();
      }
    };

    return () => recognition.stop();
  }, [isStarted, isListening, isSpeaking, isProcessing, getGDResponse, initSpeechRecognition]);

  // Audio ended handler
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsSpeaking(false);
      setCurrentSpeaker(null);
      
      if (isStarted && recognitionRef.current) {
        setIsListening(true);
        try {
          recognitionRef.current.start();
        } catch (e) {
          // Already started
        }
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [isStarted]);

  // Toggle listening
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Failed to start recognition:", e);
      }
    }
  }, [isListening]);

  if (!isStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-lg w-full">
          <CardContent className="p-6 space-y-6 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-foreground">Group Discussion</h2>
              <p className="text-muted-foreground">Topic:</p>
              <p className="text-lg font-medium text-foreground">"{topic}"</p>
            </div>

            <div className="bg-secondary/50 rounded-lg p-4 text-left">
              <p className="text-sm text-muted-foreground mb-2">Participants:</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">You</Badge>
                {PARTICIPANTS.map(p => (
                  <Badge key={p.name} variant="secondary">{p.name}</Badge>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={onCancel} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button onClick={startGD} className="flex-1">
                Start Discussion
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <audio ref={audioRef} className="hidden" />
      
      {/* Header */}
      <div className="p-4 border-b border-border bg-card">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-foreground">Group Discussion</h1>
            <p className="text-sm text-muted-foreground truncate max-w-md">{topic}</p>
          </div>
          <Button onClick={endGD} variant="destructive" size="sm">
            End Discussion
          </Button>
        </div>
      </div>

      <div className="flex-1 flex max-w-4xl mx-auto w-full">
        {/* Chat area */}
        <div className="flex-1 flex flex-col p-4">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto space-y-4 mb-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg p-3",
                    msg.role === "user" 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-secondary text-foreground"
                  )}
                >
                  {msg.speaker && msg.role !== "user" && (
                    <p className="text-xs font-medium mb-1 opacity-70">{msg.speaker}</p>
                  )}
                  <p className="text-sm">{msg.content}</p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Current transcript */}
          {currentTranscript && (
            <div className="p-3 rounded-lg bg-secondary/50 border border-border mb-4">
              <p className="text-sm text-foreground italic">"{currentTranscript}"</p>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center justify-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "h-3 w-3 rounded-full",
                  isListening ? "bg-green-500 animate-pulse" : "bg-muted"
                )}
              />
              <span className="text-sm text-muted-foreground">
                {isProcessing ? "Processing..." :
                 isSpeaking ? `${currentSpeaker} is speaking` :
                 isListening ? "Your turn - speak now" : "Mic off"}
              </span>
            </div>

            <Button
              onClick={toggleListening}
              disabled={isSpeaking || isProcessing}
              size="lg"
              variant={isListening ? "default" : "secondary"}
              className="rounded-full w-14 h-14"
            >
              {isListening ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Webcam sidebar */}
        <div className="w-64 p-4 border-l border-border hidden md:block">
          <WebcamFeed isActive={cameraActive} className="aspect-video" />
          <p className="text-xs text-muted-foreground text-center mt-2">
            Camera for non-verbal analysis
          </p>
        </div>
      </div>
    </div>
  );
}

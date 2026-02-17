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
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentSpeaker, setCurrentSpeaker] = useState<string | null>(null);
  const [userTranscripts, setUserTranscripts] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [turnCount, setTurnCount] = useState(0);
  const [cameraActive, setCameraActive] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const getGDResponseRef = useRef<(text: string) => void>(() => {});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize SpeechRecognition for real-time transcription
  const initRecognition = useCallback(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) {
      toast({
        variant: "destructive",
        title: "Not Supported",
        description: "Speech recognition is not supported in this browser. Please use Chrome.",
      });
      return null;
    }
    const recognition = new SpeechRecognitionAPI() as SpeechRecognition;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        finalTranscriptRef.current += final;
      }
      setCurrentTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
    };

    return recognition;
  }, [toast]);

  // Text to speech using browser speechSynthesis
  const speak = useCallback((text: string, speaker: string): Promise<void> => {
    return new Promise((resolve) => {
      setIsSpeaking(true);
      setCurrentSpeaker(speaker);

      if (!window.speechSynthesis) {
        console.warn("speechSynthesis not supported");
        setIsSpeaking(false);
        setCurrentSpeaker(null);
        resolve();
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = speaker === "Priya" ? 1.2 : speaker === "Rahul" ? 0.85 : speaker === "Ananya" ? 1.1 : 1;
      utterance.volume = 1;

      // Try to pick a voice
      const voices = window.speechSynthesis.getVoices();
      const femaleVoice = voices.find(v => v.name.includes("Female") || v.name.includes("Samantha") || v.name.includes("Google UK English Female"));
      const maleVoice = voices.find(v => v.name.includes("Male") || v.name.includes("Daniel") || v.name.includes("Google UK English Male"));

      if (speaker === "Rahul" && maleVoice) {
        utterance.voice = maleVoice;
      } else if ((speaker === "Priya" || speaker === "Ananya") && femaleVoice) {
        utterance.voice = femaleVoice;
      }

      utterance.onend = () => {
        setIsSpeaking(false);
        setCurrentSpeaker(null);
        resolve();
      };

      utterance.onerror = () => {
        console.error("SpeechSynthesis error");
        setIsSpeaking(false);
        setCurrentSpeaker(null);
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }, []);

  // Init microphone
  const initMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      return stream;
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access.",
      });
      return null;
    }
  }, [toast]);

  // Start recording with SpeechRecognition
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    finalTranscriptRef.current = "";
    setCurrentTranscript("");

    const recognition = initRecognition();
    if (!recognition) return;

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [initRecognition]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // Stop recording and process transcript via ref
  const stopRecordingAndProcess = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);

    const text = finalTranscriptRef.current.trim();
    if (text) {
      setCurrentTranscript(text);
      getGDResponseRef.current(text);
      setCurrentTranscript("");
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

      if (turnCount >= 7 || data.shouldEnd) {
        for (const resp of responses) {
          await speak(resp.content, resp.speaker);
        }
        endGD();
      } else {
        await speakAllAndRecord(responses);
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

  // Keep ref in sync
  useEffect(() => {
    getGDResponseRef.current = getGDResponse;
  }, [getGDResponse]);

  const startGD = useCallback(async () => {
    const stream = await initMicrophone();
    if (!stream) return;

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

      await speakAllAndRecord(responses);
    } catch (error) {
      console.error("Start GD Error:", error);
      toast({
        variant: "destructive",
        title: "Failed to Start",
        description: "Could not start group discussion. Please try again.",
      });
      setIsStarted(false);
    }
  }, [topic, speak, toast, initMicrophone]);

  // End GD
  const endGD = useCallback(async () => {
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    setCameraActive(false);

    const durationSeconds = (Date.now() - startTime) / 1000;
    const speechMetrics = analyzeSpeech(userTranscripts, durationSeconds);
    const confidenceIndicators = calculateConfidenceIndicators(speechMetrics, durationSeconds);

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
  }, [startTime, userTranscripts, onEndDiscussion, stopRecording]);

  // Auto-start recording after all AI participants finish speaking
  const speakAllAndRecord = useCallback(async (responses: Array<{ speaker: string; content: string }>) => {
    for (const resp of responses) {
      await speak(resp.content, resp.speaker);
    }
    // Auto-start recording after all bot responses
    if (isStarted && streamRef.current) {
      startRecording();
    }
  }, [speak, isStarted, startRecording]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecordingAndProcess();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

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

            <div className="bg-secondary/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">🎙️ Powered by browser Speech Recognition for instant transcription</p>
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

          {/* Transcribing indicator */}
          {isTranscribing && (
            <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-4">
              <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
              <span className="text-sm text-foreground">Transcribing...</span>
            </div>
          )}

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
                  isRecording ? "bg-red-500 animate-pulse" :
                  isTranscribing ? "bg-yellow-500 animate-pulse" : "bg-muted"
                )}
              />
              <span className="text-sm text-muted-foreground">
                {isTranscribing ? "Transcribing..." :
                 isProcessing ? "Processing..." :
                 isSpeaking ? `${currentSpeaker} is speaking` :
                 isRecording ? "Recording... (click to send)" : "Mic off"}
              </span>
            </div>

            <Button
              onClick={toggleRecording}
              disabled={isSpeaking || isProcessing || isTranscribing}
              size="lg"
              variant={isRecording ? "default" : "secondary"}
              className={cn(
                "rounded-full w-14 h-14",
                isRecording && "bg-red-600 hover:bg-red-700"
              )}
            >
              {isRecording ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
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

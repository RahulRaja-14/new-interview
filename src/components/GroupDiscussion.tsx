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
  const [userInitiativeCount, setUserInitiativeCount] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef<string>("");
  const getGDResponseRef = useRef<(text: string) => void>(() => { });
  const isActiveRef = useRef<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Transcribe audio using Whisper via Supabase Edge Function
  const transcribeAudio = async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "audio.webm");

      const { data, error } = await supabase.functions.invoke("whisper-transcribe", {
        body: formData,
      });

      if (error) throw error;
      return data.text || "";
    } catch (error) {
      console.error("Transcription error:", error);
      return "";
    } finally {
      setIsTranscribing(false);
    }
  };

  // Initialize SpeechRecognition for real-time visual feedback
  const initRecognition = useCallback(() => {
    const SpeechRecognitionAPI = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (!event.results[i].isFinal) {
          interim += transcript;
        }
      }
      setCurrentTranscript(interim);
    };

    return recognition;
  }, []);

  // Text to speech using browser speechSynthesis
  const speak = useCallback((text: string, speaker: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!isActiveRef.current) {
        resolve();
        return;
      }

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
      utterance.volume = 1;

      // Distinct voice profiles per participant
      const voices = window.speechSynthesis.getVoices();
      const enVoices = voices.filter(v => v.lang.startsWith("en"));

      if (speaker === "Priya") {
        utterance.rate = 1.05;
        utterance.pitch = 1.3;
        const voice = enVoices.find(v => v.name.includes("Samantha")) ||
          enVoices.find(v => v.name.includes("Google UK English Female")) ||
          enVoices.find(v => v.name.toLowerCase().includes("female"));
        if (voice) utterance.voice = voice;
      } else if (speaker === "Rahul") {
        utterance.rate = 0.92;
        utterance.pitch = 0.7;
        const voice = enVoices.find(v => v.name.includes("Daniel")) ||
          enVoices.find(v => v.name.includes("Google UK English Male")) ||
          enVoices.find(v => v.name.toLowerCase().includes("male"));
        if (voice) utterance.voice = voice;
      } else if (speaker === "Ananya") {
        utterance.rate = 1.0;
        utterance.pitch = 1.1;
        const voice = enVoices.find(v => v.name.includes("Karen") || v.name.includes("Moira")) ||
          enVoices.find(v => v.name.includes("Google US English")) ||
          enVoices.filter(v => v.name.toLowerCase().includes("female"))[1];
        if (voice) utterance.voice = voice;
      } else {
        // Moderator
        utterance.rate = 0.95;
        utterance.pitch = 1.0;
        const voice = enVoices.find(v => v.name.includes("Alex")) || enVoices[0];
        if (voice) utterance.voice = voice;
      }

      utterance.onend = () => {
        if (!isActiveRef.current) {
          resolve();
          return;
        }
        setIsSpeaking(false);
        setCurrentSpeaker(null);
        resolve();
      };

      utterance.onerror = () => {
        if (!isActiveRef.current) {
          resolve();
          return;
        }
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

  // Start recording with MediaRecorder + Live Feedback
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    finalTranscriptRef.current = "";
    setCurrentTranscript("");
    audioChunksRef.current = [];

    // 1. High-Accuracy AI Recorder
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    mediaRecorder.start();

    // 2. Live Feedback (Browser API)
    const recognition = initRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try { recognition.start(); } catch (e) { }
    }

    setIsRecording(true);
  }, [initRecognition]);

  // Stop recording
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, [isRecording]);

  // Stop recording and process transcript
  const stopRecordingAndProcess = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
      recognitionRef.current = null;
    }

    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        if (!isStarted) return;
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const text = await transcribeAudio(audioBlob);

        if (text && isStarted) {
          getGDResponseRef.current(text);
          setCurrentTranscript("");
        }
      };

      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, [isStarted, isRecording, transcribeAudio]);

  // Show each bot message one at a time, synced with voice
  const speakResponsesSequentially = useCallback(async (
    baseMessages: Message[],
    responses: Array<{ speaker: string; content: string }>
  ) => {
    let current = [...baseMessages];
    for (let i = 0; i < responses.length; i++) {
      const resp = responses[i];
      if (!isActiveRef.current) break;

      // All 5 seconds gap between AI bots discussion
      // We skip the gap for the very first AI response in the sequence
      // so the AI remains responsive to the user.
      if (i > 0) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (!isActiveRef.current) break;
      }

      const newMsg: Message = { role: "participant", content: resp.content, speaker: resp.speaker };
      current = [...current, newMsg];
      setMessages([...current]);
      await speak(resp.content, resp.speaker);
    }
  }, [speak]);

  // Handle AI initiation if user is silent
  const handleAIInitiation = useCallback(async () => {
    if (!isActiveRef.current || !isStarted || isProcessing || isSpeaking || isRecording || isTranscribing) return;

    // Stop any active user recording before AI takes over
    stopRecording();

    setIsProcessing(true);

    try {
      const { data, error } = await supabase.functions.invoke("gd-chat", {
        body: {
          messages,
          topic,
          participants: PARTICIPANTS,
          turnCount,
          isAIInitiating: true,
        },
      });

      if (error) throw error;
      if (!isActiveRef.current || !isStarted) return;

      const responses = data.responses as Array<{ speaker: string; content: string }>;
      setIsProcessing(false);
      if (!isActiveRef.current) return;
      await speakResponsesSequentially(messages, responses);

      if (isActiveRef.current && isStarted && streamRef.current) {
        startRecording();
      }
    } catch (error) {
      console.error("AI Initiation Error:", error);
      setIsProcessing(false);
    }
  }, [isStarted, isProcessing, isSpeaking, isRecording, isTranscribing, messages, topic, turnCount, startRecording, stopRecording, speakResponsesSequentially]);

  // Get GD response from AI
  const getGDResponse = useCallback(async (userMessage: string) => {
    if (!isActiveRef.current || !isStarted) return;

    setUserInitiativeCount(prev => prev + 1);
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
      if (!isActiveRef.current || !isStarted) return;

      const responses = data.responses as Array<{ speaker: string; content: string }>;

      setIsProcessing(false);
      setTurnCount(prev => prev + 1);

      if (isActiveRef.current && (turnCount >= 7 || data.shouldEnd)) {
        await speakResponsesSequentially(newMessages, responses);
        if (isActiveRef.current && isStarted) endGD();
      } else if (isActiveRef.current) {
        await speakResponsesSequentially(newMessages, responses);
        if (isActiveRef.current && isStarted && streamRef.current) {
          startRecording();
        }
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
    isActiveRef.current = true;
    // Immediate state change for perceived performance
    setIsStarted(true);
    setStartTime(Date.now());
    setTurnCount(0);

    // Zero-latency moderator intro handled on frontend
    const introText = `The topic for today's discussion is ${topic}. Please start the conversation.`;
    const moderatorMsg: Message = { role: "participant", content: introText, speaker: "Moderator" };
    setMessages([moderatorMsg]);

    // Start speaking immediately
    const speakPromise = speak(introText, "Moderator");

    // Initialize microphone in background
    const stream = await initMicrophone();
    if (!stream) {
      setIsStarted(false);
      return;
    }
    setCameraActive(true);

    // Wait for the intro speech to finish before starting the recording and 5s timer
    await speakPromise;

    if (isActiveRef.current && isStarted && streamRef.current) {
      startRecording();
    }
  }, [topic, speak, initMicrophone, startRecording, isStarted]);

  // End GD
  const endGD = useCallback(async () => {
    isActiveRef.current = false;
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    window.speechSynthesis.cancel();
    setCameraActive(false);

    const durationSeconds = (Date.now() - startTime) / 1000;

    try {
      const { data, error } = await supabase.functions.invoke("evaluate-session", {
        body: {
          type: "gd",
          messages,
          userTranscripts,
          topic,
          durationSeconds,
          userInitiativeCount,
        },
      });

      if (error) throw error;

      const evaluation: GDEvaluation = {
        type: "gd",
        communication: data.communication ?? 5,
        grammarUsage: data.grammarUsage ?? 5,
        leadership: data.leadership ?? 5,
        confidence: data.confidence ?? 5,
        initiative: data.initiative ?? 5,
        listeningAbility: data.listeningAbility ?? 5,
        topicAccuracy: data.topicAccuracy ?? 5,
        overallGDScore: data.overallGDScore ?? 5,
        whatWentWell: data.whatWentWell ?? ["Participated in the discussion"],
        lostPoints: data.lostPoints ?? [],
        improvementTips: data.improvementTips ?? ["Practice more"],
      };

      onEndDiscussion(evaluation);
    } catch (err) {
      console.error("Evaluation error:", err);
      // Fallback to basic evaluation
      onEndDiscussion({
        type: "gd",
        communication: 5,
        grammarUsage: 5,
        leadership: 5,
        confidence: 5,
        initiative: 5,
        listeningAbility: 5,
        topicAccuracy: 5,
        overallGDScore: 5,
        whatWentWell: ["Participated in the discussion"],
        lostPoints: ["Could not generate detailed evaluation"],
        improvementTips: ["Practice speaking on diverse topics daily"],
      });
    }
  }, [startTime, userTranscripts, messages, topic, onEndDiscussion, stopRecording]);

  // No longer needed here as it was moved up

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecordingAndProcess();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecordingAndProcess]);

  // Robust Idle Timer effect for AI initiation
  useEffect(() => {
    if (!isStarted || isProcessing || isSpeaking || isTranscribing) {
      return;
    }

    const timer = setTimeout(() => {
      handleAIInitiation();
    }, 5000);

    return () => clearTimeout(timer);
  }, [isStarted, isProcessing, isSpeaking, isTranscribing, handleAIInitiation]);

  // Cleanup
  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      window.speechSynthesis.cancel();
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
              <Button onClick={() => {
                isActiveRef.current = false;
                onCancel();
              }} variant="outline" className="flex-1">
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

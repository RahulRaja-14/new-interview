import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff, Volume2, Video, VideoOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { WebcamFeed } from "@/components/WebcamFeed";
import { InterviewEvaluation } from "@/components/EvaluationReport";
import { analyzeSpeech, calculateConfidenceIndicators } from "@/components/SpeechAnalyzer";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface VoiceInterviewProps {
  resumeText: string;
  experienceLevel: string;
  jobDescription: string;
  onEndInterview: (evaluation?: InterviewEvaluation) => void;
}

export function VoiceInterview({
  resumeText,
  experienceLevel,
  jobDescription,
  onEndInterview,
}: VoiceInterviewProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [lastSpokenText, setLastSpokenText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [userTranscripts, setUserTranscripts] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [frameAnalysis, setFrameAnalysis] = useState<string[]>([]);

  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const isActiveRef = useRef(false);


  const animFrameRef = useRef<number | null>(null);
  const finalTranscriptRef = useRef<string>("");

  const { toast } = useToast();

  // Handle webcam frame capture for non-verbal analysis
  const handleFrameCapture = useCallback((frameData: string) => {
    setFrameAnalysis(prev => [...prev.slice(-10), frameData]);
  }, []);

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

  // Initialize browser SpeechRecognition for INSTANT visual feedback
  const initLiveRecognition = useCallback(() => {
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

  // Text to speech using browser SpeechSynthesis (free)
  const speak = useCallback((text: string) => {
    setIsSpeaking(true);
    setLastSpokenText(text);

    return new Promise<void>((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.volume = 1;

      const voices = speechSynthesis.getVoices();
      const preferred = voices.find(v => v.name.includes("Google") && v.lang.startsWith("en"))
        || voices.find(v => v.lang.startsWith("en-") && !v.localService)
        || voices.find(v => v.lang.startsWith("en"));
      if (preferred) utterance.voice = preferred;

      utterance.onend = () => {
        setIsSpeaking(false);
        resolve();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        resolve();
      };

      speechSynthesis.cancel();
      speechSynthesis.speak(utterance);
    });
  }, []);

  // Generate evaluation from AI
  const generateEvaluation = useCallback(async (): Promise<InterviewEvaluation> => {
    const durationSeconds = (Date.now() - startTime) / 1000;

    try {
      const { data, error } = await supabase.functions.invoke("evaluate-session", {
        body: {
          type: "interview",
          messages,
          userTranscripts,
          durationSeconds,
          cameraEnabled,
        },
      });

      if (error) throw error;

      return {
        type: "interview",
        grammarAccuracy: data.grammarAccuracy ?? 5,
        speechClarity: data.speechClarity ?? 5,
        confidenceLevel: data.confidenceLevel ?? "Medium",
        fearIndicator: data.fearIndicator ?? "Moderate",
        nonVerbalScore: data.nonVerbalScore ?? 5,
        overallScore: data.overallScore ?? 5,
        strengths: data.strengths ?? ["Participated in the interview"],
        nervousHabits: data.nervousHabits ?? [],
        grammarIssues: data.grammarIssues ?? [],
        improvementPlan: data.improvementPlan ?? ["Practice more"],
      };
    } catch (err) {
      console.error("Evaluation error:", err);
      return {
        type: "interview",
        grammarAccuracy: 5,
        speechClarity: 5,
        confidenceLevel: "Medium",
        fearIndicator: "Moderate",
        nonVerbalScore: 5,
        overallScore: 5,
        strengths: ["Participated in the interview"],
        nervousHabits: [],
        grammarIssues: [],
        improvementPlan: ["Practice speaking daily"],
      };
    }
  }, [startTime, userTranscripts, messages, cameraEnabled]);

  // Get AI response
  const getAIResponse = useCallback(async (userMessage: string) => {
    if (!isActiveRef.current) return;

    setIsProcessing(true);
    setUserTranscripts(prev => [...prev, userMessage]);

    const newMessages: Message[] = [...messages, { role: "user", content: userMessage }];
    setMessages(newMessages);

    try {
      const { data, error } = await supabase.functions.invoke("interview-chat", {
        body: {
          messages: newMessages,
          resumeText,
          experienceLevel,
          jobDescription,
        },
      });

      if (error) throw error;
      if (!isActiveRef.current) return;


      const reply = data.reply;
      setMessages([...newMessages, { role: "assistant", content: reply }]);
      setIsProcessing(false);

      if (userMessage.toLowerCase().includes("end interview")) {
        await speak(reply);
        const evaluation = await generateEvaluation();
        setTimeout(() => onEndInterview(evaluation), 5000);
      } else if (isActiveRef.current) {
        await speak(reply);
        if (isActiveRef.current) startRecording();
      }

    } catch (error) {
      console.error("AI Error:", error);
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: "Failed to get response. Please try again.",
      });
      setIsProcessing(false);
    }
  }, [messages, resumeText, experienceLevel, jobDescription, speak, toast, onEndInterview, generateEvaluation]);

  // Initialize microphone and MediaRecorder
  const initMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyser for visual level
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      return stream;
    } catch (error) {
      console.error("Microphone error:", error);
      toast({
        variant: "destructive",
        title: "Microphone Access Denied",
        description: "Please allow microphone access for the interview.",
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

    // 1. Start High-Accuracy Recorder
    const mediaRecorder = new MediaRecorder(streamRef.current);
    mediaRecorderRef.current = mediaRecorder;
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    mediaRecorder.start();

    // 2. Start Live Visual Feedback (Browser API)
    const recognition = initLiveRecognition();
    if (recognition) {
      recognitionRef.current = recognition;
      try { recognition.start(); } catch (e) { }
    }

    setIsRecording(true);
  }, [initLiveRecognition]);

  // Stop recording and process transcript
  const stopRecording = useCallback(() => {
    // Stop live feedback
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch (e) { }
      recognitionRef.current = null;
    }

    // Stop high-accuracy recorder and process
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.onstop = async () => {
        if (!isActiveRef.current) return;

        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const text = await transcribeAudio(audioBlob);

        if (text && isConnected) {
          getAIResponse(text);
          setCurrentTranscript("");
        }
      };

      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  }, [getAIResponse, transcribeAudio, isRecording]);

  // Start the interview
  const startInterview = useCallback(async () => {
    const stream = await initMicrophone();
    if (!stream) return;

    setIsConnected(true);
    isActiveRef.current = true;
    setStartTime(Date.now());


    try {
      const { data, error } = await supabase.functions.invoke("interview-chat", {
        body: {
          messages: [],
          resumeText,
          experienceLevel,
          jobDescription,
        },
      });

      if (error) throw error;
      if (!isActiveRef.current) return;


      const greeting = data.reply;
      setMessages([{ role: "assistant", content: greeting }]);
      setLastSpokenText(greeting);
      await speak(greeting);
      if (isActiveRef.current) startRecording();

    } catch (error) {
      console.error("Start Error:", error);
      toast({
        variant: "destructive",
        title: "Connection Failed",
        description: "Failed to start interview. Please try again.",
      });
      setIsConnected(false);
    }
  }, [resumeText, experienceLevel, jobDescription, speak, toast, initMicrophone]);

  // No longer needed - browser speechSynthesis handles TTS completion inline

  // Audio level visualization
  useEffect(() => {
    if (!isRecording || !analyserRef.current) {
      setAudioLevel(0);
      return;
    }

    const analyser = analyserRef.current;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      setAudioLevel(avg);
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isRecording]);

  // Toggle recording
  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // End call with evaluation
  const endCall = useCallback(async () => {
    stopRecording();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }
    window.speechSynthesis.cancel();
    setIsConnected(false);
    isActiveRef.current = false;
    setIsRecording(false);

    setIsSpeaking(false);

    const evaluation = await generateEvaluation();
    onEndInterview(evaluation);
  }, [onEndInterview, generateEvaluation, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Left Sidebar: Conversation History */}
      <div className="lg:w-80 border-r border-border bg-card/50 flex flex-col h-screen overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Conversation</h3>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center mt-8">Your conversation will appear here.</p>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "p-3 rounded-lg text-sm max-w-[90%]",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground ml-auto rounded-tr-none"
                    : "bg-secondary text-secondary-foreground mr-auto rounded-tl-none"
                )}
              >
                {msg.content}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Interview Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
        {/* Interviewer Avatar */}
        <div className="relative mb-8">
          <div
            className={cn(
              "w-48 h-48 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center transition-all duration-300",
              isSpeaking && "ring-4 ring-primary/50 ring-offset-4 ring-offset-background animate-pulse"
            )}
          >
            <div className="text-6xl font-bold text-primary-foreground">AI</div>
          </div>
          {isSpeaking && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1">
              <Volume2 className="h-4 w-4 text-primary animate-pulse" />
              <span className="text-sm text-muted-foreground">Speaking...</span>
            </div>
          )}
        </div>

        {/* Status & Transcript */}
        <div className="text-center mb-8 max-w-xl">
          {!isConnected ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-foreground">Ready to Begin?</h2>
              <p className="text-muted-foreground">
                Click the button below to start your voice interview with comprehensive evaluation.
              </p>
              <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
                <span className="px-2 py-1 bg-secondary rounded-full">🎙️ Voice Recognition</span>
                <span className="px-2 py-1 bg-secondary rounded-full">Grammar Analysis</span>
                <span className="px-2 py-1 bg-secondary rounded-full">Confidence Detection</span>
                <span className="px-2 py-1 bg-secondary rounded-full">Non-verbal Cues</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <div
                  className={cn(
                    "h-3 w-3 rounded-full",
                    isRecording ? "bg-green-500 animate-pulse" :
                      isTranscribing ? "bg-yellow-500 animate-pulse" : "bg-muted"
                  )}
                />
                <span className="text-sm text-muted-foreground">
                  {isTranscribing
                    ? "Transcribing..."
                    : isProcessing
                      ? "Processing..."
                      : isSpeaking
                        ? "Interviewer is speaking"
                        : isRecording
                          ? "Recording... (click mic to send)"
                          : "Microphone off"}
                </span>
              </div>

              {/* Transcribing indicator */}
              {isTranscribing && (
                <div className="flex items-center justify-center gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-500" />
                  <span className="text-sm text-foreground">Converting speech to text...</span>
                </div>
              )}

              {/* Current transcript */}
              {currentTranscript && (
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-sm text-foreground italic">"{currentTranscript}"</p>
                </div>
              )}

              {/* Last spoken text by AI */}
              {lastSpokenText && !currentTranscript && !isTranscribing && (
                <div className="p-4 rounded-lg bg-card border border-border max-h-32 overflow-y-auto">
                  <p className="text-sm text-foreground">{lastSpokenText}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audio Level Visualization */}
        {isRecording && (
          <div className="flex items-end justify-center gap-1 h-12 mb-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-primary rounded-full transition-all duration-100"
                style={{
                  height: `${Math.min(12 + (audioLevel / 255) * 36, 48)}px`,
                }}
              />
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-4">
          {!isConnected ? (
            <Button
              onClick={startInterview}
              size="lg"
              className="px-8 py-6 text-lg bg-green-600 hover:bg-green-700 text-white"
            >
              <Phone className="h-5 w-5 mr-2" />
              Start Interview
            </Button>
          ) : (
            <>
              <Button
                onClick={toggleRecording}
                disabled={isSpeaking || isProcessing || isTranscribing}
                size="lg"
                variant={isRecording ? "default" : "secondary"}
                className={cn(
                  "w-16 h-16 rounded-full",
                  isRecording && "bg-red-600 hover:bg-red-700"
                )}
              >
                {isRecording ? (
                  <Mic className="h-6 w-6" />
                ) : (
                  <MicOff className="h-6 w-6" />
                )}
              </Button>

              <Button
                onClick={() => setCameraEnabled(!cameraEnabled)}
                size="lg"
                variant={cameraEnabled ? "secondary" : "outline"}
                className="w-16 h-16 rounded-full"
              >
                {cameraEnabled ? (
                  <Video className="h-6 w-6" />
                ) : (
                  <VideoOff className="h-6 w-6" />
                )}
              </Button>

              <Button
                onClick={endCall}
                size="lg"
                variant="destructive"
                className="w-16 h-16 rounded-full"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>

        {/* Instructions */}
        <p className="text-center text-xs text-muted-foreground mt-8 max-w-md">
          {isConnected
            ? 'Speak while recording, then click the mic button to stop and send. Say "end interview" to finish and receive your evaluation.'
            : "Make sure your microphone and camera are enabled for comprehensive evaluation."}
        </p>
      </div>

      {/* Webcam Sidebar */}
      <div className="lg:w-80 p-4 border-t lg:border-t-0 lg:border-l border-border bg-card">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-foreground">Your Camera</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCameraEnabled(!cameraEnabled)}
            >
              {cameraEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            </Button>
          </div>

          <WebcamFeed
            isActive={isConnected && cameraEnabled}
            onFrameCapture={handleFrameCapture}
            captureInterval={5000}
            className="aspect-video w-full"
          />

          <p className="text-xs text-muted-foreground text-center">
            Camera is used for analyzing non-verbal communication like eye contact and facial expressions.
          </p>

          {isConnected && (
            <div className="space-y-2 pt-4 border-t border-border">
              <h4 className="text-xs font-medium text-muted-foreground uppercase">Live Analysis</h4>
              <div className="grid gap-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Speech Clarity</span>
                  <span className="text-primary">Analyzing...</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Confidence</span>
                  <span className="text-primary">Monitoring...</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Eye Contact</span>
                  <span className={cameraEnabled ? "text-primary" : "text-muted-foreground"}>
                    {cameraEnabled ? "Tracking..." : "Camera off"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

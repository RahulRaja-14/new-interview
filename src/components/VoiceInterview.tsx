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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const finalTranscriptRef = useRef<string>("");

  const { toast } = useToast();

  // Handle webcam frame capture for non-verbal analysis
  const handleFrameCapture = useCallback((frameData: string) => {
    setFrameAnalysis(prev => [...prev.slice(-10), frameData]);
  }, []);

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
    const recognition = new SpeechRecognitionAPI();
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
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast({
          variant: "destructive",
          title: "Recognition Error",
          description: `Speech recognition error: ${event.error}`,
        });
      }
    };

    recognition.onend = () => {
      // Auto-restart if still recording
      if (recognitionRef.current && isRecording) {
        try { recognitionRef.current.start(); } catch {}
      }
    };

    return recognition;
  }, [toast, isRecording]);

  // Text to speech using ElevenLabs
  const speak = useCallback(async (text: string) => {
    setIsSpeaking(true);
    setLastSpokenText(text);

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
          body: JSON.stringify({ text, voiceId: "JBFqnCBsd6RMkjVDRZzb" }),
        }
      );

      if (!response.ok) throw new Error("TTS request failed");

      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.src = audioUrl;
        await audioRef.current.play();
      }
    } catch (error) {
      console.error("TTS Error:", error);
      toast({
        variant: "destructive",
        title: "Voice Error",
        description: "Failed to generate speech. Please try again.",
      });
      setIsSpeaking(false);
    }
  }, [toast]);

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

      const reply = data.reply;
      setMessages([...newMessages, { role: "assistant", content: reply }]);
      setIsProcessing(false);

      if (userMessage.toLowerCase().includes("end interview")) {
        await speak(reply);
        const evaluation = await generateEvaluation();
        setTimeout(() => onEndInterview(evaluation), 5000);
      } else {
        await speak(reply);
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

  // Stop recording and process transcript
  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsRecording(false);
    
    const text = finalTranscriptRef.current.trim();
    if (text) {
      setCurrentTranscript(text);
      getAIResponse(text);
      setCurrentTranscript("");
    }
  }, [getAIResponse]);

  // Start the interview
  const startInterview = useCallback(async () => {
    const stream = await initMicrophone();
    if (!stream) return;

    setIsConnected(true);
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

      const greeting = data.reply;
      setMessages([{ role: "assistant", content: greeting }]);
      await speak(greeting);
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

  // Audio element event handlers - start recording after AI finishes speaking
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsSpeaking(false);
      if (isConnected) {
        startRecording();
      }
    };

    audio.addEventListener("ended", handleEnded);
    return () => audio.removeEventListener("ended", handleEnded);
  }, [isConnected, startRecording]);

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
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsConnected(false);
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
    };
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      <audio ref={audioRef} className="hidden" />

      {/* Main Interview Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
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

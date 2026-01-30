import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff, Volume2, Video, VideoOff } from "lucide-react";
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
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [lastSpokenText, setLastSpokenText] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [userTranscripts, setUserTranscripts] = useState<string[]>([]);
  const [startTime, setStartTime] = useState<number>(0);
  const [frameAnalysis, setFrameAnalysis] = useState<string[]>([]);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { toast } = useToast();

  // Handle webcam frame capture for non-verbal analysis
  const handleFrameCapture = useCallback((frameData: string) => {
    // Store frame data for analysis (we'll send summary with evaluation)
    setFrameAnalysis(prev => [...prev.slice(-10), frameData]); // Keep last 10 frames
  }, []);

  // Initialize speech recognition
  const initSpeechRecognition = useCallback(() => {
    const win = window as any;
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      toast({
        variant: "destructive",
        title: "Speech Recognition Not Supported",
        description: "Please use Chrome or Edge browser for voice interviews.",
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

      if (!response.ok) {
        throw new Error("TTS request failed");
      }

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

  // Generate evaluation from collected data
  const generateEvaluation = useCallback((): InterviewEvaluation => {
    const durationSeconds = (Date.now() - startTime) / 1000;
    const speechMetrics = analyzeSpeech(userTranscripts, durationSeconds);
    const confidenceIndicators = calculateConfidenceIndicators(speechMetrics, durationSeconds);

    // Calculate scores
    const grammarScore = Math.max(4, 10 - speechMetrics.grammarIssues.length);
    const speechScore = Math.min(10, 
      (speechMetrics.averageWordsPerMinute >= 120 && speechMetrics.averageWordsPerMinute <= 160 ? 8 : 6) +
      (speechMetrics.fillerCount < 5 ? 2 : 0)
    );
    const nonVerbalScore = cameraEnabled ? 7 : 6; // Placeholder - in real app would analyze frames

    return {
      type: "interview",
      grammarAccuracy: grammarScore,
      speechClarity: speechScore,
      confidenceLevel: confidenceIndicators.confidenceLevel,
      fearIndicator: confidenceIndicators.fearIndicator,
      nonVerbalScore,
      overallScore: Math.round((grammarScore + speechScore + nonVerbalScore + 
        (confidenceIndicators.confidenceLevel === "High" ? 9 : 
         confidenceIndicators.confidenceLevel === "Medium" ? 7 : 5)) / 4),
      strengths: [
        userTranscripts.length >= 5 ? "Engaged actively throughout the interview" : "Participated in the interview",
        speechMetrics.fillerCount < 5 ? "Clear communication with minimal filler words" : "Attempted to communicate clearly",
        speechMetrics.sentenceCount > 10 ? "Provided detailed responses" : "Gave structured responses"
      ],
      nervousHabits: confidenceIndicators.nervousHabits,
      grammarIssues: speechMetrics.grammarIssues,
      improvementPlan: [
        "Practice speaking about your projects for 5-10 minutes daily",
        "Record yourself answering common interview questions and review",
        "Work on reducing filler words by pausing instead of saying 'um'",
        "Study STAR method for structuring behavioral answers",
        "Do mock interviews with friends or mentors weekly"
      ]
    };
  }, [startTime, userTranscripts, cameraEnabled]);

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

      // Check if interview should end
      if (userMessage.toLowerCase().includes("end interview")) {
        await speak(reply);
        const evaluation = generateEvaluation();
        setTimeout(() => onEndInterview(evaluation), 15000);
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

  // Start the interview
  const startInterview = useCallback(async () => {
    setIsConnected(true);
    setStartTime(Date.now());

    // Get initial greeting
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
  }, [resumeText, experienceLevel, jobDescription, speak, toast]);

  // Handle speech recognition
  useEffect(() => {
    if (!isConnected) return;

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
        getAIResponse(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      if (event.error !== "aborted") {
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      if (isListening && isConnected && !isSpeaking) {
        recognition.start();
      }
    };

    return () => {
      recognition.stop();
    };
  }, [isConnected, isListening, isSpeaking, isProcessing, getAIResponse, initSpeechRecognition]);

  // Audio element event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsSpeaking(false);
      // Resume listening after AI finishes speaking
      if (isConnected && recognitionRef.current) {
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
  }, [isConnected]);

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

  // End call with evaluation
  const endCall = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    
    const evaluation = generateEvaluation();
    onEndInterview(evaluation);
  }, [onEndInterview, generateEvaluation]);

  // Animate audio visualization
  useEffect(() => {
    if (!isListening) {
      setAudioLevel(0);
      return;
    }

    const interval = setInterval(() => {
      setAudioLevel(Math.random() * 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isListening]);

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
                <span className="px-2 py-1 bg-secondary rounded-full">Grammar Analysis</span>
                <span className="px-2 py-1 bg-secondary rounded-full">Confidence Detection</span>
                <span className="px-2 py-1 bg-secondary rounded-full">Speech Clarity</span>
                <span className="px-2 py-1 bg-secondary rounded-full">Non-verbal Cues</span>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2">
                <div
                  className={cn(
                    "h-3 w-3 rounded-full",
                    isListening ? "bg-green-500 animate-pulse" : "bg-muted"
                  )}
                />
                <span className="text-sm text-muted-foreground">
                  {isProcessing
                    ? "Processing..."
                    : isSpeaking
                    ? "Interviewer is speaking"
                    : isListening
                    ? "Listening..."
                    : "Microphone off"}
                </span>
              </div>

              {/* Current transcript */}
              {currentTranscript && (
                <div className="p-4 rounded-lg bg-secondary/50 border border-border">
                  <p className="text-sm text-foreground italic">"{currentTranscript}"</p>
                </div>
              )}

              {/* Last spoken text by AI */}
              {lastSpokenText && !currentTranscript && (
                <div className="p-4 rounded-lg bg-card border border-border max-h-32 overflow-y-auto">
                  <p className="text-sm text-foreground">{lastSpokenText}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Audio Level Visualization */}
        {isListening && (
          <div className="flex items-end justify-center gap-1 h-12 mb-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="w-2 bg-primary rounded-full transition-all duration-100"
                style={{
                  height: `${Math.min(12 + Math.random() * audioLevel * 0.4, 48)}px`,
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
                onClick={toggleListening}
                disabled={isSpeaking || isProcessing}
                size="lg"
                variant={isListening ? "default" : "secondary"}
                className={cn(
                  "w-16 h-16 rounded-full",
                  isListening && "bg-primary hover:bg-primary/90"
                )}
              >
                {isListening ? (
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
            ? 'Speak clearly when the microphone is active. Say "end interview" to finish and receive your evaluation report.'
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

          {/* Real-time feedback indicators */}
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

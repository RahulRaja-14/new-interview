import { useEffect, useRef, useState, useCallback } from "react";
import { Camera, CameraOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface WebcamFeedProps {
  isActive: boolean;
  onFrameCapture?: (frameData: string) => void;
  captureInterval?: number; // ms between captures
  className?: string;
}

export function WebcamFeed({ 
  isActive, 
  onFrameCapture, 
  captureInterval = 5000, // Default: capture every 5 seconds
  className 
}: WebcamFeedProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user"
        } 
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setHasPermission(true);
        setError(null);
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setHasPermission(false);
      setError("Camera access denied. Please enable camera permissions.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !onFrameCapture) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    if (!ctx || video.readyState !== 4) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Convert to base64 (low quality for analysis)
    const frameData = canvas.toDataURL("image/jpeg", 0.5);
    onFrameCapture(frameData);
  }, [onFrameCapture]);

  // Start/stop camera based on isActive
  useEffect(() => {
    if (isActive) {
      startCamera();
    } else {
      stopCamera();
    }

    return () => stopCamera();
  }, [isActive, startCamera, stopCamera]);

  // Capture frames at interval
  useEffect(() => {
    if (!isActive || !onFrameCapture || hasPermission !== true) return;

    const interval = setInterval(captureFrame, captureInterval);
    return () => clearInterval(interval);
  }, [isActive, hasPermission, captureFrame, captureInterval, onFrameCapture]);

  return (
    <div className={cn("relative rounded-xl overflow-hidden bg-secondary", className)}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className={cn(
          "w-full h-full object-cover transform scale-x-[-1]",
          !hasPermission && "hidden"
        )}
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera off overlay */}
      {!isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-secondary">
          <CameraOff className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Camera off</p>
        </div>
      )}

      {/* Permission denied overlay */}
      {isActive && hasPermission === false && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-destructive/10 p-4">
          <AlertCircle className="h-8 w-8 text-destructive mb-2" />
          <p className="text-sm text-destructive text-center">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {isActive && hasPermission === null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <Camera className="h-8 w-8 text-muted-foreground animate-pulse mb-2" />
          <p className="text-sm text-muted-foreground">Starting camera...</p>
        </div>
      )}

      {/* Camera active indicator */}
      {isActive && hasPermission && (
        <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-background/80 backdrop-blur-sm">
          <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-foreground">Recording</span>
        </div>
      )}
    </div>
  );
}

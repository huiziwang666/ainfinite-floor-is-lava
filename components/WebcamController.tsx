import React, { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { GAME_CONSTANTS } from '../constants';

interface WebcamControllerProps {
  onPoseUpdate: (pose: any) => void;
  onCameraReady: () => void;
  showSkeleton: boolean;
}

const WebcamController: React.FC<WebcamControllerProps> = ({ 
  onPoseUpdate, 
  onCameraReady,
  showSkeleton 
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let camera: any = null;
    let pose: any = null;

    const setupMediaPipe = async () => {
      try {
        if (!window.Pose || !window.Camera) {
          setError("MediaPipe libraries not loaded.");
          return;
        }

        pose = new window.Pose({
          locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
        });

        pose.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        pose.onResults(onResults);

        if (videoRef.current) {
          camera = new window.Camera(videoRef.current, {
            onFrame: async () => {
              if (videoRef.current && pose) {
                await pose.send({ image: videoRef.current });
              }
            },
            width: 640,
            height: 480
          });
          
          await camera.start();
          onCameraReady();
        }
      } catch (err) {
        console.error("Camera error:", err);
        setError("Allow camera access to play.");
      }
    };

    setupMediaPipe();

    return () => {
      if (camera) camera.stop();
      if (pose) pose.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onResults = (results: any) => {
    onPoseUpdate(results);

    if (showSkeleton && canvasRef.current && results.poseLandmarks) {
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;

      ctx.save();
      ctx.clearRect(0, 0, w, h);
      
      // Mirror
      ctx.scale(-1, 1);
      ctx.translate(-w, 0);
      
      // Draw Feed
      ctx.drawImage(results.image, 0, 0, w, h);

      // Draw Zones (Mirrored logic visual)
      // LEAN_THRESHOLD_LEFT is 0.6 (Camera Right). Mirrored: 0.6 * w from right -> 0.4 * w from left visually?
      // Wait, we are drawing in mirrored context.
      // x=0 is Right of screen. x=w is Left of screen.
      // Threshold 0.6 (Left Lean) -> x=0.6*w.
      // Threshold 0.4 (Right Lean) -> x=0.4*w.
      
      ctx.globalAlpha = 0.3;
      
      // Right Lean Zone (User's Right, Screen Left) -> Raw X < 0.4
      ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.fillRect(0, 0, w * GAME_CONSTANTS.LEAN_THRESHOLD_RIGHT, h);
      
      // Left Lean Zone (User's Left, Screen Right) -> Raw X > 0.6
      ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
      ctx.fillRect(w * GAME_CONSTANTS.LEAN_THRESHOLD_LEFT, 0, w * (1 - GAME_CONSTANTS.LEAN_THRESHOLD_LEFT), h);

      ctx.globalAlpha = 1.0;
      
      // Skeleton
      if (window.drawConnectors && window.drawLandmarks) {
          window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS,
                           {color: '#FFFFFF', lineWidth: 4});
          window.drawLandmarks(ctx, results.poseLandmarks,
                          {color: '#FF0000', lineWidth: 2, radius: 4});
      }
      
      // Instructions text (Must flip back to be readable)
      ctx.restore(); // Undo mirror for text
      
      ctx.fillStyle = "white";
      ctx.font = "bold 12px Arial";
      ctx.fillText("LEAN RIGHT", 10, h - 10);
      ctx.fillText("LEAN LEFT", w - 70, h - 10);
    }
  };

  return (
    <div className="absolute top-4 left-4 z-50 flex flex-col items-start">
      <video ref={videoRef} className="hidden" playsInline muted></video>
      
      <div className={`relative rounded-xl overflow-hidden border-4 ${showSkeleton ? 'border-white' : 'border-transparent'} shadow-xl bg-black/50`}>
        <canvas ref={canvasRef} width={240} height={180} className="block" />
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/60 px-2 rounded text-white text-xs">
            Webcam Preview
        </div>
      </div>
      
      {error && <div className="text-red-500 bg-white p-2 text-xs rounded mt-2">{error}</div>}
    </div>
  );
};

export default WebcamController;
export interface GameState {
  isPlaying: boolean;
  isPaused: boolean;
  score: number;
  gameOver: boolean;
  speed: number;
  cameraReady: boolean;
  lastLaneChange: number;
  lives: number;
}

// 0 = Left, 1 = Middle, 2 = Right
export type Lane = 0 | 1 | 2;

export interface Player3D {
  lane: Lane;
  isJumping: boolean;
  jumpStartTime: number;
  yPosition: number; // 0 is ground
}

export interface Obstacle3D {
  id: string;
  lane: Lane;
  z: number; // Position on track (starts negative, moves to positive)
  type: 'lava_block' | 'tall_lava';
  passed: boolean;
}

export interface Decoration3D {
  id: string;
  x: number;
  z: number;
  type: 'tree' | 'grass' | 'flower';
  rotation: number;
}

export type Gesture = 'NONE' | 'LEFT' | 'RIGHT' | 'JUMP';

// Global types for MediaPipe
declare global {
  interface Window {
    Pose: any;
    Camera: any;
    drawConnectors: any;
    drawLandmarks: any;
    POSE_CONNECTIONS: any;
  }
}
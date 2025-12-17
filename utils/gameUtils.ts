import * as THREE from 'three';
import { GAME_CONSTANTS } from '../constants';
import { Gesture } from '../types';

// --- AUDIO GENERATION (Retro Synth) ---
export const playDamageSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    // Retro damage sound: Sawtooth wave dropping in pitch
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.25);

    // Envelope
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);

    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    // Ignore audio errors (e.g. if user hasn't interacted yet)
    console.error(e);
  }
};

// --- TEXTURE GENERATION (Minecraft Style) ---
export const createPixelTexture = (type: 'lava' | 'stone' | 'obsidian' | 'wood' | 'leaves' | 'grass') => {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.Texture();

  // Minecraft textures are usually 16x16 pixels
  const pixels = 16;
  const scale = size / pixels;

  for (let x = 0; x < pixels; x++) {
    for (let y = 0; y < pixels; y++) {
      let color = '';
      const rand = Math.random();

      switch (type) {
        case 'lava':
          if (rand > 0.9) color = '#ffff00';
          else if (rand > 0.7) color = '#ff8800';
          else if (rand > 0.4) color = '#cf1020';
          else color = '#8a0303';
          break;
        case 'obsidian':
          const shade = Math.random() * 40;
          color = `rgb(${shade + 20}, ${shade}, ${shade + 50})`;
          break;
        case 'wood': // Oak log
          if (rand > 0.8) color = '#6b4f36';
          else if (rand > 0.4) color = '#523a24';
          else color = '#3d2b1a';
          break;
        case 'leaves': // Oak leaves
          // Make leaves semitransparent look by using very distinct greens
          if (rand > 0.7) color = '#2d6e32'; // Dark green
          else if (rand > 0.3) color = '#3a8c40'; // Mid green
          else color = '#45a14d'; // Light green
          break;
        case 'grass': // Grass top
          if (rand > 0.6) color = '#4CBB17';
          else if (rand > 0.3) color = '#3FA314';
          else color = '#328B11';
          break;
        case 'stone':
        default:
          const s = 100 + Math.random() * 50;
          color = `rgb(${s},${s},${s})`;
          if (Math.random() > 0.9) color = '#444';
          break;
      }

      ctx.fillStyle = color;
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter; // KEEP IT PIXELATED
  texture.minFilter = THREE.NearestFilter;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  
  return texture;
};

// --- GESTURE DETECTION ---

// State for gesture smoothing
let hipYHistory: number[] = [];
let baselineHipY = 0;
let lastJumpTime = 0;
let lastGestureTime = 0;

export const resetGestureState = () => {
  hipYHistory = [];
  baselineHipY = 0;
  lastJumpTime = 0;
  lastGestureTime = 0;
};

export const detectGesture = (landmarks: any, timestamp: number): Gesture => {
  if (!landmarks) return 'NONE';

  const nose = landmarks[0];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];

  // 1. Calibration (Baseline Y)
  // We use the average Y of the torso (hips + shoulders)
  const currentY = (leftHip.y + rightHip.y + leftShoulder.y + rightShoulder.y) / 4;
  
  if (hipYHistory.length < 30) {
    hipYHistory.push(currentY);
    baselineHipY = hipYHistory.reduce((a, b) => a + b, 0) / hipYHistory.length;
    return 'NONE'; // Calibrating
  } else {
    // Slowly drift baseline to accommodate posture changes
    // But NOT if we suspect a jump is happening (large difference)
    if (Math.abs(currentY - baselineHipY) < 0.05) {
        baselineHipY += (currentY - baselineHipY) * 0.05;
    }
  }

  // 2. Jump Detection
  // MediaPipe Y coordinates: 0 is top, 1 is bottom.
  // Jumping means Y decreases (body moves UP).
  // Don't detect jump if we recently changed lanes (body position shifts during lean)
  const jumpDiff = baselineHipY - currentY;
  const timeSinceLastGesture = timestamp - lastGestureTime;

  if (jumpDiff > GAME_CONSTANTS.JUMP_THRESHOLD_Y) {
    // Only allow jump if enough time passed since last jump AND last lane change
    if (timestamp - lastJumpTime > GAME_CONSTANTS.JUMP_COOLDOWN &&
        timeSinceLastGesture > GAME_CONSTANTS.LANE_CHANGE_COOLDOWN) {
        lastJumpTime = timestamp;
        return 'JUMP';
    }
  }

  // 3. Lean Detection
  if (timeSinceLastGesture < GAME_CONSTANTS.LANE_CHANGE_COOLDOWN) {
      return 'NONE';
  }

  if (nose.x > GAME_CONSTANTS.LEAN_THRESHOLD_LEFT) {
      lastGestureTime = timestamp;
      return 'LEFT';
  } else if (nose.x < GAME_CONSTANTS.LEAN_THRESHOLD_RIGHT) {
      lastGestureTime = timestamp;
      return 'RIGHT';
  }

  return 'NONE';
};
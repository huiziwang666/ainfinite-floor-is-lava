import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GameState, Player3D, Obstacle3D, Lane, Decoration3D } from '../types';
import { GAME_CONSTANTS, COLORS } from '../constants';
import { detectGesture, resetGestureState, createPixelTexture, playDamageSound } from '../utils/gameUtils';
import { Heart } from 'lucide-react';

interface GameEngineProps {
  gameState: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  poseData: any;
}

const GameEngine: React.FC<GameEngineProps> = ({ gameState, setGameState, poseData }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Game Logic Refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const playerGroupRef = useRef<THREE.Group | null>(null);
  const lavaMaterialRef = useRef<THREE.MeshBasicMaterial | null>(null);
  const lastHitTimeRef = useRef<number>(0);
  const cloudsRef = useRef<THREE.Group | null>(null);
  
  // Character Limbs Refs (for animation)
  const limbsRef = useRef<{
    leftArm: THREE.Mesh;
    rightArm: THREE.Mesh;
    leftLeg: THREE.Mesh;
    rightLeg: THREE.Mesh;
  } | null>(null);

  const playerStateRef = useRef<Player3D>({ lane: 1, isJumping: false, jumpStartTime: 0, yPosition: 0 });
  const obstaclesRef = useRef<Obstacle3D[]>([]);
  const obstacleMeshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  
  // Environment Refs
  const decorationsRef = useRef<Decoration3D[]>([]);
  const decorationMeshesRef = useRef<Map<string, THREE.Group>>(new Map());
  const envMaterialsRef = useRef<{
    wood: THREE.Material;
    leaves: THREE.Material;
    grass: THREE.Material;
    flowerStem: THREE.Material;
    flowerPetalRed: THREE.Material;
    flowerPetalYellow: THREE.Material;
  } | null>(null);

  const speedRef = useRef<number>(GAME_CONSTANTS.START_SPEED);
  const scoreRef = useRef<number>(0);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const lastSpawnTimeRef = useRef<number>(0);
  const lastDecorSpawnTimeRef = useRef<number>(0);

  // --- THREE.JS INITIALIZATION ---
  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.SKY_MINECRAFT);
    // Minecraft-style fog (lighter near horizon)
    scene.fog = new THREE.Fog(COLORS.SKY_MINECRAFT, 40, 90);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 6, 9); // Higher camera to see lanes better
    camera.lookAt(0, 0, -15);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: false }); // False for crisp pixels
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);
    const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
    sunLight.position.set(50, 100, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // 5. Sky Elements (Sun & Clouds)
    const skyGroup = new THREE.Group();
    scene.add(skyGroup);

    // Square Sun
    const sunGeo = new THREE.BoxGeometry(15, 15, 15);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const sun = new THREE.Mesh(sunGeo, sunMat);
    sun.position.set(40, 60, -80);
    // Slight rotation to look cool
    sun.rotation.z = Math.PI / 4;
    sun.rotation.y = Math.PI / 6;
    skyGroup.add(sun);

    // Clouds
    const cloudGroup = new THREE.Group();
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1); // Unit box to scale
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 });
    
    // Create random clouds (Increased count to 50)
    for (let i = 0; i < 50; i++) {
        const width = 6 + Math.random() * 14;
        const depth = 4 + Math.random() * 10;
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        cloud.scale.set(width, 2 + Math.random() * 2, depth);
        
        // Random Position in sky (Wider distribution)
        cloud.position.set(
            (Math.random() - 0.5) * 200, // X: -100 to 100
            20 + Math.random() * 40,     // Y: 20 to 60 (High up)
            10 - Math.random() * 150     // Z: 10 to -140
        );
        cloudGroup.add(cloud);
    }
    skyGroup.add(cloudGroup);
    cloudsRef.current = cloudGroup;

    // 6. Materials (Minecraft Style)
    const stoneTex = createPixelTexture('stone');
    const obsidianTex = createPixelTexture('obsidian');
    const lavaTex = createPixelTexture('lava');
    const woodTex = createPixelTexture('wood');
    const leavesTex = createPixelTexture('leaves');
    const grassTex = createPixelTexture('grass');

    envMaterialsRef.current = {
        wood: new THREE.MeshStandardMaterial({ map: woodTex }),
        leaves: new THREE.MeshStandardMaterial({ map: leavesTex }),
        grass: new THREE.MeshStandardMaterial({ map: grassTex }),
        flowerStem: new THREE.MeshStandardMaterial({ color: 0x00aa00 }),
        flowerPetalRed: new THREE.MeshStandardMaterial({ color: 0xff0000 }),
        flowerPetalYellow: new THREE.MeshStandardMaterial({ color: 0xffff00 })
    };
    
    // Store lava material ref to animate it later
    const lavaMat = new THREE.MeshBasicMaterial({ 
        map: lavaTex,
        color: 0xffffff
    });
    lavaMaterialRef.current = lavaMat;

    // --- CREATE 3 DISTINCT LANES ---
    stoneTex.repeat.set(4, 40); // Repeat vertically
    const laneGeo = new THREE.PlaneGeometry(GAME_CONSTANTS.LANE_WIDTH - 0.4, 200);
    const laneMat = new THREE.MeshStandardMaterial({ map: stoneTex });

    // Lane 0 (Left)
    const laneLeft = new THREE.Mesh(laneGeo, laneMat);
    laneLeft.rotation.x = -Math.PI / 2;
    laneLeft.position.set(-GAME_CONSTANTS.LANE_WIDTH, 0, -50);
    laneLeft.receiveShadow = true;
    scene.add(laneLeft);

    // Lane 1 (Middle)
    const laneMid = new THREE.Mesh(laneGeo, laneMat);
    laneMid.rotation.x = -Math.PI / 2;
    laneMid.position.set(0, 0, -50);
    laneMid.receiveShadow = true;
    scene.add(laneMid);

    // Lane 2 (Right)
    const laneRight = new THREE.Mesh(laneGeo, laneMat);
    laneRight.rotation.x = -Math.PI / 2;
    laneRight.position.set(GAME_CONSTANTS.LANE_WIDTH, 0, -50);
    laneRight.receiveShadow = true;
    scene.add(laneRight);

    // --- DIVIDERS (Obsidian) ---
    obsidianTex.repeat.set(1, 40);
    const dividerGeo = new THREE.BoxGeometry(0.4, 0.2, 200);
    const dividerMat = new THREE.MeshStandardMaterial({ map: obsidianTex });
    
    // Divider Left/Mid
    const div1 = new THREE.Mesh(dividerGeo, dividerMat);
    div1.position.set(-GAME_CONSTANTS.LANE_WIDTH / 2, 0.1, -50);
    scene.add(div1);

    // Divider Mid/Right
    const div2 = new THREE.Mesh(dividerGeo, dividerMat);
    div2.position.set(GAME_CONSTANTS.LANE_WIDTH / 2, 0.1, -50);
    scene.add(div2);

    // 7. Player (Minecraft Steve-like rig)
    const { group, limbs } = createCharacterMesh();
    group.position.set(0, 0, 0);
    scene.add(group);
    playerGroupRef.current = group;
    limbsRef.current = limbs;

    // --- GAME LOOP ---
    resetGestureState();
    lastTimeRef.current = performance.now();
    playerStateRef.current = { lane: 1, isJumping: false, jumpStartTime: 0, yPosition: 0 };
    obstaclesRef.current = [];
    decorationsRef.current = [];
    scoreRef.current = 0;
    speedRef.current = GAME_CONSTANTS.START_SPEED;
    lastHitTimeRef.current = 0;

    const animate = (time: number) => {
        if (!gameState.isPlaying || gameState.gameOver) return;
        
        const delta = (time - lastTimeRef.current) / 1000;
        lastTimeRef.current = time;

        updateGameLogic(delta, time);
        renderScene();
        
        animationFrameRef.current = requestAnimationFrame(animate);
    };

    if (gameState.isPlaying) {
        animationFrameRef.current = requestAnimationFrame(animate);
    }

    // Cleanup
    return () => {
        cancelAnimationFrame(animationFrameRef.current);
        if (rendererRef.current && containerRef.current) {
            containerRef.current.removeChild(rendererRef.current.domElement);
            rendererRef.current.dispose();
        }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState.isPlaying, gameState.gameOver]);


  // --- INPUT HANDLING ---
  useEffect(() => {
    if (!gameState.isPlaying || gameState.gameOver || !poseData) return;
    
    const now = performance.now();
    const gesture = detectGesture(poseData.poseLandmarks, now);
    
    if (gesture === 'JUMP' && !playerStateRef.current.isJumping) {
        playerStateRef.current.isJumping = true;
        playerStateRef.current.jumpStartTime = now;
    } else if (gesture === 'LEFT') {
        const currentLane = playerStateRef.current.lane;
        if (currentLane > 0) playerStateRef.current.lane = (currentLane - 1) as Lane;
    } else if (gesture === 'RIGHT') {
        const currentLane = playerStateRef.current.lane;
        if (currentLane < 2) playerStateRef.current.lane = (currentLane + 1) as Lane;
    }

  }, [poseData, gameState.isPlaying, gameState.gameOver]);


  // --- HELPERS ---

  const createCharacterMesh = () => {
      const group = new THREE.Group();
      
      const skinMat = new THREE.MeshStandardMaterial({ color: 0xffcc99 });
      const shirtMat = new THREE.MeshStandardMaterial({ color: 0x00AAAA }); // Teal Shirt
      const pantsMat = new THREE.MeshStandardMaterial({ color: 0x333399 }); // Dark Blue Pants
      
      // Head
      const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
      const head = new THREE.Mesh(headGeo, skinMat);
      head.position.y = 1.75;
      head.castShadow = true;
      group.add(head);

      // Body
      const bodyGeo = new THREE.BoxGeometry(0.5, 0.75, 0.25);
      const body = new THREE.Mesh(bodyGeo, shirtMat);
      body.position.y = 1.125;
      body.castShadow = true;
      group.add(body);

      // Limbs - Pivot logic handled by grouping or just updating pos/rot
      // Arms
      const armGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);
      const leftArm = new THREE.Mesh(armGeo, shirtMat); // Sleeve color
      leftArm.position.set(-0.4, 1.125, 0);
      leftArm.castShadow = true;
      group.add(leftArm);

      const rightArm = new THREE.Mesh(armGeo, shirtMat);
      rightArm.position.set(0.4, 1.125, 0);
      rightArm.castShadow = true;
      group.add(rightArm);

      // Legs
      const legGeo = new THREE.BoxGeometry(0.2, 0.75, 0.2);
      const leftLeg = new THREE.Mesh(legGeo, pantsMat);
      leftLeg.position.set(-0.15, 0.375, 0);
      leftLeg.castShadow = true;
      group.add(leftLeg);

      const rightLeg = new THREE.Mesh(legGeo, pantsMat);
      rightLeg.position.set(0.15, 0.375, 0);
      rightLeg.castShadow = true;
      group.add(rightLeg);

      return { 
        group, 
        limbs: { leftArm, rightArm, leftLeg, rightLeg } 
      };
  };

  const createEnvironmentMesh = (type: 'tree' | 'grass' | 'flower'): THREE.Group => {
    const group = new THREE.Group();
    if (!envMaterialsRef.current) return group;
    
    if (type === 'tree') {
        // Trunk
        const trunkGeo = new THREE.BoxGeometry(1, 4, 1);
        const trunk = new THREE.Mesh(trunkGeo, envMaterialsRef.current.wood);
        trunk.position.y = 2; // Base at 0
        trunk.castShadow = true;
        group.add(trunk);
        
        // Leaves
        const leavesGeo = new THREE.BoxGeometry(3, 3, 3);
        const leaves = new THREE.Mesh(leavesGeo, envMaterialsRef.current.leaves);
        leaves.position.y = 5;
        leaves.castShadow = true;
        group.add(leaves);
    } else if (type === 'grass') {
        const bladeGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        // Cluster of blades
        for(let i=0; i<3; i++) {
            const blade = new THREE.Mesh(bladeGeo, envMaterialsRef.current.grass);
            blade.position.set(
                (Math.random()-0.5) * 0.8,
                0.3,
                (Math.random()-0.5) * 0.8
            );
            blade.rotation.y = Math.random() * Math.PI;
            group.add(blade);
        }
    } else if (type === 'flower') {
        // Stem
        const stemGeo = new THREE.BoxGeometry(0.1, 0.5, 0.1);
        const stem = new THREE.Mesh(stemGeo, envMaterialsRef.current.flowerStem);
        stem.position.y = 0.25;
        group.add(stem);
        
        // Flower Head
        const headGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const isYellow = Math.random() > 0.5;
        const head = new THREE.Mesh(
            headGeo, 
            isYellow ? envMaterialsRef.current.flowerPetalYellow : envMaterialsRef.current.flowerPetalRed
        );
        head.position.y = 0.5;
        group.add(head);
    }

    return group;
  }

  const spawnDecoration = (z: number) => {
    if (!sceneRef.current) return;

    // Spawn on Left (-X) or Right (+X)
    const isLeft = Math.random() > 0.5;
    const baseOffset = 6;
    const randomOffset = Math.random() * 20; // Spread out to side
    const x = isLeft ? -(baseOffset + randomOffset) : (baseOffset + randomOffset);
    
    // Determine Type
    const rand = Math.random();
    let type: 'tree' | 'grass' | 'flower' = 'grass';
    if (rand > 0.8) type = 'tree';
    else if (rand > 0.6) type = 'flower';

    const id = Math.random().toString();
    const decoration: Decoration3D = {
        id,
        x,
        z,
        type,
        rotation: Math.random() * Math.PI * 2
    };

    decorationsRef.current.push(decoration);

    const meshGroup = createEnvironmentMesh(type);
    meshGroup.position.set(x, 0, z);
    meshGroup.rotation.y = decoration.rotation;
    
    // Scale randomization
    const s = 0.8 + Math.random() * 0.4;
    meshGroup.scale.set(s, s, s);

    sceneRef.current.add(meshGroup);
    decorationMeshesRef.current.set(id, meshGroup);
  };

  const spawnObstacle = (z: number) => {
      if (!sceneRef.current || !lavaMaterialRef.current) return;
      
      const lane = Math.floor(Math.random() * 3) as Lane;
      const id = Math.random().toString();
      
      obstaclesRef.current.push({
          id,
          lane,
          z,
          type: 'lava_block',
          passed: false
      });

      // 1x1x1 Minecraft Block
      const geo = new THREE.BoxGeometry(GAME_CONSTANTS.LANE_WIDTH * 0.8, 1.0, 1.0);
      const mesh = new THREE.Mesh(geo, lavaMaterialRef.current);
      
      mesh.position.set(
          (lane - 1) * GAME_CONSTANTS.LANE_WIDTH,
          0.5, // Sitting on floor
          z
      );
      mesh.castShadow = true;
      
      sceneRef.current.add(mesh);
      obstacleMeshesRef.current.set(id, mesh);
  };

  const updateGameLogic = (dt: number, time: number) => {
      const player = playerStateRef.current;
      
      // 1. Difficulty
      speedRef.current = Math.min(
          GAME_CONSTANTS.MAX_SPEED, 
          GAME_CONSTANTS.START_SPEED + (scoreRef.current / 50)
      );

      // 2. Animate Materials & Environment
      if (lavaMaterialRef.current && lavaMaterialRef.current.map) {
          // Flowing Lava
          lavaMaterialRef.current.map.offset.y -= dt * 0.2;
      }

      // Drift Clouds
      if (cloudsRef.current) {
          cloudsRef.current.children.forEach(cloud => {
              cloud.position.x += dt * 0.5; // Slow drift
              // Loop clouds if they go too far (Wider wrap-around)
              if (cloud.position.x > 100) cloud.position.x = -100;
          });
      }

      // 3. Player Movement & Animation
      const targetX = (player.lane - 1) * GAME_CONSTANTS.LANE_WIDTH;
      if (playerGroupRef.current) {
          // Lane Lerp
          playerGroupRef.current.position.x += (targetX - playerGroupRef.current.position.x) * 10 * dt;
          
          // Jump Physics
          if (player.isJumping) {
              const jumpProgress = (time - player.jumpStartTime) / 1000;
              if (jumpProgress < GAME_CONSTANTS.JUMP_DURATION) {
                  const t = jumpProgress / GAME_CONSTANTS.JUMP_DURATION;
                  player.yPosition = GAME_CONSTANTS.JUMP_HEIGHT * 4 * t * (1 - t);
              } else {
                  player.isJumping = false;
                  player.yPosition = 0;
              }
          }
          playerGroupRef.current.position.y = player.yPosition;

          // Limb Animation (Running)
          if (limbsRef.current) {
              const { leftArm, rightArm, leftLeg, rightLeg } = limbsRef.current;
              
              if (player.isJumping) {
                  // Freeze poses or specific jump pose
                  leftArm.rotation.x = -Math.PI; // Arms up!
                  rightArm.rotation.x = -Math.PI;
                  leftLeg.rotation.x = -0.5;
                  rightLeg.rotation.x = 0.5;
              } else {
                  // Run Cycle (Sine wave)
                  const speed = 15;
                  const angle = Math.sin(time * 0.01) * 0.8;
                  
                  leftArm.rotation.x = angle;
                  rightArm.rotation.x = -angle;
                  leftLeg.rotation.x = -angle;
                  rightLeg.rotation.x = angle;
              }
          }

          // Invincibility Blink Logic
          if (time - lastHitTimeRef.current < GAME_CONSTANTS.INVINCIBILITY_DURATION) {
              // Blink every 100ms
              playerGroupRef.current.visible = Math.floor(time / 100) % 2 === 0;
          } else {
              playerGroupRef.current.visible = true;
          }
      }

      // 4. Spawn & Move Environment
      // Spawn decorations 5 times faster than obstacles to fill the world
      if (time - lastDecorSpawnTimeRef.current > (GAME_CONSTANTS.SPAWN_INTERVAL_BASE * 1000) / (speedRef.current / 15) / 5) {
        spawnDecoration(GAME_CONSTANTS.SPAWN_DISTANCE);
        lastDecorSpawnTimeRef.current = time;
      }
      
      const decorsToRemove: string[] = [];
      decorationsRef.current.forEach(dec => {
          dec.z += speedRef.current * dt;
          const mesh = decorationMeshesRef.current.get(dec.id);
          if (mesh) {
              mesh.position.z = dec.z;
          }
          if (dec.z > 20) { // Past camera
              decorsToRemove.push(dec.id);
          }
      });
      
      decorsToRemove.forEach(id => {
          const mesh = decorationMeshesRef.current.get(id);
          if (mesh && sceneRef.current) {
              sceneRef.current.remove(mesh);
          }
          decorationMeshesRef.current.delete(id);
      });
      decorationsRef.current = decorationsRef.current.filter(d => !decorsToRemove.includes(d.id));


      // 5. Obstacle Logic
      if (time - lastSpawnTimeRef.current > (GAME_CONSTANTS.SPAWN_INTERVAL_BASE * 1000) / (speedRef.current / 15)) {
          spawnObstacle(GAME_CONSTANTS.SPAWN_DISTANCE);
          lastSpawnTimeRef.current = time;
      }

      const obstaclesToRemove: string[] = [];
      
      obstaclesRef.current.forEach(obs => {
          obs.z += speedRef.current * dt;
          
          const mesh = obstacleMeshesRef.current.get(obs.id);
          if (mesh) {
              mesh.position.z = obs.z;
          }

          // Collision (Simple AABB)
          if (obs.z > -1 && obs.z < 1) {
              if (obs.lane === player.lane) {
                  // Must jump over
                  if (player.yPosition < 1.1) {
                      // COLLISION!
                      // Check invincibility
                      const now = performance.now();
                      if (now - lastHitTimeRef.current > GAME_CONSTANTS.INVINCIBILITY_DURATION) {
                          playDamageSound(); // <--- PLAY SOUND HERE
                          lastHitTimeRef.current = now;
                          // Use functional update to check latest lives state
                          setGameState(prev => {
                              const newLives = prev.lives - 1;
                              if (newLives <= 0) {
                                  return { ...prev, lives: 0, gameOver: true, score: scoreRef.current };
                              }
                              return { ...prev, lives: newLives };
                          });
                      }
                  }
              }
          }

          if (obs.z > 5) {
              if (!obs.passed) {
                  scoreRef.current += 10;
                  obs.passed = true;
              }
              obstaclesToRemove.push(obs.id);
          }
      });

      obstaclesToRemove.forEach(id => {
          const mesh = obstacleMeshesRef.current.get(id);
          if (mesh && sceneRef.current) {
              sceneRef.current.remove(mesh);
              // Clean up geometry
              (mesh.geometry as THREE.BufferGeometry).dispose();
          }
          obstacleMeshesRef.current.delete(id);
      });
      obstaclesRef.current = obstaclesRef.current.filter(o => !obstaclesToRemove.includes(o.id));
  };

  const renderScene = () => {
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  return (
    <div className="relative w-full h-full">
        <div ref={containerRef} className="w-full h-full block" />
        
        {/* HUD */}
        <div className="absolute top-8 left-1/2 transform -translate-x-1/2 text-center pointer-events-none z-10">
            <h1 className="text-5xl text-white game-font text-outline leading-tight drop-shadow-lg">
                MINECRAFT STYLE RUNNER
            </h1>
        </div>

        {/* Lives & Score Panel */}
        <div className="absolute bottom-8 left-8 hud-panel rounded-none border-4 border-gray-800 bg-gray-700/80 p-4 shadow-xl flex gap-8 items-center">
            <div>
                <div className="text-yellow-400 text-sm font-bold uppercase mb-1">XP / Score</div>
                <div className="text-4xl text-green-400 font-black font-mono">
                    {scoreRef.current}
                </div>
            </div>
            
            <div className="border-l-2 border-gray-500 pl-8">
                <div className="text-red-400 text-sm font-bold uppercase mb-1">Health</div>
                <div className="flex gap-2">
                    {[1, 2, 3].map((life) => (
                        <Heart 
                           key={life} 
                           fill={life <= gameState.lives ? "#EF4444" : "none"} 
                           color={life <= gameState.lives ? "#EF4444" : "#666"}
                           size={32}
                           className="drop-shadow-sm"
                        />
                    ))}
                </div>
            </div>
        </div>
        
        <div className="absolute bottom-8 right-8 hud-panel rounded-none border-4 border-gray-800 bg-gray-700/80 p-4 shadow-xl text-center">
             <div className="text-white text-xs font-bold">JUMP DETECTOR</div>
             <div className="text-yellow-400 text-xs mt-1">Stand & Jump UP!</div>
        </div>

        {playerStateRef.current.isJumping && (
            <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2">
                 <div className="text-orange-500 font-black text-6xl text-outline animate-bounce">JUMP!</div>
            </div>
        )}
    </div>
  );
};

export default GameEngine;
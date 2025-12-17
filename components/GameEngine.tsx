import React, { useEffect, useRef } from 'react';
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

  // Audio Ref
  const bgMusicRef = useRef<HTMLAudioElement | null>(null);

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
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

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

    // Clouds - Minecraft style blocky clouds (lots of them!)
    const cloudGroup = new THREE.Group();
    const cloudGeo = new THREE.BoxGeometry(1, 1, 1); // Unit box to scale
    const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

    // Create MANY random clouds (100+)
    for (let i = 0; i < 120; i++) {
        const width = 8 + Math.random() * 16;
        const depth = 6 + Math.random() * 12;
        const cloud = new THREE.Mesh(cloudGeo, cloudMat);
        cloud.scale.set(width, 2 + Math.random() * 2, depth);

        // Random Position in sky (Wider distribution)
        cloud.position.set(
            (Math.random() - 0.5) * 250, // X: -125 to 125
            15 + Math.random() * 50,     // Y: 15 to 65 (High up)
            20 - Math.random() * 180     // Z: 20 to -160
        );
        cloudGroup.add(cloud);
    }
    skyGroup.add(cloudGroup);
    cloudsRef.current = cloudGroup;

    // GREEN GROUND PLANES (Minecraft grass on both sides)
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x5d8c3d }); // Minecraft grass green

    // Left ground
    const leftGroundGeo = new THREE.PlaneGeometry(100, 250);
    const leftGround = new THREE.Mesh(leftGroundGeo, groundMat);
    leftGround.rotation.x = -Math.PI / 2;
    leftGround.position.set(-55, -0.1, -75);
    leftGround.receiveShadow = true;
    scene.add(leftGround);

    // Right ground
    const rightGroundGeo = new THREE.PlaneGeometry(100, 250);
    const rightGround = new THREE.Mesh(rightGroundGeo, groundMat);
    rightGround.rotation.x = -Math.PI / 2;
    rightGround.position.set(55, -0.1, -75);
    rightGround.receiveShadow = true;
    scene.add(rightGround);

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

    // Render initial frame
    renderer.render(scene, camera);

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


  // --- ANIMATION LOOP ---
  useEffect(() => {
    if (!gameState.isPlaying || gameState.gameOver) return;
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;

    isPlayingRef.current = true;
    isPausedRef.current = gameState.isPaused;
    lastTimeRef.current = performance.now();

    const animate = (time: number) => {
      if (!isPlayingRef.current) return;

      // Always request next frame to keep loop alive
      animationFrameRef.current = requestAnimationFrame(animate);

      // Skip game logic when paused, but still render
      if (isPausedRef.current) {
        lastTimeRef.current = time;
        renderScene();
        return;
      }

      const delta = (time - lastTimeRef.current) / 1000;
      lastTimeRef.current = time;

      updateGameLogic(delta, time);
      renderScene();
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      isPlayingRef.current = false;
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState.isPlaying, gameState.gameOver]);

  // --- PAUSE STATE SYNC ---
  useEffect(() => {
    isPausedRef.current = gameState.isPaused;
  }, [gameState.isPaused]);

  // --- BACKGROUND MUSIC ---
  useEffect(() => {
    // Initialize audio once
    if (!bgMusicRef.current) {
      bgMusicRef.current = new Audio('/music.mp3');
      bgMusicRef.current.loop = true;
      bgMusicRef.current.volume = 0.5;
    }

    const music = bgMusicRef.current;

    if (gameState.isPlaying && !gameState.gameOver && !gameState.isPaused) {
      music.play().catch(() => {
        // Autoplay may be blocked, will play on next user interaction
      });
    } else {
      music.pause();
      if (gameState.gameOver || !gameState.isPlaying) {
        music.currentTime = 0;
      }
    }

    return () => {
      music.pause();
    };
  }, [gameState.isPlaying, gameState.gameOver, gameState.isPaused]);

  // --- INPUT HANDLING ---
  useEffect(() => {
    if (!gameState.isPlaying || gameState.gameOver || gameState.isPaused || !poseData) return;
    
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

  }, [poseData, gameState.isPlaying, gameState.gameOver, gameState.isPaused]);


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
        // Minecraft style blocky tree
        // Trunk - stack of wood blocks
        const trunkHeight = 4 + Math.floor(Math.random() * 3);
        for (let y = 0; y < trunkHeight; y++) {
            const trunkGeo = new THREE.BoxGeometry(1, 1, 1);
            const trunk = new THREE.Mesh(trunkGeo, envMaterialsRef.current.wood);
            trunk.position.y = y + 0.5;
            trunk.castShadow = true;
            group.add(trunk);
        }

        // Leaves - blocky cube cluster
        const leafPositions = [
            // Top layer
            [0, trunkHeight + 2, 0],
            // Second layer (cross pattern)
            [0, trunkHeight + 1, 0],
            [1, trunkHeight + 1, 0], [-1, trunkHeight + 1, 0],
            [0, trunkHeight + 1, 1], [0, trunkHeight + 1, -1],
            // Third layer (bigger cross)
            [0, trunkHeight, 0],
            [1, trunkHeight, 0], [-1, trunkHeight, 0],
            [0, trunkHeight, 1], [0, trunkHeight, -1],
            [1, trunkHeight, 1], [-1, trunkHeight, 1],
            [1, trunkHeight, -1], [-1, trunkHeight, -1],
            // Fourth layer
            [1, trunkHeight - 1, 0], [-1, trunkHeight - 1, 0],
            [0, trunkHeight - 1, 1], [0, trunkHeight - 1, -1],
            [1, trunkHeight - 1, 1], [-1, trunkHeight - 1, 1],
            [1, trunkHeight - 1, -1], [-1, trunkHeight - 1, -1],
        ];

        leafPositions.forEach(pos => {
            const leafGeo = new THREE.BoxGeometry(1, 1, 1);
            const leaf = new THREE.Mesh(leafGeo, envMaterialsRef.current!.leaves);
            leaf.position.set(pos[0], pos[1], pos[2]);
            leaf.castShadow = true;
            group.add(leaf);
        });

    } else if (type === 'grass') {
        // Minecraft style grass - small green blocks
        const clusterSize = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < clusterSize; i++) {
            const grassGeo = new THREE.BoxGeometry(0.3, 0.5 + Math.random() * 0.3, 0.3);
            const grass = new THREE.Mesh(grassGeo, envMaterialsRef.current.grass);
            grass.position.set(
                (Math.random() - 0.5) * 1.2,
                0.25,
                (Math.random() - 0.5) * 1.2
            );
            group.add(grass);
        }

    } else if (type === 'flower') {
        // Minecraft style flower - stem block + colored top block
        // Stem
        const stemGeo = new THREE.BoxGeometry(0.2, 0.6, 0.2);
        const stem = new THREE.Mesh(stemGeo, envMaterialsRef.current.flowerStem);
        stem.position.y = 0.3;
        group.add(stem);

        // Flower head - random color
        const isRed = Math.random() > 0.5;
        const headGeo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
        const head = new THREE.Mesh(
            headGeo,
            isRed ? envMaterialsRef.current.flowerPetalRed : envMaterialsRef.current.flowerPetalYellow
        );
        head.position.y = 0.7;
        group.add(head);
    }

    return group;
  }

  const spawnDecoration = (z: number) => {
    if (!sceneRef.current) return;

    // Spawn on Left (-X) or Right (+X) - forest on both sides
    const isLeft = Math.random() > 0.5;
    const baseOffset = 8; // Keep decorations away from running lane
    const randomOffset = Math.random() * 50; // Wide spread
    const x = isLeft ? -(baseOffset + randomOffset) : (baseOffset + randomOffset);

    // Determine Type - balanced mix
    const rand = Math.random();
    let type: 'tree' | 'grass' | 'flower' = 'grass';
    if (rand > 0.75) type = 'tree';        // 25% trees
    else if (rand > 0.4) type = 'flower';  // 35% flowers
    // 40% grass

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

    // Scale randomization - bigger trees!
    let s = 0.8 + Math.random() * 0.4;
    if (type === 'tree') s = 0.9 + Math.random() * 0.6; // Trees can be bigger
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
      // Spawn decorations at moderate rate
      if (time - lastDecorSpawnTimeRef.current > (GAME_CONSTANTS.SPAWN_INTERVAL_BASE * 1000) / (speedRef.current / 15) / 8) {
        // Spawn 2 decorations at a time
        for (let i = 0; i < 2; i++) {
            spawnDecoration(GAME_CONSTANTS.SPAWN_DISTANCE - Math.random() * 20);
        }
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
            <h1 className="text-5xl text-[#F5B819] game-font leading-tight drop-shadow-lg" style={{textShadow: '3px 3px 0 #1E3A5F, -1px -1px 0 #1E3A5F, 1px -1px 0 #1E3A5F, -1px 1px 0 #1E3A5F'}}>
                AINFINITE MINECRAFT RUNNER
            </h1>
        </div>

        {/* Lives & Score Panel */}
        <div className="absolute bottom-8 left-8 hud-panel rounded-none border-4 border-[#1E3A5F] bg-[#1E3A5F]/80 p-4 shadow-xl flex gap-8 items-center">
            <div>
                <div className="text-[#F5B819] text-sm font-bold uppercase mb-1">XP / Score</div>
                <div className="text-4xl text-white font-black font-mono">
                    {scoreRef.current}
                </div>
            </div>

            <div className="border-l-2 border-[#F5B819]/30 pl-8">
                <div className="text-[#F5B819] text-sm font-bold uppercase mb-1">Health</div>
                <div className="flex gap-2">
                    {[1, 2, 3].map((life) => (
                        <Heart
                           key={life}
                           fill={life <= gameState.lives ? "#F5B819" : "none"}
                           color={life <= gameState.lives ? "#F5B819" : "#666"}
                           size={32}
                           className="drop-shadow-sm"
                        />
                    ))}
                </div>
            </div>
        </div>

        <div className="absolute bottom-8 right-8 hud-panel rounded-none border-4 border-[#1E3A5F] bg-[#1E3A5F]/80 p-4 shadow-xl text-center">
             <div className="text-white text-xs font-bold">JUMP DETECTOR</div>
             <div className="text-[#F5B819] text-xs mt-1">Stand & Jump UP!</div>
        </div>

        {playerStateRef.current.isJumping && (
            <div className="absolute top-1/4 left-1/2 transform -translate-x-1/2">
                 <div className="text-[#F5B819] font-black text-6xl animate-bounce" style={{textShadow: '3px 3px 0 #1E3A5F, -1px -1px 0 #1E3A5F, 1px -1px 0 #1E3A5F, -1px 1px 0 #1E3A5F'}}>JUMP!</div>
            </div>
        )}
    </div>
  );
};

export default GameEngine;
import React, { useState } from 'react';
import { GameState } from './types';
import WebcamController from './components/WebcamController';
import GameEngine from './components/GameEngine';
import { Play, RotateCcw, Hand, Heart } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    score: 0,
    gameOver: false,
    speed: 0,
    cameraReady: false,
    lastLaneChange: 0,
    lives: 3
  });

  const [poseData, setPoseData] = useState<any>(null);

  const handleStart = () => {
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      gameOver: false,
      score: 0,
      lives: 3
    }));
  };

  const handleRestart = () => {
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      gameOver: false,
      score: 0,
      lives: 3
    }));
  };

  const onCameraReady = () => {
    setGameState(prev => ({ ...prev, cameraReady: true }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#87CEEB]">
      {/* Branding */}
      <div className="absolute bottom-4 right-4 z-50 bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20 flex flex-col items-center">
        <Hand className="text-blue-300 mb-1" size={24} />
        <div className="text-white/80 text-[10px] font-bold uppercase tracking-wider text-center leading-tight">
            AInfinite<br/>Game Studio
        </div>
      </div>

      <WebcamController 
        onPoseUpdate={setPoseData} 
        onCameraReady={onCameraReady}
        showSkeleton={true} 
      />

      {/* Main Game Container */}
      <GameEngine 
          gameState={gameState} 
          setGameState={setGameState} 
          poseData={poseData}
      />

      {/* UI Overlays */}
      {(!gameState.isPlaying || gameState.gameOver) && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl border-b-8 border-gray-300 relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-orange-400 to-red-500 z-0"></div>
              
              <div className="relative z-10 pt-4">
                {!gameState.gameOver ? (
                    // START SCREEN
                    <>
                        <h1 className="text-4xl text-white font-black drop-shadow-md mb-8 game-font text-outline">
                            FLOOR IS LAVA: 3D
                        </h1>
                        
                        {!gameState.cameraReady ? (
                            <div className="animate-pulse text-xl text-gray-500 mb-8 py-8">
                                Loading Vision AI...
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 text-left bg-gray-50 p-4 rounded-xl border-2 border-gray-100">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">🧍</div>
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">Stand Back</div>
                                            <div className="text-xs text-gray-500">Show full body</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-xl">↔️</div>
                                        <div>
                                            <div className="font-bold text-gray-800 text-sm">Lean</div>
                                            <div className="text-xs text-gray-500">To switch lanes</div>
                                        </div>
                                    </div>
                                    <div className="col-span-2 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center text-xl">⬆️</div>
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm">HOW TO JUMP</div>
                                                <div className="text-xs text-gray-600">Quickly jump UP with your whole body!</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleStart}
                                    className="w-full py-5 bg-green-500 hover:bg-green-600 text-white text-3xl rounded-2xl font-black shadow-[0_6px_0_rgb(21,128,61)] active:shadow-[0_2px_0_rgb(21,128,61)] active:translate-y-1 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
                                >
                                    <Play size={32} fill="currentColor" />
                                    PLAY
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    // GAME OVER
                    <>
                        <h1 className="text-5xl text-white font-black drop-shadow-md mb-2 game-font text-outline">
                            GAME OVER
                        </h1>
                        <p className="text-lg text-gray-600 font-bold mb-8">Out of lives!</p>
                        
                        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-6 mb-8">
                            <div className="text-xs text-yellow-600 font-bold uppercase tracking-widest mb-1">Final Score</div>
                            <div className="text-6xl text-yellow-500 font-black game-font">{gameState.score}</div>
                        </div>

                        <button 
                            onClick={handleRestart}
                            className="w-full py-5 bg-blue-500 hover:bg-blue-600 text-white text-2xl rounded-2xl font-black shadow-[0_6px_0_rgb(29,78,216)] active:shadow-[0_2px_0_rgb(29,78,216)] active:translate-y-1 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
                        >
                            <RotateCcw size={28} />
                            Try Again
                        </button>
                    </>
                )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
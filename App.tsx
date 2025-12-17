import React, { useState } from 'react';
import { GameState } from './types';
import WebcamController from './components/WebcamController';
import GameEngine from './components/GameEngine';
import { Play, RotateCcw, Pause } from 'lucide-react';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    isPlaying: false,
    isPaused: false,
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
      isPaused: false,
      gameOver: false,
      score: 0,
      lives: 3
    }));
  };

  const handleRestart = () => {
    setGameState(prev => ({
      ...prev,
      isPlaying: true,
      isPaused: false,
      gameOver: false,
      score: 0,
      lives: 3
    }));
  };

  const handlePause = () => {
    setGameState(prev => ({ ...prev, isPaused: true }));
  };

  const handleResume = () => {
    setGameState(prev => ({ ...prev, isPaused: false }));
  };

  const onCameraReady = () => {
    setGameState(prev => ({ ...prev, cameraReady: true }));
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#87CEEB]">
      {/* Branding */}
      <div className="absolute bottom-4 right-4 z-50 bg-white/10 backdrop-blur-md p-2 rounded-lg border border-white/20 flex flex-col items-center">
        <img src="/new-logo.png" alt="AInfinite Game Studio" className="w-10 h-10 mb-1" />
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

      {/* Pause Button - visible during active gameplay */}
      {gameState.isPlaying && !gameState.gameOver && !gameState.isPaused && (
        <button
          onClick={handlePause}
          className="absolute top-8 right-8 z-50 bg-[#1E3A5F]/80 hover:bg-[#1E3A5F] p-3 rounded-lg border-2 border-[#F5B819] transition-all"
        >
          <Pause size={28} color="#F5B819" />
        </button>
      )}

      {/* Pause Overlay */}
      {gameState.isPlaying && gameState.isPaused && !gameState.gameOver && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl border-b-8 border-[#1E3A5F]">
            <img src="/new-logo.png" alt="AInfinite" className="w-16 h-16 mx-auto mb-4" />
            <h2 className="text-3xl text-[#1E3A5F] font-black mb-6 game-font">PAUSED</h2>
            <button
              onClick={handleResume}
              className="w-full py-4 bg-[#F5B819] hover:bg-[#E5A008] text-[#1E3A5F] text-xl rounded-xl font-black shadow-[0_4px_0_#B8860B] active:shadow-[0_2px_0_#B8860B] active:translate-y-[2px] transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
            >
              <Play size={24} fill="currentColor" />
              Resume
            </button>
          </div>
        </div>
      )}

      {/* UI Overlays */}
      {(!gameState.isPlaying || gameState.gameOver) && (
        <div className="absolute inset-0 flex items-center justify-center z-40 bg-black/60 backdrop-blur-sm">
           <div className="bg-white rounded-3xl p-8 max-w-lg w-full text-center shadow-2xl border-b-8 border-[#1E3A5F] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-28 bg-[#F5B819]/10 z-0"></div>

              <div className="relative z-10 pt-2">
                {!gameState.gameOver ? (
                    // START SCREEN
                    <>
                        <img src="/new-logo.png" alt="AInfinite" className="w-16 h-16 mx-auto mb-2" />
                        <h1 className="text-3xl text-[#1E3A5F] font-black drop-shadow-md mb-6 game-font">
                            AINFINITE MINECRAFT RUNNER
                        </h1>
                        
                        {!gameState.cameraReady ? (
                            <div className="animate-pulse text-xl text-gray-500 mb-8 py-8">
                                Loading Vision AI...
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="grid grid-cols-2 gap-4 text-left bg-[#1E3A5F]/5 p-4 rounded-xl border-2 border-[#1E3A5F]/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#F5B819]/20 flex items-center justify-center text-xl">🧍</div>
                                        <div>
                                            <div className="font-bold text-[#1E3A5F] text-sm">Stand Back</div>
                                            <div className="text-xs text-[#1E3A5F]/60">Show full body</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-[#F5B819]/20 flex items-center justify-center text-xl">↔️</div>
                                        <div>
                                            <div className="font-bold text-[#1E3A5F] text-sm">Lean</div>
                                            <div className="text-xs text-[#1E3A5F]/60">To switch lanes</div>
                                        </div>
                                    </div>
                                    <div className="col-span-2 bg-[#F5B819]/10 p-2 rounded-lg border border-[#F5B819]/30">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-[#F5B819]/30 flex items-center justify-center text-xl">⬆️</div>
                                            <div>
                                                <div className="font-bold text-[#1E3A5F] text-sm">HOW TO JUMP</div>
                                                <div className="text-xs text-[#1E3A5F]/70">Quickly jump UP with your whole body!</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <button
                                    onClick={handleStart}
                                    className="w-full py-5 bg-[#F5B819] hover:bg-[#E5A008] text-[#1E3A5F] text-3xl rounded-2xl font-black shadow-[0_6px_0_#B8860B] active:shadow-[0_2px_0_#B8860B] active:translate-y-1 transition-all flex items-center justify-center gap-3 uppercase tracking-wider"
                                >
                                    <Play size={32} fill="currentColor" />
                                    PLAY
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    // GAME OVER - Clean modern design
                    <div className="-mt-4">
                        {/* Logo with glow effect */}
                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex justify-center items-center">
                                <div className="w-28 h-28 bg-[#F5B819]/20 rounded-full blur-xl"></div>
                            </div>
                            <img src="/new-logo.png" alt="AInfinite" className="w-24 h-24 mx-auto relative z-10" />
                        </div>

                        {/* Game Over Text */}
                        <h1 className="text-4xl text-[#1E3A5F] font-black mb-1 game-font tracking-wide">
                            GAME OVER
                        </h1>
                        <p className="text-sm text-[#1E3A5F]/50 font-medium mb-6">Better luck next time!</p>

                        {/* Score Display */}
                        <div className="bg-gradient-to-br from-[#1E3A5F] to-[#2A4A6F] rounded-2xl p-6 mb-6 shadow-lg">
                            <div className="text-[#F5B819] text-xs font-bold uppercase tracking-widest mb-2">Your Score</div>
                            <div className="text-5xl text-white font-black game-font">{gameState.score}</div>
                        </div>

                        {/* Play Again Button */}
                        <button
                            onClick={handleRestart}
                            className="w-full py-4 bg-[#F5B819] hover:bg-[#E5A008] text-[#1E3A5F] text-xl rounded-xl font-black shadow-[0_4px_0_#B8860B] active:shadow-[0_2px_0_#B8860B] active:translate-y-[2px] transition-all flex items-center justify-center gap-2 uppercase tracking-wider"
                        >
                            <RotateCcw size={24} />
                            Play Again
                        </button>
                    </div>
                )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
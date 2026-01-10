
import React, { useState, useEffect, useRef } from 'react';
import { INITIAL_GAME_ITEMS } from './constants.ts';
import { GameItem, GameState } from './types.ts';

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>({
    items: INITIAL_GAME_ITEMS,
    matchedIds: [],
    shuffledWords: [],
    score: 0,
    message: "Welcome! Drag the words to the right pictures! 🌟",
    isGameOver: false,
  });

  const [localImageMap, setLocalImageMap] = useState<Record<string, string>>({});
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    resetGame();
  }, []);

  const resetGame = () => {
    const words = INITIAL_GAME_ITEMS.map(item => item.word);
    const shuffled = [...words].sort(() => Math.random() - 0.5);
    setGameState({
      items: INITIAL_GAME_ITEMS,
      matchedIds: [],
      shuffledWords: shuffled,
      score: 0,
      message: "Ready? Go! 🚀",
      isGameOver: false,
    });
    setErrorWord(null);
  };

  const onDragStart = (e: React.DragEvent, word: string) => {
    e.dataTransfer.setData("word", word);
  };

  const onDrop = (e: React.DragEvent, targetItem: GameItem) => {
    e.preventDefault();
    const draggedWord = e.dataTransfer.getData("word");

    if (draggedWord === targetItem.word) {
      if (!gameState.matchedIds.includes(targetItem.id)) {
        const newMatched = [...gameState.matchedIds, targetItem.id];
        const newWords = gameState.shuffledWords.filter(w => w !== draggedWord);
        const finished = newMatched.length === INITIAL_GAME_ITEMS.length;

        setGameState(prev => ({
          ...prev,
          matchedIds: newMatched,
          shuffledWords: newWords,
          score: prev.score + 10,
          message: finished ? "Amazing! You finished the game! 🌈" : "Great job! Keep going! ✨",
          isGameOver: finished
        }));
        setErrorWord(null);
      }
    } else {
      setGameState(prev => ({
        ...prev,
        message: "Oops! Try again! 🧐"
      }));
      setErrorWord(draggedWord);
      setTimeout(() => setErrorWord(null), 500);
    }
  };

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newMap = { ...localImageMap };
    // Explicitly typing 'file' as File to resolve 'unknown' type errors during iteration
    Array.from(files).forEach((file: File) => {
      const fileName = file.name.toLowerCase();
      INITIAL_GAME_ITEMS.forEach(item => {
        const wordKey = item.word.toLowerCase();
        // Match if filename contains word or word with underscores
        if (fileName.includes(wordKey.replace(/\s+/g, '_')) || fileName.includes(wordKey)) {
          newMap[item.word] = URL.createObjectURL(file);
        }
      });
    });
    setLocalImageMap(newMap);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col items-center">
      <header className="w-full text-center mb-10 bg-white rounded-[40px] p-8 shadow-xl border-b-8 border-sky-200">
        <h1 className="text-4xl md:text-6xl font-black text-sky-600 mb-2">Word Matcher!</h1>
        <p className="text-sky-400 text-xl font-bold">Drag the blue labels to the correct pictures</p>
        
        <div className="flex justify-center gap-6 mt-6">
          <div className="bg-orange-100 px-8 py-3 rounded-2xl text-orange-600 font-black text-2xl shadow-inner">
            Score: {gameState.score}
          </div>
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg transition active:scale-95 flex items-center gap-2"
          >
            <span>🖼️</span> Load Photos
          </button>
          <input 
            type="file" multiple accept="image/*" 
            ref={fileInputRef} className="hidden" 
            onChange={handleFileSelection} 
          />
        </div>
      </header>

      {gameState.message && (
        <div className="mb-8 text-2xl font-black text-sky-800 bg-white px-10 py-4 rounded-full shadow-md animate-bounce">
          {gameState.message}
        </div>
      )}

      <div className="w-full grid grid-cols-1 lg:grid-cols-4 gap-10">
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
          {gameState.items.map((item) => {
            const isMatched = gameState.matchedIds.includes(item.id);
            const imageUrl = localImageMap[item.word] || `https://placehold.co/400x300/e0f2fe/0369a1?text=${item.word}`;

            return (
              <div 
                key={item.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, item)}
                className={`relative group bg-white rounded-3xl overflow-hidden shadow-lg border-4 transition-all duration-300 ${
                  isMatched ? 'border-green-400 opacity-90' : 'border-white hover:border-sky-300'
                }`}
              >
                <div className="aspect-square bg-sky-50 overflow-hidden">
                  <img 
                    src={imageUrl} 
                    alt={item.word} 
                    className={`w-full h-full object-cover ${isMatched ? 'grayscale-0' : 'grayscale-[0.3]'}`}
                  />
                  {isMatched && (
                    <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                      <div className="bg-white rounded-full p-3 shadow-xl transform scale-125">
                        <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="4" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-4 bg-white text-center">
                  {isMatched ? (
                    <div className="text-xl font-black text-green-600 uppercase tracking-wider">
                      {item.word}
                    </div>
                  ) : (
                    <div className="h-10 border-2 border-dashed border-sky-100 rounded-xl flex items-center justify-center text-sky-200 font-bold italic text-sm">
                      Drop {item.word} here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white p-6 rounded-[32px] shadow-xl border-t-8 border-sky-400 sticky top-10">
            <h2 className="text-2xl font-black text-sky-700 mb-6 flex items-center gap-3">
              <span className="text-3xl">🔠</span> Words
            </h2>
            <div className="flex flex-wrap lg:flex-col gap-3">
              {gameState.shuffledWords.map((word) => (
                <div
                  key={word}
                  draggable
                  onDragStart={(e) => onDragStart(e, word)}
                  className={`drag-card bg-sky-500 hover:bg-sky-600 text-white font-black py-4 px-6 rounded-2xl text-center shadow-md transition-all text-xl uppercase tracking-wide ${
                    errorWord === word ? 'animate-shake bg-red-500' : ''
                  }`}
                >
                  {word}
                </div>
              ))}
              {gameState.shuffledWords.length === 0 && (
                <div className="text-center py-10">
                  <div className="text-6xl mb-4">🎖️</div>
                  <h3 className="text-2xl font-black text-green-600">Well Done!</h3>
                  <button 
                    onClick={resetGame}
                    className="mt-6 text-sky-500 hover:text-sky-700 font-bold underline"
                  >
                    Play Again?
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {gameState.isGameOver && (
        <div className="fixed inset-0 bg-sky-900/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-[48px] p-12 max-w-lg w-full text-center shadow-2xl border-8 border-yellow-400">
            <div className="text-9xl mb-6">👑</div>
            <h2 className="text-5xl font-black text-sky-800 mb-4">Super Star!</h2>
            <p className="text-2xl text-sky-500 font-bold mb-8">You matched all {INITIAL_GAME_ITEMS.length} words perfectly!</p>
            <button 
              onClick={resetGame}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white text-3xl font-black py-6 rounded-3xl shadow-xl transition-transform active:scale-95"
            >
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;

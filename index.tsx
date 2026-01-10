import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';

// --- Types ---
interface GameItem {
  id: string;
  word: string;
  imageUrl: string;
}

type AppMode = 'home' | 'drag' | 'choice' | 'spelling' | 'goodbye' | 'config';

// --- Constants ---
const STORAGE_KEY = 'words_config';

const DEFAULT_WORDS = [
  'place', 'road', 'swimming pool', 'farm', 'library', 
  'market', 'cafe', 'centre', 'car park', 'street', 
  'bus stop', 'hospital', 'cinema', 'supermarket', 'shop'
];

const getGameItemsFromWords = (words: string[]): GameItem[] => 
  words.map((word, index) => ({
    id: `item-${index}-${Date.now()}`, 
    word: word,
    imageUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${word.replace(/\s/g, '')}&backgroundColor=b6e3f4`
  }));

/**
 * Helper to shuffle an array using Fisher-Yates algorithm
 */
const shuffleArray = <T,>(array: T[]): T[] => {
  const res = [...array];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
};

/**
 * Helper to get a random element from an array
 */
const getRandomElement = <T,>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

// --- Shared Components ---

/**
 * FINISHED POPUP
 */
const FinishedPopup: React.FC<{
  modeName: string;
  themeColor: string;
  onRestart: () => void;
  onStay: () => void;
  onExit: () => void;
}> = ({ modeName, themeColor, onRestart, onStay, onExit }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-sky-900/60 backdrop-blur-md animate-fadeIn">
    <div className="bg-white rounded-[48px] p-10 max-w-lg w-full text-center shadow-2xl border-8 border-yellow-400 animate-bounceIn">
      <div className="text-8xl mb-6">🏆</div>
      <h2 className="text-4xl font-black text-gray-800 mb-2">Congratulations!</h2>
      <p className="text-xl text-gray-500 font-bold mb-8">
        You've completed the <span style={{ color: themeColor }}>{modeName}</span> round!
      </p>
      
      <div className="flex flex-col gap-4">
        <button 
          onClick={onRestart}
          className="w-full py-4 rounded-2xl text-white font-black text-xl shadow-lg transition transform hover:scale-105 active:scale-95"
          style={{ backgroundColor: themeColor }}
        >
          Play Again 🔄
        </button>
        <button 
          onClick={onStay}
          className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 font-black text-xl shadow hover:bg-gray-200 transition transform hover:scale-105 active:scale-95"
        >
          Stay & Review 👀
        </button>
        <button 
          onClick={onExit}
          className="w-full py-4 rounded-2xl bg-white border-4 border-gray-100 text-gray-400 font-black text-xl hover:text-gray-600 transition transform hover:scale-105 active:scale-95"
        >
          Main Menu 🏠
        </button>
      </div>
    </div>
  </div>
);

// --- Mode Components ---

/** 
 * HOME VIEW 
 */
const HomeView: React.FC<{ 
  onSelect: (mode: AppMode) => void, 
}> = ({ onSelect }) => (
  <div className="flex flex-col items-center justify-center h-full gap-8 p-6 animate-fadeIn">
    <div className="text-center mb-4">
      <h1 className="text-6xl font-black text-sky-600 mb-4 drop-shadow-sm">Words Training</h1>
      <p className="text-2xl text-sky-400 font-bold">Pick a game to start learning! 🚀</p>
    </div>
    
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
      <button 
        onClick={() => onSelect('drag')}
        className="group bg-white p-8 rounded-[40px] shadow-xl border-b-8 border-sky-400 hover:scale-105 transition-transform flex flex-col items-center text-center"
      >
        <span className="text-8xl mb-4 group-hover:animate-bounce">🎯</span>
        <h2 className="text-3xl font-black text-sky-700 mb-2">Drag Mode</h2>
        <p className="text-sky-400 font-bold">Match words to pictures by dragging!</p>
      </button>

      <button 
        onClick={() => onSelect('choice')}
        className="group bg-white p-8 rounded-[40px] shadow-xl border-b-8 border-orange-400 hover:scale-105 transition-transform flex flex-col items-center text-center"
      >
        <span className="text-8xl mb-4 group-hover:animate-bounce">🔘</span>
        <h2 className="text-3xl font-black text-orange-700 mb-2">Choice Mode</h2>
        <p className="text-orange-400 font-bold">Pick the correct word from 3 options!</p>
      </button>

      <button 
        onClick={() => onSelect('spelling')}
        className="group bg-white p-8 rounded-[40px] shadow-xl border-b-8 border-green-400 hover:scale-105 transition-transform flex flex-col items-center text-center"
      >
        <span className="text-8xl mb-4 group-hover:animate-bounce">⌨️</span>
        <h2 className="text-3xl font-black text-green-700 mb-2">Spelling Mode</h2>
        <p className="text-green-400 font-bold">Type the missing letters to spell it!</p>
      </button>
    </div>

    <div className="flex gap-4">
      <button 
        onClick={() => onSelect('config')}
        className="mt-4 bg-sky-500 hover:bg-sky-600 text-white px-10 py-4 rounded-3xl font-black shadow-xl border-b-4 border-sky-700 transition transform hover:scale-105 active:translate-y-1 flex items-center gap-3 text-xl"
      >
        <span className="text-3xl">⚙️</span> Settings
      </button>
      <button 
        onClick={() => onSelect('goodbye')}
        className="mt-4 bg-red-500 hover:bg-red-600 text-white px-10 py-4 rounded-3xl font-black shadow-xl border-b-4 border-red-700 transition transform hover:scale-105 active:translate-y-1 flex items-center gap-3 text-xl"
      >
        <span className="text-3xl">🚪</span> Exit
      </button>
    </div>
  </div>
);

/**
 * CONFIG VIEW
 */
const ConfigView: React.FC<{
  words: string[],
  onSave: (newWords: string[]) => void,
  onLoadPhotos: () => void,
  onBack: () => void,
  photoCount: number
}> = ({ words, onSave, onLoadPhotos, onBack, photoCount }) => {
  const [tempWords, setTempWords] = useState<string[]>([...words]);
  const [isSaved, setIsSaved] = useState(false);

  const handleInputChange = (index: number, value: string) => {
    const next = [...tempWords];
    next[index] = value;
    setTempWords(next);
    setIsSaved(false);
  };

  const addWord = () => {
    setTempWords([...tempWords, '']);
    setIsSaved(false);
  };

  const removeWord = (index: number) => {
    if (tempWords.length <= 1) return; 
    const next = tempWords.filter((_, i) => i !== index);
    setTempWords(next);
    setIsSaved(false);
  };

  const handleApply = () => {
    const finalWords = tempWords.filter(w => w.trim() !== '');
    onSave(finalWords);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="flex flex-col h-full p-6 animate-fadeIn max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <button onClick={onBack} className="bg-white p-3 rounded-2xl text-sky-600 font-black shadow hover:bg-sky-50 transition flex items-center gap-2">
          <span>🏠</span> Home
        </button>
        <h2 className="text-4xl font-black text-sky-600">Game Configuration</h2>
        <div className="w-24"></div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
        <section className="bg-white rounded-[40px] p-8 shadow-xl border-b-8 border-sky-100 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-black text-sky-700">1. Edit Word List</h3>
            <button 
              onClick={() => {
                setTempWords([...DEFAULT_WORDS]);
                setIsSaved(false);
              }}
              className="text-sky-400 hover:text-sky-600 font-bold text-sm underline"
            >
              Restore Defaults
            </button>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {tempWords.map((w, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-sky-100 text-sky-600 rounded-full font-black text-xs">{i + 1}</span>
                <input 
                  type="text" 
                  value={w} 
                  onChange={(e) => handleInputChange(i, e.target.value)}
                  placeholder={`Word ${i + 1}`}
                  className="flex-1 bg-sky-50 border-2 border-transparent focus:border-sky-300 outline-none rounded-xl px-4 py-2 font-bold text-sky-700 transition"
                />
                <button 
                  onClick={() => removeWord(i)}
                  className="p-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100"
                  title="Remove Word"
                >
                  🗑️
                </button>
              </div>
            ))}
            <button 
              onClick={addWord}
              className="w-full py-3 border-2 border-dashed border-sky-200 rounded-2xl text-sky-300 font-black hover:border-sky-400 hover:text-sky-400 transition"
            >
              ➕ Add New Word
            </button>
          </div>
          <button 
            onClick={handleApply}
            className={`mt-6 py-4 rounded-2xl font-black text-xl shadow-lg border-b-4 transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 ${
              isSaved ? 'bg-green-500 border-green-700 text-white' : 'bg-sky-500 border-sky-700 text-white hover:bg-sky-600'
            }`}
          >
            {isSaved ? 'Saved Permanently! ✅' : 'Apply & Save Changes 💾'}
          </button>
        </section>

        <section className="bg-white rounded-[40px] p-8 shadow-xl border-b-8 border-green-100 flex flex-col text-center">
          <h3 className="text-2xl font-black text-green-700 mb-4">2. Manage Photos</h3>
          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            <div className="text-7xl">🖼️</div>
            <div className="space-y-2">
              <p className="text-gray-500 font-bold">Current Photos Matched:</p>
              <div className="text-4xl font-black text-green-600 bg-green-50 px-8 py-3 rounded-3xl inline-block">
                {photoCount} / {words.length}
              </div>
            </div>
            <p className="text-sm text-gray-400 px-6 font-medium">
              Note: Words are saved permanently, but photos need re-loading if you refresh the page!
            </p>
            <button 
              onClick={onLoadPhotos}
              className="w-full bg-green-500 hover:bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg border-b-4 border-green-700 transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3"
            >
              <span>📂</span> Load Local Photos
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

/**
 * GOODBYE VIEW
 */
const GoodbyeView: React.FC<{ onRestart: () => void }> = ({ onRestart }) => (
  <div className="flex flex-col items-center justify-center h-full gap-8 p-6 animate-fadeIn text-center">
    <div className="bg-white p-12 rounded-[50px] shadow-2xl border-b-8 border-sky-200 max-w-lg">
      <span className="text-9xl mb-8 block">👋</span>
      <h2 className="text-5xl font-black text-sky-600 mb-4">Goodbye!</h2>
      <p className="text-2xl text-sky-400 font-bold mb-8">Thanks for training! See you next time! 🌟</p>
      <button 
        onClick={onRestart}
        className="bg-sky-500 hover:bg-sky-600 text-white px-12 py-5 rounded-3xl font-black shadow-xl border-b-4 border-sky-700 transition transform hover:scale-105 active:scale-95 text-2xl"
      >
        Start Again 🚀
      </button>
    </div>
  </div>
);

/**
 * DRAG MODE VIEW
 */
const DragModeView: React.FC<{ 
  onBack: () => void, 
  localImageMap: Record<string, string>,
  gameItems: GameItem[],
  words: string[]
}> = ({ onBack, localImageMap, gameItems, words }) => {
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [shuffledWords, setShuffledWords] = useState<string[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [randomizedItems, setRandomizedItems] = useState<GameItem[]>([]);
  const [errorWord, setErrorWord] = useState<string | null>(null);
  const [showFinishedPopup, setShowFinishedPopup] = useState(false);

  const resetGame = () => {
    setMatchedIds([]);
    setShuffledWords(shuffleArray(words));
    if (isRandomMode) setRandomizedItems(shuffleArray(gameItems));
    setShowFinishedPopup(false);
  };

  useEffect(() => {
    setShuffledWords(shuffleArray(words));
  }, [words]);

  const toggleRandomMode = () => {
    const nextMode = !isRandomMode;
    if (nextMode) {
      setRandomizedItems(shuffleArray(gameItems));
    }
    setIsRandomMode(nextMode);
  };

  const onDrop = (word: string, targetItem: GameItem) => {
    if (word.toLowerCase() === targetItem.word.toLowerCase()) {
      if (!matchedIds.includes(targetItem.id)) {
        const nextMatched = [...matchedIds, targetItem.id];
        setMatchedIds(nextMatched);
        setShuffledWords(shuffledWords.filter(w => w !== word));
        
        if (nextMatched.length === gameItems.length) {
          setTimeout(() => setShowFinishedPopup(true), 600);
        }
      }
    } else {
      setErrorWord(word);
      setTimeout(() => setErrorWord(null), 500);
    }
  };

  const displayItems = isRandomMode ? randomizedItems : gameItems;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="flex items-center justify-between mb-4 bg-white p-3 rounded-2xl shadow-sm border-b-4 border-sky-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="bg-sky-100 p-2 rounded-xl text-sky-600 font-black hover:bg-sky-200 transition">← Back</button>
          <button 
            onClick={toggleRandomMode} 
            className={`px-4 py-2 rounded-xl font-black text-xs shadow-sm transition ${isRandomMode ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-2 border-indigo-100'}`}
          >
            {isRandomMode ? '🔀 Random' : '📋 Sequence'}
          </button>
          <button 
            onClick={() => setShowHint(!showHint)} 
            className={`px-4 py-2 rounded-xl font-black text-xs shadow-sm transition ${showHint ? 'bg-orange-500 text-white' : 'bg-white text-orange-500 border-2 border-orange-100'}`}
          >
            {showHint ? '👀 Hide' : '💡 Hint'}
          </button>
        </div>
        <div className="flex items-center">
          <span className="text-sky-600 font-black text-xl">{matchedIds.length} / {gameItems.length}</span>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        <div className="col-span-10 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
            {displayItems.map(item => {
              const isMatched = matchedIds.includes(item.id);
              const imageUrl = localImageMap[item.word] || item.imageUrl;
              return (
                <div 
                  key={item.id}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => onDrop(e.dataTransfer.getData("word"), item)}
                  className={`relative aspect-square bg-white rounded-2xl overflow-hidden shadow-sm border-2 flex flex-col transition-all ${isMatched ? 'border-green-400 ring-2 ring-green-100' : 'border-white hover:border-sky-300'}`}
                >
                  <div className="flex-1 bg-white relative overflow-hidden">
                    <img src={imageUrl} className={`w-full h-full object-cover transition-opacity ${isMatched ? 'opacity-100' : 'opacity-85'}`} alt="" />
                    {isMatched && <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center animate-fadeIn"><div className="bg-white rounded-full p-2 border-2 border-green-500 text-2xl">✅</div></div>}
                  </div>
                  <div className="h-10 flex items-center justify-center bg-white border-t border-gray-50 text-[11px] font-black tracking-wider px-2 text-center">
                    {isMatched ? <span className="text-green-600 truncate w-full">{item.word}</span> : showHint ? <span className="text-orange-500 animate-pulse text-[9px]">Answer: {item.word}</span> : <span className="text-sky-200">Drag Here</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="col-span-2 bg-white rounded-2xl p-3 flex flex-col shadow-sm border-t-8 border-sky-400 min-h-0">
          <h3 className="text-xs font-black text-sky-700 mb-3 flex items-center gap-2">
            <span>🔠</span> Bank
          </h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {shuffledWords.map(word => (
              <div 
                key={word} 
                draggable 
                onDragStart={e => e.dataTransfer.setData("word", word)}
                className={`bg-sky-500 hover:bg-sky-600 text-white font-black py-3 px-2 rounded-xl text-center shadow-md text-[12px] cursor-grab transition-all active:scale-95 active:rotate-2 ${errorWord === word ? 'animate-shake bg-red-500' : ''}`}
              >
                {word}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showFinishedPopup && (
        <FinishedPopup 
          modeName="Drag Mode"
          themeColor="#0ea5e9"
          onRestart={resetGame}
          onStay={() => setShowFinishedPopup(false)}
          onExit={onBack}
        />
      )}
    </div>
  );
};

/**
 * CHOICE MODE VIEW
 */
const ChoiceModeView: React.FC<{ 
  onBack: () => void, 
  localImageMap: Record<string, string>,
  gameItems: GameItem[],
  words: string[]
}> = ({ onBack, localImageMap, gameItems, words }) => {
  const [playOrder, setPlayOrder] = useState<number[]>(gameItems.map((_, i) => i));
  const [orderPointer, setOrderPointer] = useState(0);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [options, setOptions] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showFinishedPopup, setShowFinishedPopup] = useState(false);

  const currentIndex = playOrder[orderPointer];
  const currentItem = gameItems[currentIndex];
  const imageUrl = currentItem ? (localImageMap[currentItem.word] || currentItem.imageUrl) : '';

  const resetGame = () => {
    initOrder(isRandomMode);
    setShowFinishedPopup(false);
  };

  const initOrder = (random: boolean) => {
    const indices = gameItems.map((_, i) => i);
    const newOrder = random ? shuffleArray(indices) : indices;
    setPlayOrder(newOrder);
    setOrderPointer(0);
    setIsRandomMode(random);
  };

  useEffect(() => {
    if (!currentItem) return;
    const distractors = words.filter(w => w !== currentItem.word);
    const finalOptions = [currentItem.word];
    
    if (distractors.length > 0) {
      const d1 = getRandomElement(distractors);
      finalOptions.push(d1);
      const remainingDistractors = distractors.filter(w => w !== d1);
      if (remainingDistractors.length > 0) {
        finalOptions.push(getRandomElement(remainingDistractors));
      }
    }

    setOptions(shuffleArray(finalOptions));
    setStatus('idle');
  }, [currentIndex, words]);

  const handleChoice = (word: string) => {
    if (word === currentItem.word) {
      setStatus('correct');
      setTimeout(() => {
        if (orderPointer < playOrder.length - 1) {
          setOrderPointer(orderPointer + 1);
        } else {
          setShowFinishedPopup(true);
        }
      }, 600);
    } else {
      setStatus('wrong');
      setTimeout(() => setStatus('idle'), 500);
    }
  };

  if (!currentItem) return <div className="flex items-center justify-center h-full">No items configured!</div>;

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto items-center justify-center gap-6">
      <header className="w-full flex justify-between items-center absolute top-3 left-0 px-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="bg-orange-100 p-2 rounded-xl text-orange-600 font-black hover:bg-orange-200 transition">← Back</button>
          <button 
            onClick={() => initOrder(!isRandomMode)}
            className={`px-4 py-2 rounded-xl font-black text-xs shadow transition ${isRandomMode ? 'bg-orange-600 text-white' : 'bg-white text-orange-600 border-2 border-orange-100'}`}
          >
            {isRandomMode ? '🔀 Random' : '📋 Sequence'}
          </button>
          <button 
            onClick={() => {
              setShowHint(!showHint);
            }} 
            className={`px-4 py-2 rounded-xl font-black text-xs shadow transition ${showHint ? 'bg-orange-500 text-white' : 'bg-white text-orange-500 border-2 border-orange-100'}`}
          >
            {showHint ? '👀 Hide' : '💡 Hint'}
          </button>
        </div>
        <span className="text-orange-600 font-black text-xl">{orderPointer + 1} / {gameItems.length}</span>
      </header>
      
      <div className={`w-80 h-80 bg-white rounded-[40px] shadow-2xl border-8 p-4 transition-all ${status === 'correct' ? 'border-green-400 scale-105' : status === 'wrong' ? 'border-red-400 animate-shake' : 'border-white'}`}>
        <img src={imageUrl} className="w-full h-full object-cover rounded-[20px]" alt="" />
      </div>

      <div className="grid grid-cols-1 gap-4 w-full px-12">
        {options.map(opt => {
          const isCorrect = opt === currentItem.word;
          return (
            <button 
              key={opt}
              onClick={() => handleChoice(opt)}
              className={`bg-white hover:bg-orange-50 text-orange-600 font-black py-4 rounded-2xl shadow-md border-b-4 text-xl tracking-widest transition active:translate-y-1 ${
                showHint && isCorrect ? 'border-orange-500 ring-4 ring-orange-200 ring-offset-2' : 'border-orange-200'
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 mt-4">
        <button 
          disabled={orderPointer === 0}
          onClick={() => setOrderPointer(orderPointer - 1)}
          className="bg-orange-400 disabled:opacity-30 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition"
        >
          Prev
        </button>
        <button 
          disabled={orderPointer === playOrder.length - 1}
          onClick={() => setOrderPointer(orderPointer + 1)}
          className="bg-orange-400 disabled:opacity-30 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition"
        >
          Next
        </button>
      </div>

      {showFinishedPopup && (
        <FinishedPopup 
          modeName="Choice Mode"
          themeColor="#f97316"
          onRestart={resetGame}
          onStay={() => setShowFinishedPopup(false)}
          onExit={onBack}
        />
      )}
    </div>
  );
};

/**
 * SPELLING MODE VIEW
 */
const SpellingModeView: React.FC<{ 
  onBack: () => void, 
  localImageMap: Record<string, string>,
  gameItems: GameItem[],
  words: string[]
}> = ({ onBack, localImageMap, gameItems, words }) => {
  const [playOrder, setPlayOrder] = useState<number[]>(gameItems.map((_, i) => i));
  const [orderPointer, setOrderPointer] = useState(0);
  const [isRandomMode, setIsRandomMode] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [userInput, setUserInput] = useState<string[]>([]);
  const [fixedIndices, setFixedIndices] = useState<number[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [status, setStatus] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showFinishedPopup, setShowFinishedPopup] = useState(false);

  const currentIndex = playOrder[orderPointer];
  const currentItem = gameItems[currentIndex];
  
  const resetGame = () => {
    initOrder(isRandomMode);
    setShowFinishedPopup(false);
  };

  const initOrder = (random: boolean) => {
    const indices = gameItems.map((_, i) => i);
    const newOrder = random ? shuffleArray(indices) : indices;
    setPlayOrder(newOrder);
    setOrderPointer(0);
    setIsRandomMode(random);
  };

  useEffect(() => {
    if (!currentItem) return;
    const wordLength = currentItem.word.length;
    const indices: number[] = [];
    while (indices.length < Math.min(2, wordLength - 1) && currentItem.word.replace(/\s/g, '').length > 2) {
      const rand = Math.floor(Math.random() * wordLength);
      if (!indices.includes(rand) && currentItem.word[rand] !== ' ') {
        indices.push(rand);
      }
    }
    setFixedIndices(indices);
    const initialInput = Array(wordLength).fill('');
    indices.forEach(idx => { initialInput[idx] = currentItem.word[idx]; });
    currentItem.word.split('').forEach((char, idx) => {
      if (char === ' ') initialInput[idx] = ' ';
    });
    setUserInput(initialInput);
    
    const firstEmpty = initialInput.findIndex(v => v === '');
    setFocusedIndex(firstEmpty !== -1 ? firstEmpty : 0);
    setStatus('idle');
  }, [currentIndex, currentItem?.id]); 

  const advanceFocusedIndex = (currentUserInput: string[]) => {
    if (!currentItem) return;
    const wordLength = currentItem.word.length;
    
    const nextEmpty = currentUserInput.findIndex((v, i) => i > focusedIndex && v === '' && !fixedIndices.includes(i) && currentItem.word[i] !== ' ');
    if (nextEmpty !== -1) {
      setFocusedIndex(nextEmpty);
      return;
    }

    const firstEmpty = currentUserInput.findIndex((v, i) => v === '' && !fixedIndices.includes(i) && currentItem.word[i] !== ' ');
    if (firstEmpty !== -1) {
      setFocusedIndex(firstEmpty);
      return;
    }

    let next = (focusedIndex + 1) % wordLength;
    while (next !== focusedIndex) {
      if (!fixedIndices.includes(next) && currentItem.word[next] !== ' ') {
        setFocusedIndex(next);
        return;
      }
      next = (next + 1) % wordLength;
    }
  };

  const handleInput = (char: string) => {
    if (status === 'correct' || !currentItem) return;
    if (status === 'wrong') setStatus('idle');

    const newInput = [...userInput];
    if (fixedIndices.includes(focusedIndex) || currentItem.word[focusedIndex] === ' ') return;
    
    // Check match ignoring case, but apply target casing for visual feedback
    const targetChar = currentItem.word[focusedIndex];
    if (char.toLowerCase() === targetChar.toLowerCase()) {
      newInput[focusedIndex] = targetChar;
    } else {
      newInput[focusedIndex] = char;
    }
    
    setUserInput(newInput);

    if (!newInput.includes('')) {
      if (newInput.join('').toLowerCase() === currentItem.word.toLowerCase()) {
        setStatus('correct');
        setTimeout(() => {
          if (orderPointer < playOrder.length - 1) {
            setOrderPointer(orderPointer + 1);
          } else {
            setShowFinishedPopup(true);
          }
        }, 800);
      } else {
        setStatus('wrong');
        advanceFocusedIndex(newInput);
      }
    } else {
      advanceFocusedIndex(newInput);
    }
  };

  useEffect(() => {
    if (!currentItem) return;
    const wordLength = currentItem.word.length;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) handleInput(e.key);
      else if (e.key === 'Backspace') {
        if (status === 'wrong') setStatus('idle');
        const newInput = [...userInput];
        if (!fixedIndices.includes(focusedIndex) && currentItem.word[focusedIndex] !== ' ') {
          newInput[focusedIndex] = '';
          setUserInput(newInput);
        }
      } else if (e.key === 'ArrowLeft') {
        let prev = (focusedIndex - 1 + wordLength) % wordLength;
        while (prev !== focusedIndex) {
          if (!fixedIndices.includes(prev) && currentItem.word[prev] !== ' ') {
            setFocusedIndex(prev);
            break;
          }
          prev = (prev - 1 + wordLength) % wordLength;
        }
      } else if (e.key === 'ArrowRight') {
        let next = (focusedIndex + 1) % wordLength;
        while (next !== focusedIndex) {
          if (!fixedIndices.includes(next) && currentItem.word[next] !== ' ') {
            setFocusedIndex(next);
            break;
          }
          next = (next + 1) % wordLength;
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, userInput, status, currentItem?.word]);

  if (!currentItem) return <div className="flex items-center justify-center h-full">No items configured!</div>;

  const imageUrl = localImageMap[currentItem.word] || currentItem.imageUrl;

  return (
    <div className="flex flex-col h-full items-center justify-center gap-8 p-4">
      <header className="w-full flex justify-between items-center absolute top-3 left-0 px-6">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="bg-green-100 p-2 rounded-xl text-green-600 font-black hover:bg-green-200 transition">← Back</button>
          <button 
            onClick={() => initOrder(!isRandomMode)}
            className={`px-4 py-2 rounded-xl font-black text-xs shadow transition ${isRandomMode ? 'bg-green-600 text-white' : 'bg-white text-green-600 border-2 border-green-100'}`}
          >
            {isRandomMode ? '🔀 Random' : '📋 Sequence'}
          </button>
          <button 
            onClick={() => {
              setShowHint(!showHint);
            }} 
            className={`px-4 py-2 rounded-xl font-black text-xs shadow transition ${showHint ? 'bg-orange-500 text-white' : 'bg-white text-orange-500 border-2 border-orange-100'}`}
          >
            {showHint ? '👀 Hide' : '💡 Hint'}
          </button>
        </div>
        <span className="text-green-600 font-black text-xl">{orderPointer + 1} / {gameItems.length}</span>
      </header>

      <div className={`w-80 h-80 bg-white rounded-[40px] shadow-2xl border-8 p-4 transition-all ${status === 'correct' ? 'border-green-400 scale-105' : status === 'wrong' ? 'border-red-400 animate-shake' : 'border-white'}`}>
        <img src={imageUrl} className="w-full h-full object-cover rounded-[20px]" alt="" />
      </div>

      <div className="flex flex-wrap justify-center gap-2 max-w-2xl px-4">
        {userInput.map((char, idx) => {
          const isHint = fixedIndices.includes(idx);
          return currentItem.word[idx] === ' ' ? <div key={idx} className="w-6" /> : (
            <button
              key={idx}
              onClick={() => setFocusedIndex(idx)}
              className={`w-12 h-16 rounded-xl border-b-4 flex items-center justify-center text-3xl font-black transition-all ${
                focusedIndex === idx ? 'bg-green-100 border-green-500 scale-110 shadow-lg' : isHint ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200 text-gray-700'
              } ${isHint ? 'text-orange-500' : ''}`}
            >
              {char || '_'}
            </button>
          );
        })}
      </div>

      <p className="font-bold italic h-6 animate-pulse">
        {status === 'correct' ? (
          <span className="text-green-500">Correct! Well done! 🌟</span>
        ) : showHint ? (
          <span className="text-orange-500">Answer: {currentItem.word}</span>
        ) : status === 'wrong' ? (
          <span className="text-red-500">Wrong spelling! Try again! 🧐</span>
        ) : (
          <span className="text-green-500 opacity-60">Type to complete the word!</span>
        )}
      </p>

      <div className="flex gap-4">
        <button disabled={orderPointer === 0} onClick={() => setOrderPointer(orderPointer - 1)} className="bg-green-400 disabled:opacity-30 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition">Prev</button>
        <button disabled={orderPointer === playOrder.length - 1} onClick={() => setOrderPointer(orderPointer + 1)} className="bg-green-400 disabled:opacity-30 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition">Next</button>
      </div>

      {showFinishedPopup && (
        <FinishedPopup 
          modeName="Spelling Mode"
          themeColor="#22c55e"
          onRestart={resetGame}
          onStay={() => setShowFinishedPopup(false)}
          onExit={onBack}
        />
      )}
    </div>
  );
};

/**
 * MAIN APP ROUTER
 */
const App: React.FC = () => {
  const [view, setView] = useState<AppMode>('home');
  const [words, setWords] = useState<string[]>(() => {
    // Persistent loading from localStorage
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [...DEFAULT_WORDS];
  });
  const [localImageMap, setLocalImageMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Derived game items
  const gameItems = useMemo(() => getGameItemsFromWords(words), [words]);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const newMap = { ...localImageMap };
    let matchCount = 0;

    // Explicitly typing 'file' as File to resolve 'unknown' type errors during iteration
    Array.from(files).forEach((file: File) => {
      const rawFileName = file.name.toLowerCase().split('.')[0];
      const normalizedFileName = rawFileName.replace(/[^a-z0-9]/g, '');
      const fileNameTokens = rawFileName.split(/[\s\-_]+/).map(t => t.replace(/[^a-z0-9]/g, ''));

      words.forEach(word => {
        const normalizedWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        const isExactMatch = normalizedFileName === normalizedWord;
        const isTokenMatch = fileNameTokens.includes(normalizedWord);

        if (isExactMatch || isTokenMatch) {
          newMap[word] = URL.createObjectURL(file);
          matchCount++;
        }
      });
    });

    setLocalImageMap(newMap);
    console.log(`Matched ${matchCount} photos!`);
  };

  const triggerFileLoad = () => fileInputRef.current?.click();

  const handleSaveWords = (newWords: string[]) => {
    setWords(newWords);
    // Persistent saving to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newWords));
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f0f9ff] font-['Comic_Neue',cursive]">
      {view === 'home' && <HomeView onSelect={setView} />}
      {view === 'config' && (
        <ConfigView 
          words={words} 
          onSave={handleSaveWords} 
          onLoadPhotos={triggerFileLoad} 
          onBack={() => setView('home')}
          photoCount={Object.keys(localImageMap).filter(k => words.includes(k)).length}
        />
      )}
      {view === 'drag' && (
        <DragModeView 
          onBack={() => setView('home')} 
          localImageMap={localImageMap} 
          gameItems={gameItems} 
          words={words} 
        />
      )}
      {view === 'choice' && (
        <ChoiceModeView 
          onBack={() => setView('home')} 
          localImageMap={localImageMap} 
          gameItems={gameItems} 
          words={words} 
        />
      )}
      {view === 'spelling' && (
        <SpellingModeView 
          onBack={() => setView('home')} 
          localImageMap={localImageMap} 
          gameItems={gameItems} 
          words={words} 
        />
      )}
      {view === 'goodbye' && <GoodbyeView onRestart={() => setView('home')} />}
      
      <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelection} />

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #bae6fd; border-radius: 10px; }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20%, 60% { transform: translateX(-8px); }
            40%, 80% { transform: translateX(8px); }
        }
        @keyframes bounceIn {
          0% { transform: scale(0.3); opacity: 0; }
          50% { transform: scale(1.05); opacity: 1; }
          70% { transform: scale(0.9); }
          100% { transform: scale(1); }
        }
        .animate-bounceIn { animation: bounceIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
}
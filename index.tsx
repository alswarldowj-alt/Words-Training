import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import * as XLSX from 'xlsx';
import { GoogleGenAI, Modality } from "@google/genai";

// --- 音频处理工具 ---
function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer, data.byteOffset, data.byteLength / 2);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

class VoiceManager {
  private audioCtx: AudioContext | null = null;
  private cache: Record<string, AudioBuffer> = {};
  private isLoading: Record<string, boolean> = {};

  async ensureContext() {
    if (!this.audioCtx) {
      this.audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  async play(type: 'correct' | 'wrong') {
    const ctx = await this.ensureContext();
    const text = type === 'correct' ? '答对了' : '答错了';
    
    if (this.cache[text]) {
      this.playBuffer(this.cache[text]);
      return;
    }

    if (this.isLoading[text]) return;
    this.isLoading[text] = true;

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text: `用超级欢快可爱的小女孩语气说：${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
      const base64Data = part?.inlineData?.data;
      
      if (base64Data) {
        const audioBuffer = await decodeAudioData(decodeBase64(base64Data), ctx, 24000, 1);
        this.cache[text] = audioBuffer;
        this.playBuffer(audioBuffer);
      }
    } catch (err) {
      console.error("Voice generation failed:", err);
    } finally {
      this.isLoading[text] = false;
    }
  }

  private playBuffer(buffer: AudioBuffer) {
    if (!this.audioCtx) return;
    const source = this.audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioCtx.destination);
    source.start(0);
  }
}

const voice = new VoiceManager();

// --- Types ---
interface GameItem {
  id: string;
  word: string;
  imageUrl: string;
}

type AppMode = 'home' | 'drag' | 'choice' | 'spelling' | 'goodbye' | 'config';

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

const shuffleArray = <T,>(array: T[]): T[] => {
  const res = [...array];
  for (let i = res.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [res[i], res[j]] = [res[j], res[i]];
  }
  return res;
};

const getRandomElement = <T,>(array: T[]): T => {
  return array[Math.floor(Math.random() * array.length)];
};

// --- Shared Components ---

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
        <button onClick={onRestart} className="w-full py-4 rounded-2xl text-white font-black text-xl shadow-lg transition transform hover:scale-105 active:scale-95" style={{ backgroundColor: themeColor }}>
          Play Again 🔄
        </button>
        <button onClick={onStay} className="w-full py-4 rounded-2xl bg-gray-100 text-gray-600 font-black text-xl shadow hover:bg-gray-200 transition transform hover:scale-105 active:scale-95">
          Stay & Review 👀
        </button>
        <button onClick={onExit} className="w-full py-4 rounded-2xl bg-white border-4 border-gray-100 text-gray-400 font-black text-xl hover:text-gray-600 transition transform hover:scale-105 active:scale-95">
          Main Menu 🏠
        </button>
      </div>
    </div>
  </div>
);

// --- Mode Components ---

const HomeView: React.FC<{ onSelect: (mode: AppMode) => void }> = ({ onSelect }) => {
  const handleSelect = (mode: AppMode) => {
    voice.ensureContext();
    onSelect(mode);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 p-6 animate-fadeIn">
      <div className="text-center mb-4">
        <h1 className="text-6xl font-black text-sky-600 mb-4 drop-shadow-sm">Words Training</h1>
        <p className="text-2xl text-sky-400 font-bold">Pick a game to start learning! 🚀</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <button onClick={() => handleSelect('drag')} className="group bg-white p-8 rounded-[40px] shadow-xl border-b-8 border-sky-400 hover:scale-105 transition-transform flex flex-col items-center text-center">
          <span className="text-8xl mb-4 group-hover:animate-bounce">🎯</span>
          <h2 className="text-3xl font-black text-sky-700 mb-2">Drag Mode</h2>
          <p className="text-sky-400 font-bold">Match words to pictures by dragging!</p>
        </button>

        <button onClick={() => handleSelect('choice')} className="group bg-white p-8 rounded-[40px] shadow-xl border-b-8 border-orange-400 hover:scale-105 transition-transform flex flex-col items-center text-center">
          <span className="text-8xl mb-4 group-hover:animate-bounce">🔘</span>
          <h2 className="text-3xl font-black text-orange-700 mb-2">Choice Mode</h2>
          <p className="text-orange-400 font-bold">Pick the correct word from 3 options!</p>
        </button>

        <button onClick={() => handleSelect('spelling')} className="group bg-white p-8 rounded-[40px] shadow-xl border-b-8 border-green-400 hover:scale-105 transition-transform flex flex-col items-center text-center">
          <span className="text-8xl mb-4 group-hover:animate-bounce">⌨️</span>
          <h2 className="text-3xl font-black text-green-700 mb-2">Spelling Mode</h2>
          <p className="text-green-400 font-bold">Type the missing letters to spell it!</p>
        </button>
      </div>

      <div className="flex gap-4">
        <button onClick={() => handleSelect('config')} className="mt-4 bg-sky-500 hover:bg-sky-600 text-white px-10 py-4 rounded-3xl font-black shadow-xl border-b-4 border-sky-700 transition transform hover:scale-105 active:translate-y-1 flex items-center gap-3 text-xl">
          <span className="text-3xl">⚙️</span> Settings
        </button>
        <button onClick={() => handleSelect('goodbye')} className="mt-4 bg-red-500 hover:bg-red-600 text-white px-10 py-4 rounded-3xl font-black shadow-xl border-b-4 border-red-700 transition transform hover:scale-105 active:translate-y-1 flex items-center gap-3 text-xl">
          <span className="text-3xl">🚪</span> Exit
        </button>
      </div>
    </div>
  );
};

const ConfigView: React.FC<{
  words: string[],
  onSave: (newWords: string[]) => void,
  onLoadPhotos: () => void,
  onBack: () => void,
  photoCount: number
}> = ({ words, onSave, onLoadPhotos, onBack, photoCount }) => {
  const [tempWords, setTempWords] = useState<string[]>([...words]);
  const [isSaved, setIsSaved] = useState(false);
  const excelInputRef = useRef<HTMLInputElement>(null);

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

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
        const wordsFromExcel = data.slice(1).map(row => row[1]).filter(w => w && String(w).trim() !== '').map(w => String(w).trim());
        if (wordsFromExcel.length > 0) {
          setTempWords(wordsFromExcel);
          setIsSaved(false);
          alert(`Successfully imported ${wordsFromExcel.length} words!`);
        } else {
          alert('No words found in Excel.');
        }
      } catch (error) {
        alert('Failed to parse Excel file.');
      }
      if (excelInputRef.current) excelInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="flex flex-col h-full p-6 animate-fadeIn max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <button onClick={() => { voice.ensureContext(); onBack(); }} className="bg-white p-3 rounded-2xl text-sky-600 font-black shadow hover:bg-sky-50 transition flex items-center gap-2">
          <span>🏠</span> Home
        </button>
        <h2 className="text-4xl font-black text-sky-600">Game Configuration</h2>
        <div className="w-24"></div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1 min-h-0">
        <section className="bg-white rounded-[40px] p-8 shadow-xl border-b-8 border-sky-100 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-2xl font-black text-sky-700">1. Edit Word List</h3>
            <div className="flex items-center gap-2">
              <input type="file" ref={excelInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleExcelImport} />
              <button onClick={() => { voice.ensureContext(); excelInputRef.current?.click(); }} className="text-emerald-500 hover:text-emerald-700 font-bold text-sm flex items-center gap-1 bg-emerald-50 px-3 py-1 rounded-lg transition">
                📊 Import Excel
              </button>
              <button onClick={() => { setTempWords([...DEFAULT_WORDS]); setIsSaved(false); }} className="text-sky-400 hover:text-sky-600 font-bold text-sm underline">
                Restore Defaults
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
            {tempWords.map((w, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <span className="w-8 h-8 flex-shrink-0 flex items-center justify-center bg-sky-100 text-sky-600 rounded-full font-black text-xs">{i + 1}</span>
                <input type="text" value={w} onChange={(e) => handleInputChange(i, e.target.value)} placeholder={`Word ${i + 1}`} className="flex-1 bg-sky-50 border-2 border-transparent focus:border-sky-300 outline-none rounded-xl px-4 py-2 font-bold text-sky-700 transition" />
                <button onClick={() => removeWord(i)} className="p-2 text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100">🗑️</button>
              </div>
            ))}
            <button onClick={addWord} className="w-full py-3 border-2 border-dashed border-sky-200 rounded-2xl text-sky-300 font-black hover:border-sky-400 hover:text-sky-400 transition">
              ➕ Add New Word
            </button>
          </div>
          <button onClick={handleApply} className={`mt-6 py-4 rounded-2xl font-black text-xl shadow-lg border-b-4 transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 ${isSaved ? 'bg-green-500 border-green-700 text-white' : 'bg-sky-500 border-sky-700 text-white hover:bg-sky-600'}`}>
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
            <button onClick={() => { voice.ensureContext(); onLoadPhotos(); }} className="w-full bg-green-500 hover:bg-green-600 text-white py-5 rounded-2xl font-black text-xl shadow-lg border-b-4 border-green-700 transition transform hover:scale-105 active:scale-95 flex items-center justify-center gap-3">
              <span>📂</span> Load Local Photos
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

const GoodbyeView: React.FC<{ onRestart: () => void }> = ({ onRestart }) => (
  <div className="flex flex-col items-center justify-center h-full gap-8 p-6 animate-fadeIn text-center">
    <div className="bg-white p-12 rounded-[50px] shadow-2xl border-b-8 border-sky-200 max-w-lg">
      <span className="text-9xl mb-8 block">👋</span>
      <h2 className="text-5xl font-black text-sky-600 mb-4">Goodbye!</h2>
      <p className="text-2xl text-sky-400 font-bold mb-8">Thanks for training! See you next time! 🌟</p>
      <button onClick={() => { voice.ensureContext(); onRestart(); }} className="bg-sky-500 hover:bg-sky-600 text-white px-12 py-5 rounded-3xl font-black shadow-xl border-b-4 border-sky-700 transition transform hover:scale-105 active:scale-95 text-2xl">
        Start Again 🚀
      </button>
    </div>
  </div>
);

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
  
  const [touchStartPos, setTouchStartPos] = useState<{x: number, y: number, word: string} | null>(null);
  const [touchDrag, setTouchDrag] = useState<{word: string, x: number, y: number} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropTargetsRef = useRef<Map<string, HTMLDivElement>>(new Map());

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
    voice.ensureContext();
    const nextMode = !isRandomMode;
    if (nextMode) setRandomizedItems(shuffleArray(gameItems));
    setIsRandomMode(nextMode);
  };

  const checkMatch = (word: string, targetId: string) => {
    const targetItem = gameItems.find(i => i.id === targetId);
    if (targetItem && word.toLowerCase() === targetItem.word.toLowerCase()) {
      voice.play('correct');
      if (!matchedIds.includes(targetId)) {
        const nextMatched = [...matchedIds, targetId];
        setMatchedIds(nextMatched);
        setShuffledWords(prev => prev.filter(w => w !== word));
        if (nextMatched.length === gameItems.length) {
          setTimeout(() => setShowFinishedPopup(true), 600);
        }
      }
      return true;
    } else {
      voice.play('wrong');
      setErrorWord(word);
      setTimeout(() => setErrorWord(null), 500);
      return false;
    }
  };

  const handleTouchStart = (e: React.TouchEvent, word: string) => {
    voice.ensureContext();
    const touch = e.touches[0];
    setTouchStartPos({ x: touch.clientX, y: touch.clientY, word });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchDrag) {
      // Prevent scrolling if already dragging
      if (e.cancelable) e.preventDefault();
      const touch = e.touches[0];
      setTouchDrag({ ...touchDrag, x: touch.clientX, y: touch.clientY });
      return;
    }

    if (touchStartPos) {
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.x);
      const dy = Math.abs(touch.clientY - touchStartPos.y);

      // Detect if user intended to drag or scroll
      // If horizontal movement is significant, or total movement is larger than a threshold, start dragging
      if (dx > 20 || (dx > 8 && dx > dy)) {
        setTouchDrag({ word: touchStartPos.word, x: touch.clientX, y: touch.clientY });
        setTouchStartPos(null);
        if (e.cancelable) e.preventDefault();
      } else if (dy > 15) {
        // It's a vertical scroll, cancel potential drag detection
        setTouchStartPos(null);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    setTouchStartPos(null);
    if (!touchDrag) return;
    const { word, x, y } = touchDrag;
    setTouchDrag(null);
    for (const [id, el] of dropTargetsRef.current.entries()) {
      const rect = el.getBoundingClientRect();
      if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) {
        checkMatch(word, id);
        break;
      }
    }
  };

  const displayItems = isRandomMode ? randomizedItems : gameItems;

  return (
    <div className="flex flex-col h-full overflow-hidden" ref={containerRef} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <header className="flex items-center justify-between mb-4 bg-white p-3 rounded-2xl shadow-sm border-b-4 border-sky-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => { voice.ensureContext(); onBack(); }} className="bg-sky-100 p-2 rounded-xl text-sky-600 font-black hover:bg-sky-200 transition">← Back</button>
          <button onClick={toggleRandomMode} className={`px-4 py-2 rounded-xl font-black text-xs shadow-sm transition ${isRandomMode ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-600 border-2 border-indigo-100'}`}>
            {isRandomMode ? '🔀 Random' : '📋 Sequence'}
          </button>
          <button onClick={() => { voice.ensureContext(); setShowHint(!showHint); }} className={`px-4 py-2 rounded-xl font-black text-xs shadow-sm transition ${showHint ? 'bg-orange-500 text-white' : 'bg-white text-orange-500 border-2 border-orange-100'}`}>
            {showHint ? '👀 Hide' : '💡 Hint'}
          </button>
        </div>
        <div className="flex items-center">
          <span className="text-sky-600 font-black text-xl">{matchedIds.length} / {gameItems.length}</span>
        </div>
      </header>

      <div className="flex-1 grid grid-cols-12 gap-3 min-h-0">
        <div className="col-span-9 md:col-span-10 overflow-y-auto pr-2 custom-scrollbar">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 pb-4">
            {displayItems.map(item => {
              const isMatched = matchedIds.includes(item.id);
              const imageUrl = localImageMap[item.word] || item.imageUrl;
              return (
                <div 
                  key={item.id}
                  ref={el => {
                    if (el) dropTargetsRef.current.set(item.id, el);
                    else dropTargetsRef.current.delete(item.id);
                  }}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => checkMatch(e.dataTransfer.getData("word"), item.id)}
                  className={`relative aspect-square bg-white rounded-2xl overflow-hidden shadow-sm border-2 flex flex-col transition-all ${isMatched ? 'border-green-400 ring-2 ring-green-100' : 'border-white hover:border-sky-300'}`}
                >
                  <div className="flex-1 bg-white relative overflow-hidden">
                    <img src={imageUrl} className={`w-full h-full object-cover transition-opacity ${isMatched ? 'opacity-100' : 'opacity-85'}`} alt="" />
                    {isMatched && <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center animate-fadeIn"><div className="bg-white rounded-full p-2 border-2 border-green-500 text-2xl">✅</div></div>}
                  </div>
                  <div className="h-10 flex items-center justify-center bg-white border-t border-gray-50 text-[11px] font-black tracking-wider px-2 text-center">
                    {isMatched ? <span className="text-green-600 truncate w-full">{item.word}</span> : showHint ? <span className="text-orange-500 animate-pulse text-[9px]">Answer: {item.word}</span> : <span className="text-sky-200">Drop Here</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="col-span-3 md:col-span-2 bg-white rounded-2xl p-3 flex flex-col shadow-sm border-t-8 border-sky-400 min-h-0">
          <h3 className="text-xs font-black text-sky-700 mb-3 flex items-center gap-2"><span>🔠</span> Bank</h3>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
            {shuffledWords.map(word => (
              <div 
                key={word} 
                draggable 
                onDragStart={e => { voice.ensureContext(); e.dataTransfer.setData("word", word); }}
                onTouchStart={e => handleTouchStart(e, word)}
                className={`bg-sky-500 hover:bg-sky-600 text-white font-black py-4 px-2 rounded-xl text-center shadow-md text-[12px] md:text-[14px] cursor-grab transition-all active:scale-95 active:rotate-2 select-none ${errorWord === word ? 'animate-shake bg-red-500' : ''}`}
              >
                {word}
              </div>
            ))}
          </div>
        </div>
      </div>

      {touchDrag && (
        <div 
          className="fixed pointer-events-none bg-sky-600 text-white font-black py-4 px-6 rounded-2xl shadow-2xl text-xl z-[9999] opacity-90 transition-none"
          style={{ left: touchDrag.x, top: touchDrag.y, transform: 'translate(-50%, -100%) rotate(3deg)' }}
        >
          {touchDrag.word}
        </div>
      )}

      {showFinishedPopup && (
        <FinishedPopup modeName="Drag Mode" themeColor="#0ea5e9" onRestart={resetGame} onStay={() => setShowFinishedPopup(false)} onExit={onBack} />
      )}
    </div>
  );
};

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
    voice.ensureContext();
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
      if (remainingDistractors.length > 0) finalOptions.push(getRandomElement(remainingDistractors));
    }
    setOptions(shuffleArray(finalOptions));
    setStatus('idle');
  }, [currentIndex, words]);

  const handleChoice = (word: string) => {
    if (word === currentItem.word) {
      voice.play('correct');
      setStatus('correct');
      setTimeout(() => {
        if (orderPointer < playOrder.length - 1) setOrderPointer(orderPointer + 1);
        else setShowFinishedPopup(true);
      }, 600);
    } else {
      voice.play('wrong');
      setStatus('wrong');
      setTimeout(() => setStatus('idle'), 500);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto items-center justify-center gap-6">
      <header className="w-full flex justify-between items-center absolute top-3 left-0 px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { voice.ensureContext(); onBack(); }} className="bg-orange-100 p-2 rounded-xl text-orange-600 font-black hover:bg-orange-200 transition">← Back</button>
          <button onClick={() => initOrder(!isRandomMode)} className={`px-4 py-2 rounded-xl font-black text-xs shadow transition ${isRandomMode ? 'bg-orange-600 text-white' : 'bg-white text-orange-600 border-2 border-orange-100'}`}>
            {isRandomMode ? '🔀 Random' : '📋 Sequence'}
          </button>
          <button onClick={() => { voice.ensureContext(); setShowHint(!showHint); }} className={`px-4 py-2 rounded-xl font-black text-xs shadow transition ${showHint ? 'bg-orange-500 text-white' : 'bg-white text-orange-500 border-2 border-orange-100'}`}>
            {showHint ? '👀 Hide' : '💡 Hint'}
          </button>
        </div>
        <span className="text-orange-600 font-black text-xl">{orderPointer + 1} / {gameItems.length}</span>
      </header>
      <div className={`w-80 h-80 bg-white rounded-[40px] shadow-2xl border-8 p-4 transition-all ${status === 'correct' ? 'border-green-400 scale-105' : status === 'wrong' ? 'border-red-400 animate-shake' : 'border-white'}`}>
        <img src={imageUrl} className="w-full h-full object-cover rounded-[20px]" alt="" />
      </div>
      <div className="grid grid-cols-1 gap-4 w-full px-12">
        {options.map(opt => (
          <button key={opt} onClick={() => handleChoice(opt)} className={`bg-white hover:bg-orange-50 text-orange-600 font-black py-4 rounded-2xl shadow-md border-b-4 text-xl tracking-widest transition active:translate-y-1 ${showHint && opt === currentItem.word ? 'border-orange-500 ring-4 ring-orange-200 ring-offset-2' : 'border-orange-200'}`}>
            {opt}
          </button>
        ))}
      </div>
      <div className="flex gap-4 mt-4">
        <button disabled={orderPointer === 0} onClick={() => { voice.ensureContext(); setOrderPointer(orderPointer - 1); }} className="bg-orange-400 disabled:opacity-30 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition">Prev</button>
        <button disabled={orderPointer === playOrder.length - 1} onClick={() => { voice.ensureContext(); setOrderPointer(orderPointer + 1); }} className="bg-orange-400 disabled:opacity-30 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition">Next</button>
      </div>
      {showFinishedPopup && <FinishedPopup modeName="Choice Mode" themeColor="#f97316" onRestart={resetGame} onStay={() => setShowFinishedPopup(false)} onExit={onBack} />}
    </div>
  );
};

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
  const [wrongVoicePlayed, setWrongVoicePlayed] = useState(false);
  const [isUpperCase, setIsUpperCase] = useState(true);

  const currentIndex = playOrder[orderPointer];
  const currentItem = gameItems[currentIndex];
  
  const resetGame = () => {
    initOrder(isRandomMode);
    setShowFinishedPopup(false);
  };

  const initOrder = (random: boolean) => {
    voice.ensureContext();
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
      if (!indices.includes(rand) && currentItem.word[rand] !== ' ') indices.push(rand);
    }
    setFixedIndices(indices);
    const initialInput = Array(wordLength).fill('');
    indices.forEach(idx => { initialInput[idx] = currentItem.word[idx]; });
    currentItem.word.split('').forEach((char, idx) => { if (char === ' ') initialInput[idx] = ' '; });
    setUserInput(initialInput);
    const firstEmpty = initialInput.findIndex(v => v === '');
    setFocusedIndex(firstEmpty !== -1 ? firstEmpty : 0);
    setStatus('idle');
    setWrongVoicePlayed(false);
  }, [currentIndex, currentItem?.id]); 

  const handleInput = (char: string) => {
    if (status === 'correct' || !currentItem) return;
    if (status === 'wrong') setStatus('idle');
    const newInput = [...userInput];
    if (fixedIndices.includes(focusedIndex) || currentItem.word[focusedIndex] === ' ') return;
    newInput[focusedIndex] = char;
    setUserInput(newInput);

    if (!newInput.includes('')) {
      if (newInput.join('').toLowerCase() === currentItem.word.toLowerCase()) {
        voice.play('correct');
        setStatus('correct');
        setTimeout(() => {
          if (orderPointer < playOrder.length - 1) setOrderPointer(orderPointer + 1);
          else setShowFinishedPopup(true);
        }, 800);
      } else {
        if (!wrongVoicePlayed) { voice.play('wrong'); setWrongVoicePlayed(true); }
        setStatus('wrong');
      }
    } else {
      let next = (focusedIndex + 1) % currentItem.word.length;
      while (fixedIndices.includes(next) || currentItem.word[next] === ' ') next = (next + 1) % currentItem.word.length;
      setFocusedIndex(next);
    }
  };

  const handleBackspace = () => {
    if (status === 'correct' || !currentItem) return;
    const newInput = [...userInput];
    if (!fixedIndices.includes(focusedIndex) && currentItem.word[focusedIndex] !== ' ') {
      newInput[focusedIndex] = '';
      setUserInput(newInput);
      setStatus('idle');
      setWrongVoicePlayed(false);
    }
  };

  useEffect(() => {
    if (!currentItem) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      voice.ensureContext();
      if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) handleInput(e.key);
      else if (e.key === 'Backspace') handleBackspace();
      else if (e.key === 'Shift') setIsUpperCase(prev => !prev);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedIndex, userInput, status, currentItem?.word, wrongVoicePlayed]);

  // --- 虚拟键盘布局 ---
  const keyboardRows = [
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
    ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Delete']
  ];

  return (
    <div className="flex flex-col h-full items-center justify-center gap-6 p-4 overflow-hidden">
      <header className="w-full flex justify-between items-center absolute top-3 left-0 px-6">
        <div className="flex items-center gap-3">
          <button onClick={() => { voice.ensureContext(); onBack(); }} className="bg-green-100 p-2 rounded-xl text-green-600 font-black hover:bg-green-200 transition">← Back</button>
          <button onClick={() => initOrder(!isRandomMode)} className={`px-4 py-2 rounded-xl font-black text-xs shadow transition ${isRandomMode ? 'bg-green-600 text-white' : 'bg-white text-green-600 border-2 border-orange-100'}`}>
            {isRandomMode ? '🔀 Random' : '📋 Sequence'}
          </button>
          <button onClick={() => { voice.ensureContext(); setShowHint(!showHint); }} className={`px-4 py-2 rounded-xl font-black text-xs shadow transition ${showHint ? 'bg-orange-500 text-white' : 'bg-white text-orange-500 border-2 border-orange-100'}`}>
            {showHint ? '👀 Hide' : '💡 Hint'}
          </button>
        </div>
        <span className="text-green-600 font-black text-xl">{orderPointer + 1} / {gameItems.length}</span>
      </header>

      <div className={`w-56 h-56 md:w-80 md:h-80 bg-white rounded-[40px] shadow-2xl border-8 p-4 transition-all ${status === 'correct' ? 'border-green-400 scale-105' : status === 'wrong' ? 'border-red-400 animate-shake' : 'border-white'}`}>
        <img src={localImageMap[currentItem.word] || currentItem.imageUrl} className="w-full h-full object-cover rounded-[20px]" alt="" />
      </div>

      <div className="flex flex-wrap justify-center gap-1 md:gap-2 max-w-2xl px-4">
        {userInput.map((char, idx) => {
          const isHint = fixedIndices.includes(idx);
          return currentItem.word[idx] === ' ' ? <div key={idx} className="w-4 md:w-6" /> : (
            <button key={idx} onClick={() => { voice.ensureContext(); setFocusedIndex(idx); }} className={`w-9 h-12 md:w-12 md:h-16 rounded-xl border-b-4 flex items-center justify-center text-xl md:text-3xl font-black transition-all ${focusedIndex === idx ? 'bg-green-100 border-green-500 scale-110 shadow-lg' : isHint ? 'bg-orange-50 border-orange-200' : 'bg-white border-gray-200 text-gray-700'} ${isHint ? 'text-orange-500' : ''}`}>
              {char || '_'}
            </button>
          );
        })}
      </div>

      <p className="font-bold italic h-6 animate-pulse text-sm md:text-base">
        {status === 'correct' ? <span className="text-green-500">Correct! Well done! 🌟</span> : showHint ? <span className="text-orange-500">Answer: {currentItem.word}</span> : status === 'wrong' ? <span className="text-red-500">Wrong! Try again! 🧐</span> : <span className="text-green-500 opacity-60">Type to complete!</span>}
      </p>

      {/* --- 虚拟键盘 --- */}
      <div className="w-full max-w-2xl bg-white/50 backdrop-blur-sm p-4 rounded-[32px] shadow-inner border-2 border-white space-y-2">
        {keyboardRows.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1 md:gap-2">
            {row.map(key => {
              const displayKey = (key === 'Shift' || key === 'Delete') ? key : (isUpperCase ? key.toUpperCase() : key.toLowerCase());
              
              return (
                <button
                  key={key}
                  onClick={() => {
                    voice.ensureContext();
                    if (key === 'Delete') handleBackspace();
                    else if (key === 'Shift') setIsUpperCase(!isUpperCase);
                    else handleInput(displayKey);
                  }}
                  className={`flex-1 py-3 md:py-4 rounded-xl font-black text-sm md:text-xl shadow-md border-b-4 transition active:translate-y-1 active:shadow-none ${
                    key === 'Delete' 
                    ? 'bg-red-400 border-red-600 text-white min-w-[60px]' 
                    : key === 'Shift'
                    ? `${isUpperCase ? 'bg-indigo-600 border-indigo-800' : 'bg-indigo-300 border-indigo-500'} text-white min-w-[60px]`
                    : 'bg-sky-400 border-sky-600 text-white hover:bg-sky-500'
                  }`}
                >
                  {key === 'Delete' ? '⌫' : key === 'Shift' ? (isUpperCase ? '⬆️' : '⬇️') : displayKey}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        <button disabled={orderPointer === 0} onClick={() => { voice.ensureContext(); setOrderPointer(orderPointer - 1); }} className="bg-green-400 disabled:opacity-30 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition">Prev</button>
        <button disabled={orderPointer === playOrder.length - 1} onClick={() => { voice.ensureContext(); setOrderPointer(orderPointer + 1); }} className="bg-green-400 disabled:opacity-30 text-white px-8 py-3 rounded-2xl font-black shadow-lg hover:scale-105 active:scale-95 transition">Next</button>
      </div>

      {showFinishedPopup && <FinishedPopup modeName="Spelling Mode" themeColor="#22c55e" onRestart={resetGame} onStay={() => setShowFinishedPopup(false)} onExit={onBack} />}
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<AppMode>('home');
  const [words, setWords] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [...DEFAULT_WORDS];
  });
  const [localImageMap, setLocalImageMap] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const gameItems = useMemo(() => getGameItemsFromWords(words), [words]);

  const handleFileSelection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const newMap = { ...localImageMap };
    Array.from(files).forEach((file: File) => {
      const rawFileName = file.name.toLowerCase().split('.')[0];
      const normalizedFileName = rawFileName.replace(/[^a-z0-9]/g, '');
      const fileNameTokens = rawFileName.split(/[\s\-_]+/).map(t => t.replace(/[^a-z0-9]/g, ''));
      words.forEach(word => {
        const normalizedWord = word.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (normalizedFileName === normalizedWord || fileNameTokens.includes(normalizedWord)) newMap[word] = URL.createObjectURL(file);
      });
    });
    setLocalImageMap(newMap);
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#f0f9ff] font-['Comic_Neue',cursive]">
      {view === 'home' && <HomeView onSelect={setView} />}
      {view === 'config' && <ConfigView words={words} onSave={w => { setWords(w); localStorage.setItem(STORAGE_KEY, JSON.stringify(w)); }} onLoadPhotos={() => fileInputRef.current?.click()} onBack={() => setView('home')} photoCount={Object.keys(localImageMap).filter(k => words.includes(k)).length} />}
      {view === 'drag' && <DragModeView onBack={() => setView('home')} localImageMap={localImageMap} gameItems={gameItems} words={words} />}
      {view === 'choice' && <ChoiceModeView onBack={() => setView('home')} localImageMap={localImageMap} gameItems={gameItems} words={words} />}
      {view === 'spelling' && <SpellingModeView onBack={() => setView('home')} localImageMap={localImageMap} gameItems={gameItems} words={words} />}
      {view === 'goodbye' && <GoodbyeView onRestart={() => setView('home')} />}
      <input type="file" multiple accept="image/*" ref={fileInputRef} className="hidden" onChange={handleFileSelection} />
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #bae6fd; border-radius: 10px; }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 20%, 60% { transform: translateX(-8px); } 40%, 80% { transform: translateX(8px); } }
        .animate-shake { animation: shake 0.4s ease-in-out; }
        @keyframes bounceIn { 0% { transform: scale(0.3); opacity: 0; } 50% { transform: scale(1.05); opacity: 1; } 70% { transform: scale(0.9); } 100% { transform: scale(1); } }
        .animate-bounceIn { animation: bounceIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      `}</style>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);

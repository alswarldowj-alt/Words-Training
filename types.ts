export interface GameItem {
  id: string;
  word: string;
  imageUrl: string;
  description: string;
}

export interface GameState {
  items: GameItem[];
  matchedIds: string[];
  shuffledWords: string[];
  score: number;
  message: string | null;
  isGameOver: boolean;
}

import { create } from 'zustand';
import { QueueState, QueueTrack } from '../types';

interface PlayerState extends QueueState {
  isLoading: boolean;
  lastMessage: string | null;
  setQueueState: (state: QueueState) => void;
  setLoading: (v: boolean) => void;
  setMessage: (msg: string | null) => void;
  setCurrent: (track: QueueTrack | null) => void;
  setVolume: (v: number) => void;
  setPlaying: (v: boolean) => void;
}

export const usePlayerStore = create<PlayerState>((set) => ({
  userId: '',
  current: null,
  queue: [],
  isPlaying: false,
  volume: 80,
  isLoading: false,
  lastMessage: null,

  setQueueState: (state) => set({ ...state }),
  setLoading: (isLoading) => set({ isLoading }),
  setMessage: (lastMessage) => set({ lastMessage }),
  setCurrent: (current) => set({ current, isPlaying: !!current }),
  setVolume: (volume) => set({ volume }),
  setPlaying: (isPlaying) => set({ isPlaying }),
}));

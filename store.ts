import { create } from 'zustand';

export const useGameStore = create((set) => ({
  gameState: 'STARTUP_MODAL', // STARTUP_MODAL, MAIN_MENU, DRIVING, etc.
  viewMode: '3P',
  playerInfo: { nickname: 'Driver', gender: 'other' },
  currentLanguage: 'zh',

  setGameState: (state) => set({ gameState: state }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setPlayerInfo: (info) => set({ playerInfo: info }),
}));

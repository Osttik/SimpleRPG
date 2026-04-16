import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/ui.slice';
import menuReducer from './slices/menu.slice';
import lobbyReducer from './slices/lobby.slice';
import { proxy } from 'valtio';

export interface IInteractionOption {
  nameKey: string;
  interactionId: string;
}

export interface IInteractionTarget {
  targetId: string;
  nameKey: string;
  interactions: IInteractionOption[];
}

export interface IInteractionsState {
  targets: IInteractionTarget[];
  selectedTargetId: string | null;
}

export const interactionsState = proxy({
  targets: [],
  selectedTargetId: null,
} as IInteractionsState);

export const store = configureStore({
  reducer: {
    menu: menuReducer,
    ui: uiReducer,
    lobby: lobbyReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

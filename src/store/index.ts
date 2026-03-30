import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/ui.slice';
import menuReducer from './slices/menu.slice';
import { proxy } from 'valtio';

export interface IInteractionOption {
  nameKey: string;
  interactionId: string;
}

export interface IInteractionsState {
  options: IInteractionOption[];
}

export const interactionsState = proxy({
  options: [],
} as IInteractionsState);

export const store = configureStore({
  reducer: {
    menu: menuReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

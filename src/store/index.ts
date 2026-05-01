import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/ui.slice';
import menuReducer from './slices/menu.slice';
import lobbyReducer from './slices/lobby.slice';
export {
  clearInteractionTargets,
  interactionsState,
  setSelectedInteractionTarget,
  setInteractionTargets,
  type InteractionsState as IInteractionsState,
  type InteractionOption as IInteractionOption,
  type InteractionTarget as IInteractionTarget,
} from '@/features/interactions/state/interactions-state';

export const store = configureStore({
  reducer: {
    menu: menuReducer,
    ui: uiReducer,
    lobby: lobbyReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

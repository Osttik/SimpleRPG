import { configureStore } from '@reduxjs/toolkit';
import uiReducer from './slices/ui.slice';
import menuReducer from './slices/menu.slice';

export const store = configureStore({
  reducer: {
    menu: menuReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

import { configureStore } from '@reduxjs/toolkit';
import counterReducer from './slices/counterSlice';
import menuReducer from './slices/menu.slice';

export const store = configureStore({
  reducer: {
    menu: menuReducer,
    counter: counterReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

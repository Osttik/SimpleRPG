import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useAppDispatch } from '../hooks/useAppDispatch';
import type { RootState } from '..';
import { useSelector } from 'react-redux';

interface MenuState {
  isMenuOpen: boolean;
}

const initialState: MenuState = {
  isMenuOpen: false,
};

export const menuSlice = createSlice({
  name: 'menu',
  initialState,
  reducers: {
    openMenu: (state) => {
      state.isMenuOpen = true;
    },
    closeMenu: (state) => {
      state.isMenuOpen = false;
    },
    setMenuState: (state, action: PayloadAction<boolean>) => {
      state.isMenuOpen = action.payload;
    },
  },
});

export const useMenuActions = () => {
  return {
    openMenu: useAppDispatch(menuSlice.actions.openMenu),
    closeMenu: useAppDispatch(menuSlice.actions.closeMenu),
    setMenuState: useAppDispatch(menuSlice.actions.setMenuState),
  };
}
// TO DO, rework to good
export const useMenuSelections = () => {
  return {
    isMenuOpen: useSelector((state: RootState) => state.menu.isMenuOpen),
  };
}

export default menuSlice.reducer;

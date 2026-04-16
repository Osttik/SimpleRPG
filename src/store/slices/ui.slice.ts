import { useSelector } from 'react-redux';
import { SliceBuilder } from '.';
import { useAppDispatch } from '../hooks/useAppDispatch';
import type { RootState } from '..';

const builder = new SliceBuilder("ui")
.addParameter('isInventoryOpen', false)
.addParameter('isCraftingOpen', false);

const uiSlice = builder.build();
export const uiActions = uiSlice.actions;

export const useUIActions = () => { 
  return {
    openInventory: useAppDispatch(uiActions.set_isInventoryOpen),
    openCrafting: useAppDispatch(uiActions.set_isCraftingOpen),
  };
}

export const selectIsInventoryOpen = () => useSelector((state: RootState) => state.ui.isInventoryOpen);
export const selectIsCraftingOpen = () => useSelector((state: RootState) => state.ui.isCraftingOpen);
export default uiSlice.reducer;

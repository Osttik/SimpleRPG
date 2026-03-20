import { useSelector } from 'react-redux';
import { SliceBuilder } from '.';
import { useAppDispatch } from '../hooks/useAppDispatch';
import type { RootState } from '..';

const builder = new SliceBuilder("ui")
.addParameter('isInventoryOpen', false);

const uiSlice = builder.build();

export const useUIActions = () => { 
  return {
    openInventory: useAppDispatch(uiSlice.actions.set_isInventoryOpen),
  };
}

export const selectIsInventoryOpen = () => useSelector((state: RootState) => state.ui.isInventoryOpen);
export default uiSlice.reducer;

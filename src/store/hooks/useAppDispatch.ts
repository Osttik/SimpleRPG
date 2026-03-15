import { useDispatch } from "react-redux";
import { useCallback } from "react";
import type { UnknownAction } from "@reduxjs/toolkit";

export const useAppDispatch = <Args extends any[], ActionType extends UnknownAction>(
  actionCreator: (...args: Args) => ActionType
) => {
  const dispatch = useDispatch();

  return useCallback(
    (...args: Args) => dispatch(actionCreator(...args)),
    [dispatch, actionCreator]
  );
};
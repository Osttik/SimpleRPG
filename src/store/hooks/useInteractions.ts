import { useSnapshot } from "valtio";
import { interactionsState } from "..";

export const useInteractions = () => {
  return useSnapshot(interactionsState)
}
import { interactionsState } from "@/features/interactions/state/interactions-state";
import { useSnapshot } from "valtio";

export const useInteractions = () => {
  return useSnapshot(interactionsState)
}

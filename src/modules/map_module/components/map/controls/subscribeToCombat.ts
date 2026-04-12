import { KeyEnum } from "@/defines/key.enum";
import { keyboardService } from "@/services/keyboard.service";
import { areControlsDisabled } from ".";
import { CombatAttackDirection, CombatBlockDirection } from "@/modules/map_module/protocol/InputEncoder";

const STANDARD_BLOCK_DIRECTION = CombatBlockDirection.Front;
let isBlocking = false;

export const clearCombatIntent = (socketWorker?: Worker | null) => {
  if (!isBlocking || !socketWorker) {
    isBlocking = false;
    return;
  }

  socketWorker.postMessage({
    type: 'block',
    active: false,
    direction: STANDARD_BLOCK_DIRECTION,
  });
  isBlocking = false;
};

export const subscribeToCombat = (socketWorker: Worker) => {
  const attackBindings = [
    { keys: [KeyEnum.j, KeyEnum.J], direction: CombatAttackDirection.SlashLeftToRight },
    { keys: [KeyEnum.k, KeyEnum.K], direction: CombatAttackDirection.SlashRightToLeft },
    { keys: [KeyEnum.l, KeyEnum.L], direction: CombatAttackDirection.RisingSlash },
    { keys: [KeyEnum.u, KeyEnum.U], direction: CombatAttackDirection.OverheadSlash },
    { keys: [KeyEnum.o, KeyEnum.O], direction: CombatAttackDirection.ThrustFront },
  ];

  const disposables = attackBindings.map(binding =>
    keyboardService.subscribeToKeyDown(binding.keys, (e) => {
      if (areControlsDisabled() || e.repeat) return;
      socketWorker.postMessage({ type: 'attack', direction: binding.direction });
    }));

  disposables.push(keyboardService.subscribeToKeyDown([KeyEnum.b, KeyEnum.B], (e) => {
    if (areControlsDisabled() || e.repeat || isBlocking) return;
    isBlocking = true;
    socketWorker.postMessage({ type: 'block', active: true, direction: STANDARD_BLOCK_DIRECTION });
  }));

  disposables.push(keyboardService.subscribeToKeyUp([KeyEnum.b, KeyEnum.B], () => {
    if (!isBlocking) return;
    socketWorker.postMessage({ type: 'block', active: false, direction: STANDARD_BLOCK_DIRECTION });
    isBlocking = false;
  }));

  return disposables;
};

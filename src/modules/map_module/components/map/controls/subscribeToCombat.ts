import { KeyEnum } from "@/defines/key.enum";
import { keyboardService } from "@/services/keyboard.service";
import { areControlsDisabled } from ".";
import { CombatAttackDirection, CombatBlockDirection } from "@/modules/map_module/protocol/InputEncoder";

let activeBlockDirection: number | null = null;

export const clearCombatIntent = (socketWorker?: Worker | null) => {
  if (activeBlockDirection == null || !socketWorker) {
    activeBlockDirection = null;
    return;
  }

  socketWorker.postMessage({
    type: 'block',
    active: false,
    direction: activeBlockDirection,
  });
  activeBlockDirection = null;
};

export const subscribeToCombat = (socketWorker: Worker) => {
  const attackBindings = [
    { keys: [KeyEnum.j, KeyEnum.J], direction: CombatAttackDirection.SlashLeftToRight },
    { keys: [KeyEnum.k, KeyEnum.K], direction: CombatAttackDirection.SlashRightToLeft },
    { keys: [KeyEnum.l, KeyEnum.L], direction: CombatAttackDirection.RisingSlash },
    { keys: [KeyEnum.u, KeyEnum.U], direction: CombatAttackDirection.OverheadSlash },
    { keys: [KeyEnum.o, KeyEnum.O], direction: CombatAttackDirection.ThrustFront },
  ];

  const blockBindings = [
    { keys: [KeyEnum.z, KeyEnum.Z], direction: CombatBlockDirection.High },
    { keys: [KeyEnum.x, KeyEnum.X], direction: CombatBlockDirection.Left },
    { keys: [KeyEnum.c, KeyEnum.C], direction: CombatBlockDirection.Right },
    { keys: [KeyEnum.v, KeyEnum.V], direction: CombatBlockDirection.Front },
  ];

  const disposables = attackBindings.map(binding =>
    keyboardService.subscribeToKeyDown(binding.keys, (e) => {
      if (areControlsDisabled() || e.repeat) return;
      socketWorker.postMessage({ type: 'attack', direction: binding.direction });
    }));

  blockBindings.forEach((binding) => {
    disposables.push(keyboardService.subscribeToKeyDown(binding.keys, (e) => {
      if (areControlsDisabled() || e.repeat) return;
      if (activeBlockDirection === binding.direction) return;

      if (activeBlockDirection != null) {
        socketWorker.postMessage({ type: 'block', active: false, direction: activeBlockDirection });
      }

      activeBlockDirection = binding.direction;
      socketWorker.postMessage({ type: 'block', active: true, direction: binding.direction });
    }));

    disposables.push(keyboardService.subscribeToKeyUp(binding.keys, () => {
      if (activeBlockDirection !== binding.direction) return;
      socketWorker.postMessage({ type: 'block', active: false, direction: binding.direction });
      activeBlockDirection = null;
    }));
  });

  return disposables;
};


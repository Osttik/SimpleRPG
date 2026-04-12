import testingDummyRig from '../../../assets/rigs/testing_dummy.rig.json';
import testingDummySkin from '../../../assets/skins/testing_dummy.skin.json';
import { COMBAT_RIG_CONTRACT_HASH, HUMANOID_COMBAT_RIG_CONTRACT } from '../animation/generated/combatRigContract';
import { SpriteSystem } from '../utils/SpriteSystem';
import type { CharacterRigDefinition, CharacterSkinDefinition, SkinPartDefinition } from '../animation/types/RigTypes';

export interface ResolvedCharacterRigSkin {
  rig: CharacterRigDefinition;
  skin: CharacterSkinDefinition;
  texture: WebGLTexture;
  textureSize: {
    width: number;
    height: number;
  };
}

export class CharacterRigRegistry {
  private static readonly rigs = new Map<string, CharacterRigDefinition>();
  private static readonly skins = new Map<string, CharacterSkinDefinition>();
  private static readonly loaded = new Map<string, ResolvedCharacterRigSkin>();
  private static initPromise: Promise<void> | null = null;

  static init(): Promise<void> {
    if (this.initPromise) return this.initPromise;

    this.rigs.set(testingDummyRig.id, applyGeneratedCombatContract(testingDummyRig as unknown as CharacterRigDefinition));
    this.skins.set(testingDummySkin.id, testingDummySkin as unknown as CharacterSkinDefinition);

    this.initPromise = this.loadSkin('testing_dummy').then(() => undefined);
    return this.initPromise;
  }

  static async loadSkin(skinId: string): Promise<ResolvedCharacterRigSkin> {
    const cached = this.loaded.get(skinId);
    if (cached) return cached;

    const skin = this.skins.get(skinId);
    if (!skin) throw new Error(`CharacterRigRegistry: skin '${skinId}' is not registered`);

    const rig = this.rigs.get(skin.rigId);
    if (!rig) throw new Error(`CharacterRigRegistry: rig '${skin.rigId}' is not registered`);

    const texture = await SpriteSystem.getEntityTexture(skin.texture.sheetKey);
    const textureSize = SpriteSystem.entityDimensions.get(skin.texture.sheetKey);
    if (!textureSize) throw new Error(`CharacterRigRegistry: texture dimensions missing for '${skin.texture.sheetKey}'`);

    const resolved = { rig, skin, texture, textureSize };
    this.loaded.set(skinId, resolved);
    return resolved;
  }

  static getForEntityType(entityTypeName: string, variantId = 'testing_dummy'): ResolvedCharacterRigSkin | undefined {
    if (entityTypeName !== 'player') return undefined;
    return this.getVariant('testing_dummy', variantId);
  }

  private static getVariant(baseSkinId: string, variantId: string): ResolvedCharacterRigSkin | undefined {
    const base = this.loaded.get(baseSkinId);
    if (!base) return undefined;
    if (variantId === baseSkinId) return base;

    const cached = this.loaded.get(variantId);
    if (cached) return cached;

    const variant = base.skin.variants?.[variantId];
    if (!variant) return base;

    const parts: Record<string, SkinPartDefinition> = {};
    for (const [partName, part] of Object.entries(base.skin.parts)) {
      parts[partName] = {
        ...part,
        scale: variant.partScale?.[partName] ?? part.scale,
      };
    }

    const skin: CharacterSkinDefinition = {
      ...base.skin,
      id: variantId,
      name: variantId,
      scale: variant.scale ?? base.skin.scale,
      defaultTint: variant.tint ?? base.skin.defaultTint,
      anchorOverrides: variant.anchorOverrides ?? base.skin.anchorOverrides,
      parts,
    };
    const resolved = {
      ...base,
      skin,
    };
    this.loaded.set(variantId, resolved);
    return resolved;
  }
}

function applyGeneratedCombatContract(rig: CharacterRigDefinition): CharacterRigDefinition {
  if (rig.id !== HUMANOID_COMBAT_RIG_CONTRACT.id) return rig;

  const generatedVisual = HUMANOID_COMBAT_RIG_CONTRACT.visual;
  const parts = { ...rig.parts };
  for (const [partName, length] of Object.entries(generatedVisual.partLengths)) {
    parts[partName] = {
      ...(parts[partName] ?? { bindOffset: [0, 0] }),
      length: Number(length),
    };
  }

  const patched: CharacterRigDefinition = {
    ...rig,
    parts,
    anchors: generatedVisual.anchors as unknown as CharacterRigDefinition['anchors'],
    limbs: generatedVisual.limbs as unknown as CharacterRigDefinition['limbs'],
    attachments: generatedVisual.attachments as unknown as CharacterRigDefinition['attachments'],
    combatContract: {
      id: HUMANOID_COMBAT_RIG_CONTRACT.id,
      version: HUMANOID_COMBAT_RIG_CONTRACT.version,
      hash: HUMANOID_COMBAT_RIG_CONTRACT.hash,
      units: HUMANOID_COMBAT_RIG_CONTRACT.units,
      bodyPartToVisualParts: generatedVisual.bodyPartToVisualParts,
      hurtboxes: HUMANOID_COMBAT_RIG_CONTRACT.hurtboxes,
      routing: HUMANOID_COMBAT_RIG_CONTRACT.routing,
    },
  };

  if (import.meta.env.DEV && patched.combatContract?.hash !== COMBAT_RIG_CONTRACT_HASH) {
    throw new Error(`Combat rig contract hash mismatch for '${rig.id}'. Regenerate combat rig artifacts.`);
  }

  return patched;
}

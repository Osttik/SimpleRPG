import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const contractPath = path.join(root, 'schema', 'combat-rig-contract.humanoid.json');
const cppOutPath = path.join(root, 'engine', 'headers', 'core', 'combat', 'combat-rig-contract.generated.h');
const tsOutPath = path.join(root, 'src', 'modules', 'game_module', 'animation', 'generated', 'combatRigContract.ts');
const docOutPath = path.join(root, 'docs', 'combat-rig-contract.generated.md');
const frontendRigPath = path.join(root, 'src', 'assets', 'rigs', 'testing_dummy.rig.json');

const checkOnly = process.argv.includes('--check');

const contract = JSON.parse(fs.readFileSync(contractPath, 'utf8'));
validateContract(contract);
const normalized = normalizeContract(contract);
const hash = crypto.createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16);

const outputs = [
  [cppOutPath, renderCpp(normalized, hash)],
  [tsOutPath, renderTs(normalized, hash)],
  [docOutPath, renderDoc(normalized, hash)],
];

if (checkOnly) {
  let mismatch = false;
  for (const [target, content] of outputs) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (current !== content) {
      console.error(`Combat rig contract drift: ${path.relative(root, target)} is stale.`);
      mismatch = true;
    }
  }
  if (!frontendRigMatchesGenerated(normalized, hash)) {
    console.error(`Combat rig contract drift: ${path.relative(root, frontendRigPath)} base rig metadata is stale.`);
    mismatch = true;
  }
  if (mismatch) {
    console.error('Run `npm run generate:combat-rig` to refresh generated combat-rig artifacts.');
    process.exit(1);
  }
  console.log(`Combat rig contract OK (${normalized.id}@${hash}).`);
  process.exit(0);
}

for (const [target, content] of outputs) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}
updateFrontendRigMetadata(normalized, hash);
console.log(`Generated combat rig contract ${normalized.id}@${hash}.`);

function normalizeContract(value) {
  const partIdByKey = Object.fromEntries(value.bodyParts.map((part) => [part.key, part.id]));
  const shield = {
    ...value.shield,
    partId: partIdByKey[value.shield.part],
  };
  const visualMappings = {};
  for (const [partKey, visualParts] of Object.entries(value.visual.bodyPartToVisualParts ?? {})) {
    visualMappings[partIdByKey[partKey]] = visualParts;
  }

  return {
    ...value,
    hashlessVersion: value.version,
    bodyParts: [...value.bodyParts].sort((a, b) => a.id - b.id),
    hurtboxes: value.hurtboxes.map((hurtbox) => ({
      ...hurtbox,
      partId: partIdByKey[hurtbox.part],
    })),
    visual: {
      ...value.visual,
      bodyPartToVisualPartsById: visualMappings,
    },
    functionalGroupsById: Object.fromEntries(
      Object.entries(value.functionalGroups).map(([key, parts]) => [key, parts.map((part) => partIdByKey[part])]),
    ),
    shield,
    partIdByKey,
  };
}

function validateContract(value) {
  const ids = new Set();
  const keys = new Set();
  for (const part of value.bodyParts ?? []) {
    if (ids.has(part.id)) throw new Error(`Duplicate body part id ${part.id}`);
    if (keys.has(part.key)) throw new Error(`Duplicate body part key ${part.key}`);
    ids.add(part.id);
    keys.add(part.key);
  }
  for (let id = 0; id < ids.size; id++) {
    if (!ids.has(id)) throw new Error(`Body part ids must be contiguous from 0; missing ${id}`);
  }
  for (const hurtbox of value.hurtboxes ?? []) {
    if (!keys.has(hurtbox.part)) throw new Error(`Hurtbox references unknown part ${hurtbox.part}`);
    if (hurtbox.primitive !== 'circle' && hurtbox.primitive !== 'box') {
      throw new Error(`Unsupported hurtbox primitive ${hurtbox.primitive}`);
    }
  }
  for (const [group, parts] of Object.entries(value.functionalGroups ?? {})) {
    for (const part of parts) {
      if (!keys.has(part)) throw new Error(`Functional group ${group} references unknown part ${part}`);
    }
  }
  const shield = value.shield;
  if (!shield) throw new Error('Missing shield structural defaults');
  if (!keys.has(shield.part)) throw new Error(`Shield defaults reference unknown part ${shield.part}`);
  if (!value.functionalGroups?.[shield.functionalGroup]?.includes(shield.part)) {
    throw new Error(`Shield part ${shield.part} must belong to functional group ${shield.functionalGroup}`);
  }
  for (const field of ['maxIntegrity', 'defaultIntegrity', 'stopPower', 'breakThreshold']) {
    if (!Number.isInteger(shield[field]) || shield[field] < 0) {
      throw new Error(`Shield ${field} must be a non-negative integer`);
    }
  }
  if (shield.defaultIntegrity > shield.maxIntegrity) {
    throw new Error('Shield defaultIntegrity cannot exceed maxIntegrity');
  }
}

function frontendRigMatchesGenerated(value, hash) {
  if (!fs.existsSync(frontendRigPath)) return false;
  const rig = JSON.parse(fs.readFileSync(frontendRigPath, 'utf8'));
  if (rig.id !== value.id) return false;
  if (rig.combatContract?.hash !== hash) return false;
  if (JSON.stringify(rig.anchors) !== JSON.stringify(value.visual.anchors)) return false;
  if (JSON.stringify(rig.limbs) !== JSON.stringify(value.visual.limbs)) return false;
  if (JSON.stringify(rig.attachments) !== JSON.stringify(value.visual.attachments)) return false;
  if (JSON.stringify(rig.combatContract?.shield) !== JSON.stringify(value.shield)) return false;
  for (const [partName, length] of Object.entries(value.visual.partLengths)) {
    if (rig.parts?.[partName]?.length !== length) return false;
  }
  return true;
}

function updateFrontendRigMetadata(value, hash) {
  if (!fs.existsSync(frontendRigPath)) return;
  const rig = JSON.parse(fs.readFileSync(frontendRigPath, 'utf8'));
  rig.id = value.id;
  rig.anchors = value.visual.anchors;
  rig.limbs = value.visual.limbs;
  rig.attachments = value.visual.attachments;
  for (const [partName, length] of Object.entries(value.visual.partLengths)) {
    rig.parts ??= {};
    rig.parts[partName] ??= {};
    rig.parts[partName].length = length;
  }
  rig.combatContract = {
    ...(rig.combatContract ?? {}),
    id: value.id,
    version: value.version,
    hash,
    units: {
      ...value.units,
      note: 'Generated from schema/combat-rig-contract.humanoid.json. Runtime rig data is patched from src/generated/combatRigContract.ts.',
    },
    bodyPartToVisualParts: value.visual.bodyPartToVisualPartsById,
    shield: value.shield,
  };
  fs.writeFileSync(frontendRigPath, `${JSON.stringify(rig, null, 2)}\n`);
}

function renderCpp(value, hash) {
  const partConstants = value.bodyParts
    .map((part) => `constexpr uint8_t BodyPart${part.key} = ${part.id};`)
    .join('\n');
  const bodyParts = value.bodyParts
    .map((part) => `    BodyPartDefinition{${part.id}, "${part.key}", ${part.maxHp}, ${part.stopPower}, ${part.layer === 'virtual' ? 1 : 0}},`)
    .join('\n');
  const hurtboxes = value.hurtboxes
    .map((hurtbox) => {
      if (hurtbox.primitive === 'circle') {
        return `    HurtboxDefinition{${hurtbox.partId}, HurtboxPrimitive::Circle, ${hurtbox.center[0]}, ${hurtbox.center[1]}, ${hurtbox.radius}, 0},`;
      }
      return `    HurtboxDefinition{${hurtbox.partId}, HurtboxPrimitive::Box, ${hurtbox.min[0]}, ${hurtbox.min[1]}, ${hurtbox.max[0]}, ${hurtbox.max[1]}},`;
    })
    .join('\n');
  const group = (name) => value.functionalGroupsById[name].join(', ');
  const chest = value.partIdByKey.ChestVirtual;
  const belly = value.partIdByKey.BellyVirtual;
  const pelvis = value.partIdByKey.PelvisVirtual;
  const shield = value.shield;

  return `#pragma once

#include <array>
#include <cstdint>

namespace CombatRigContract
{
constexpr const char *ContractId = "${value.id}";
constexpr const char *ContractHash = "${hash}";
constexpr uint32_t ContractVersion = ${value.version};
constexpr float FrontendScale = ${value.units.frontendScale};

${partConstants}
constexpr uint8_t BodyPartCount = ${value.bodyParts.length};

enum class HurtboxPrimitive : uint8_t
{
  Circle = 0,
  Box = 1
};

struct BodyPartDefinition
{
  uint8_t Id;
  const char *Key;
  int16_t MaxHp;
  int16_t StopPower;
  uint8_t Layer;
};

struct HurtboxDefinition
{
  uint8_t PartId;
  HurtboxPrimitive Primitive;
  int16_t A;
  int16_t B;
  int16_t C;
  int16_t D;
};

struct ShieldStructuralDefaults
{
  uint8_t PartId;
  int16_t MaxIntegrity;
  int16_t DefaultIntegrity;
  int16_t StopPower;
  int16_t BreakThreshold;
};

constexpr std::array<BodyPartDefinition, BodyPartCount> BodyParts = {{
${bodyParts}
}};

constexpr std::array<HurtboxDefinition, ${value.hurtboxes.length}> OuterHurtboxes = {{
${hurtboxes}
}};

constexpr std::array<uint8_t, ${value.functionalGroupsById.leftLeg.length}> LeftLegParts = {${group('leftLeg')}};
constexpr std::array<uint8_t, ${value.functionalGroupsById.rightLeg.length}> RightLegParts = {${group('rightLeg')}};
constexpr std::array<uint8_t, ${value.functionalGroupsById.attackRequired.length}> AttackRequiredParts = {${group('attackRequired')}};
constexpr std::array<uint8_t, ${value.functionalGroupsById.blockRequired.length}> BlockRequiredParts = {${group('blockRequired')}};

constexpr uint8_t ChestVirtualPart = ${chest};
constexpr uint8_t BellyVirtualPart = ${belly};
constexpr uint8_t PelvisVirtualPart = ${pelvis};
constexpr int16_t ChestMinYExclusive = 4;
constexpr int16_t PelvisMaxYExclusive = -4;

constexpr ShieldStructuralDefaults Shield = {
    ${shield.partId},
    ${shield.maxIntegrity},
    ${shield.defaultIntegrity},
    ${shield.stopPower},
    ${shield.breakThreshold},
};
}
`;
}

function renderTs(value, hash) {
  const bodyPartEntries = value.bodyParts.map((part) => `  ${part.key}: ${part.id},`).join('\n');
  const bodyPartNames = value.bodyParts.map((part) => `  ${part.id}: '${part.key}',`).join('\n');
  const labels = value.bodyParts.map((part) => `  ${part.id}: '${part.label}',`).join('\n');

  return `export const COMBAT_RIG_CONTRACT_ID = '${value.id}';
export const COMBAT_RIG_CONTRACT_VERSION = ${value.version};
export const COMBAT_RIG_CONTRACT_HASH = '${hash}';

export const BodyPart = {
${bodyPartEntries}
} as const;

export const BodyPartKeyById: Record<number, string> = {
${bodyPartNames}
};

export const BodyPartLabelById: Record<number, string> = {
${labels}
};

export const HUMANOID_COMBAT_RIG_CONTRACT = ${JSON.stringify({
    schema: value.schema,
    id: value.id,
    version: value.version,
    hash,
    units: value.units,
    bodyParts: value.bodyParts,
    hurtboxes: value.hurtboxes,
    routing: value.routing,
    visual: {
      anchors: value.visual.anchors,
      limbs: value.visual.limbs,
      partLengths: value.visual.partLengths,
      attachments: value.visual.attachments,
      bodyPartToVisualParts: value.visual.bodyPartToVisualPartsById,
    },
    functionalGroups: value.functionalGroupsById,
    shield: value.shield,
  }, null, 2)} as const;
`;
}

function renderDoc(value, hash) {
  const rows = value.bodyParts
    .map((part) => `| ${part.id} | ${part.key} | ${part.layer} | ${part.maxHp} | ${part.stopPower} |`)
    .join('\n');
  const shield = value.shield;
  return `# Generated Combat Rig Contract

Contract: \`${value.id}\`
Version: \`${value.version}\`
Hash: \`${hash}\`
Units: \`${value.units.source}\`; frontend scale \`${value.units.frontendScale}\`

| ID | Part | Layer | HP | Stop |
|---:|---|---|---:|---:|
${rows}

## Shield Structural Defaults

| Part | Functional Group | Max Integrity | Default Integrity | Stop Power | Break Threshold | Disabled Visuals | Broken Visuals |
|---|---|---:|---:|---:|---:|---|---|
| ${shield.part} | ${shield.functionalGroup} | ${shield.maxIntegrity} | ${shield.defaultIntegrity} | ${shield.stopPower} | ${shield.breakThreshold} | ${(shield.disabledVisualParts ?? []).join(', ')} | ${(shield.brokenVisualParts ?? []).join(', ')} |

Generated from [schema/combat-rig-contract.humanoid.json](../schema/combat-rig-contract.humanoid.json). Do not edit generated artifacts directly.
`;
}

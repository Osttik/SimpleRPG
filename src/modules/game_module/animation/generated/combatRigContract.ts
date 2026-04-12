export const COMBAT_RIG_CONTRACT_ID = 'humanoid_base';
export const COMBAT_RIG_CONTRACT_VERSION = 1;
export const COMBAT_RIG_CONTRACT_HASH = 'f9b6381ef2d2945c';

export const BodyPart = {
  Head: 0,
  Neck: 1,
  Torso: 2,
  ChestVirtual: 3,
  BellyVirtual: 4,
  PelvisVirtual: 5,
  ShoulderL: 6,
  UpperArmL: 7,
  ForearmHandL: 8,
  ShoulderR: 9,
  UpperArmR: 10,
  ForearmHandR: 11,
  ThighL: 12,
  ShinFootL: 13,
  ThighR: 14,
  ShinFootR: 15,
  Shield: 16,
} as const;

export const BodyPartKeyById: Record<number, string> = {
  0: 'Head',
  1: 'Neck',
  2: 'Torso',
  3: 'ChestVirtual',
  4: 'BellyVirtual',
  5: 'PelvisVirtual',
  6: 'ShoulderL',
  7: 'UpperArmL',
  8: 'ForearmHandL',
  9: 'ShoulderR',
  10: 'UpperArmR',
  11: 'ForearmHandR',
  12: 'ThighL',
  13: 'ShinFootL',
  14: 'ThighR',
  15: 'ShinFootR',
  16: 'Shield',
};

export const BodyPartLabelById: Record<number, string> = {
  0: 'Head',
  1: 'Neck',
  2: 'Torso',
  3: 'Chest',
  4: 'Belly',
  5: 'Pelvis',
  6: 'Shoulder L',
  7: 'Upper Arm L',
  8: 'Forearm Hand L',
  9: 'Shoulder R',
  10: 'Upper Arm R',
  11: 'Forearm Hand R',
  12: 'Thigh L',
  13: 'Shin Foot L',
  14: 'Thigh R',
  15: 'Shin Foot R',
  16: 'Shield',
};

export const HUMANOID_COMBAT_RIG_CONTRACT = {
  "schema": "simple-rpg.combat-rig-contract.v1",
  "id": "humanoid_base",
  "version": 1,
  "hash": "f9b6381ef2d2945c",
  "units": {
    "source": "gameplay_world_units",
    "frontendScale": 1,
    "note": "Combat local coordinates are authored in gameplay world units. The frontend applies skin.scale after reading generated rig values."
  },
  "bodyParts": [
    {
      "id": 0,
      "key": "Head",
      "label": "Head",
      "layer": "outer",
      "maxHp": 32,
      "stopPower": 14
    },
    {
      "id": 1,
      "key": "Neck",
      "label": "Neck",
      "layer": "outer",
      "maxHp": 18,
      "stopPower": 10
    },
    {
      "id": 2,
      "key": "Torso",
      "label": "Torso",
      "layer": "outer",
      "maxHp": 60,
      "stopPower": 12
    },
    {
      "id": 3,
      "key": "ChestVirtual",
      "label": "Chest",
      "layer": "virtual",
      "maxHp": 54,
      "stopPower": 14
    },
    {
      "id": 4,
      "key": "BellyVirtual",
      "label": "Belly",
      "layer": "virtual",
      "maxHp": 50,
      "stopPower": 11
    },
    {
      "id": 5,
      "key": "PelvisVirtual",
      "label": "Pelvis",
      "layer": "virtual",
      "maxHp": 56,
      "stopPower": 15
    },
    {
      "id": 6,
      "key": "ShoulderL",
      "label": "Shoulder L",
      "layer": "outer",
      "maxHp": 26,
      "stopPower": 8
    },
    {
      "id": 7,
      "key": "UpperArmL",
      "label": "Upper Arm L",
      "layer": "outer",
      "maxHp": 28,
      "stopPower": 9
    },
    {
      "id": 8,
      "key": "ForearmHandL",
      "label": "Forearm Hand L",
      "layer": "outer",
      "maxHp": 24,
      "stopPower": 8
    },
    {
      "id": 9,
      "key": "ShoulderR",
      "label": "Shoulder R",
      "layer": "outer",
      "maxHp": 26,
      "stopPower": 8
    },
    {
      "id": 10,
      "key": "UpperArmR",
      "label": "Upper Arm R",
      "layer": "outer",
      "maxHp": 28,
      "stopPower": 9
    },
    {
      "id": 11,
      "key": "ForearmHandR",
      "label": "Forearm Hand R",
      "layer": "outer",
      "maxHp": 24,
      "stopPower": 8
    },
    {
      "id": 12,
      "key": "ThighL",
      "label": "Thigh L",
      "layer": "outer",
      "maxHp": 34,
      "stopPower": 11
    },
    {
      "id": 13,
      "key": "ShinFootL",
      "label": "Shin Foot L",
      "layer": "outer",
      "maxHp": 30,
      "stopPower": 9
    },
    {
      "id": 14,
      "key": "ThighR",
      "label": "Thigh R",
      "layer": "outer",
      "maxHp": 34,
      "stopPower": 11
    },
    {
      "id": 15,
      "key": "ShinFootR",
      "label": "Shin Foot R",
      "layer": "outer",
      "maxHp": 30,
      "stopPower": 9
    },
    {
      "id": 16,
      "key": "Shield",
      "label": "Shield",
      "layer": "outer",
      "maxHp": 48,
      "stopPower": 26
    }
  ],
  "hurtboxes": [
    {
      "part": "Head",
      "primitive": "circle",
      "center": [
        0,
        18
      ],
      "radius": 6,
      "partId": 0
    },
    {
      "part": "Neck",
      "primitive": "box",
      "min": [
        -3,
        10
      ],
      "max": [
        3,
        16
      ],
      "partId": 1
    },
    {
      "part": "Torso",
      "primitive": "box",
      "min": [
        -8,
        -10
      ],
      "max": [
        8,
        10
      ],
      "partId": 2
    },
    {
      "part": "ShoulderL",
      "primitive": "circle",
      "center": [
        -11,
        7
      ],
      "radius": 4,
      "partId": 6
    },
    {
      "part": "UpperArmL",
      "primitive": "box",
      "min": [
        -20,
        -1
      ],
      "max": [
        -10,
        6
      ],
      "partId": 7
    },
    {
      "part": "ForearmHandL",
      "primitive": "box",
      "min": [
        -28,
        -5
      ],
      "max": [
        -18,
        4
      ],
      "partId": 8
    },
    {
      "part": "ShoulderR",
      "primitive": "circle",
      "center": [
        11,
        7
      ],
      "radius": 4,
      "partId": 9
    },
    {
      "part": "UpperArmR",
      "primitive": "box",
      "min": [
        10,
        -1
      ],
      "max": [
        20,
        6
      ],
      "partId": 10
    },
    {
      "part": "ForearmHandR",
      "primitive": "box",
      "min": [
        18,
        -5
      ],
      "max": [
        28,
        4
      ],
      "partId": 11
    },
    {
      "part": "ThighL",
      "primitive": "box",
      "min": [
        -7,
        -22
      ],
      "max": [
        -1,
        -10
      ],
      "partId": 12
    },
    {
      "part": "ShinFootL",
      "primitive": "box",
      "min": [
        -9,
        -35
      ],
      "max": [
        -2,
        -22
      ],
      "partId": 13
    },
    {
      "part": "ThighR",
      "primitive": "box",
      "min": [
        1,
        -22
      ],
      "max": [
        7,
        -10
      ],
      "partId": 14
    },
    {
      "part": "ShinFootR",
      "primitive": "box",
      "min": [
        2,
        -35
      ],
      "max": [
        9,
        -22
      ],
      "partId": 15
    },
    {
      "part": "Shield",
      "primitive": "box",
      "min": [
        -16,
        -24
      ],
      "max": [
        16,
        24
      ],
      "partId": 16
    }
  ],
  "routing": {
    "torsoVirtualZones": [
      {
        "part": "ChestVirtual",
        "minYExclusive": 4
      },
      {
        "part": "PelvisVirtual",
        "maxYExclusive": -4
      },
      {
        "part": "BellyVirtual",
        "fallback": true
      }
    ],
    "headRegion": {
      "part": "Head",
      "center": [
        0,
        18
      ],
      "radius": 6
    }
  },
  "visual": {
    "anchors": {
      "head": {
        "part": "torso",
        "position": [
          0,
          -14
        ]
      },
      "shoulder_r": {
        "part": "torso",
        "position": [
          -8,
          -6
        ]
      },
      "hand_r_idle": {
        "part": "torso",
        "position": [
          -8,
          14
        ]
      },
      "shield_grip_l": {
        "part": "torso",
        "position": [
          10,
          2
        ]
      },
      "weapon_grip_r": {
        "part": "forearm_r",
        "position": [
          0,
          0
        ]
      }
    },
    "limbs": {
      "rightArm": {
        "shoulderAnchor": "shoulder_r",
        "upperPart": "upper_arm_r",
        "lowerPart": "forearm_r",
        "upperLength": 12,
        "lowerLength": 12,
        "bendDirection": -1
      }
    },
    "partLengths": {
      "upper_arm_r": 12,
      "forearm_r": 12
    },
    "attachments": {
      "sword": {
        "part": "forearm_r",
        "anchor": "weapon_grip_r",
        "offset": [
          0,
          0
        ],
        "rotation": 0
      },
      "shield": {
        "part": "torso",
        "anchor": "shield_grip_l",
        "offset": [
          0,
          0
        ],
        "rotation": 0
      }
    },
    "bodyPartToVisualParts": {
      "6": [
        "shield"
      ],
      "7": [
        "shield"
      ],
      "8": [
        "shield"
      ],
      "9": [
        "upper_arm_r",
        "forearm_r",
        "sword"
      ],
      "10": [
        "upper_arm_r",
        "forearm_r",
        "sword"
      ],
      "11": [
        "forearm_r",
        "sword"
      ],
      "16": [
        "shield"
      ]
    }
  },
  "functionalGroups": {
    "leftLeg": [
      12,
      13
    ],
    "rightLeg": [
      14,
      15
    ],
    "attackRequired": [
      9,
      10,
      11
    ],
    "blockRequired": [
      6,
      7,
      8,
      16
    ]
  }
} as const;

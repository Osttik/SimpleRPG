#pragma once
#include <cstdint>

// Numeric entity types for binary serialization.
// Must stay in sync with EntityType enum on the TypeScript client.
enum class EntityType : uint8_t {
    Player = 0,
    Chest  = 1,
    NPC    = 2,
    // Add new types here...
    Unknown = 255
};

#pragma once

#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

#include "core/tile-registry.h"
#include "math/number.h"

class GameObject;
class GameWorldEngine;
class WorldManager;
struct MoveComponent;

struct WorldLayerFootprintSample
{
  int32_t TileX = 0;
  int32_t TileY = 0;
  int32_t Z = 0;
  uint16_t TileId = 0;
  bool Support = false;
  bool FallThrough = true;
  bool Blocked = false;
};

struct WorldLayerConnectorCandidateDebug
{
  int32_t TileX = 0;
  int32_t TileY = 0;
  int32_t SourceZ = 0;
  int32_t DestinationZ = 0;
  TileConnectorType Type = TileConnectorType::None;
  int16_t TriggerMinX = 0;
  int16_t TriggerMinY = 0;
  int16_t TriggerMaxX = 0;
  int16_t TriggerMaxY = 0;
  uint8_t AllowedEnterDirectionMask = TileDirectionAny;
  uint8_t AllowedMovementDirectionMask = TileDirectionAny;
  bool TriggerHit = false;
  bool DirectionAllowed = false;
  bool DestinationSupportOk = false;
  bool DestinationBlockedOk = true;
  bool Selected = false;
  bool Accepted = false;
  std::string RejectionReason;
};

struct WorldLayerLandingCandidateDebug
{
  int32_t CandidateZ = 0;
  bool SupportOk = false;
  bool Blocked = false;
  bool Accepted = false;
};

struct WorldLayerDebugState
{
  uint32_t Tick = 0;
  uint32_t EntityId = 0;
  int32_t SourceZ = 0;
  int32_t ResolvedZ = 0;
  bool Transitioned = false;
  bool Fell = false;
  std::string Phase;
  std::string Reason;
  std::vector<WorldLayerFootprintSample> SupportSamples;
  std::vector<WorldLayerConnectorCandidateDebug> ConnectorCandidates;
  std::vector<WorldLayerLandingCandidateDebug> LandingCandidates;
};

struct WorldLayerValidationIssue
{
  int32_t TileX = 0;
  int32_t TileY = 0;
  int32_t TileZ = 0;
  std::string Code;
  std::string Message;
};

class WorldLayerSystem
{
public:
  void Tick(GameWorldEngine &engine);
  void SetDebugEnabled(bool enabled);
  bool IsDebugEnabled() const { return _debugEnabled; }
  const WorldLayerDebugState *GetDebugState(uint32_t entityId) const;
  std::vector<WorldLayerValidationIssue> ValidateLoadedWorld(const WorldManager &world) const;

private:
  std::unordered_map<uint32_t, uint32_t> _cooldownUntilTick;
  std::unordered_map<uint32_t, WorldLayerDebugState> _debugStates;
  bool _debugEnabled = false;

  void ResolveEntity(GameWorldEngine &engine, GameObject &entity);
  bool TryConnectorTransition(GameWorldEngine &engine, GameObject &entity, MoveComponent &move, WorldLayerDebugState *debug);
  bool TryFall(GameWorldEngine &engine, GameObject &entity, WorldLayerDebugState *debug);

  void ResetDebugState(WorldLayerDebugState &debug, const GameObject &entity, uint32_t tick) const;
  void CollectFootprintSamples(const WorldManager &world, const GameObject &entity, int32_t z,
                               std::vector<WorldLayerFootprintSample> &samples) const;
  bool IntersectsTileFootprint(const GameObject &entity, int32_t tileX, int32_t tileY) const;
  bool IntersectsTriggerBounds(const GameObject &entity, int32_t tileX, int32_t tileY, const TileConnectorDef &connector) const;
  bool IsDirectionAllowed(uint8_t movementMask, const TileConnectorDef &connector) const;
  bool IsDestinationValid(GameWorldEngine &engine, const GameObject &entity, int32_t destinationZ,
                          const TileConnectorDef &connector,
                          std::vector<WorldLayerFootprintSample> *samples = nullptr) const;
  bool HasSupportAt(const WorldManager &world, const GameObject &entity, int32_t z,
                    std::vector<WorldLayerFootprintSample> *samples = nullptr) const;
  bool AllowsFallThroughAt(const WorldManager &world, const GameObject &entity, int32_t z,
                           std::vector<WorldLayerFootprintSample> *samples = nullptr) const;
  bool IsBlockedAt(const WorldManager &world, const GameObject &entity, int32_t z,
                   std::vector<WorldLayerFootprintSample> *samples = nullptr) const;
  int32_t GetEntityTileX(const GameObject &entity) const;
  int32_t GetEntityTileY(const GameObject &entity) const;
  uint8_t GetMovementMask(float32 dx, float32 dy) const;
};

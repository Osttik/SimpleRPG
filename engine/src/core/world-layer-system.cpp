#include "core/world-layer-system.h"

#include <algorithm>
#include <cstdint>
#include <vector>

#include "core/constants.h"
#include "core/components/move-component.h"
#include "core/game-object/game-object.h"
#include "core/game-world-engine.h"
#include "core/world.h"
#include "math/aabb.h"
#include "math/rect.h"

namespace
{
constexpr int32_t MAX_FALL_SEARCH_LAYERS = 16;
constexpr int32_t TILE_SIZE_PIXELS = 40;

int32_t FloorFixedByTileSize(float32 value)
{
  const int64_t raw = static_cast<int64_t>(value.raw_value());
  const int64_t divisor = static_cast<int64_t>(TILE_SIZE.raw_value());
  int64_t quotient = raw / divisor;
  const int64_t remainder = raw % divisor;
  if (remainder != 0 && raw < 0)
    --quotient;
  return static_cast<int32_t>(quotient);
}

int32_t FloorFixedByTileSizeExclusive(float32 value)
{
  const int32_t raw = value.raw_value();
  return FloorFixedByTileSize(float32::from_raw_value(raw > INT32_MIN ? raw - 1 : raw));
}

aabb::AABB BuildAabb(const Shape &shape)
{
  Point topLeft = shape.GetCornerPoint(CornerType::TopLeft);
  Point bottomRight = shape.GetCornerPoint(CornerType::BottomRight);

  std::vector<float32> lower = {
      (std::min)(topLeft.X, bottomRight.X),
      (std::min)(topLeft.Y, bottomRight.Y)};
  std::vector<float32> upper = {
      (std::max)(topLeft.X, bottomRight.X),
      (std::max)(topLeft.Y, bottomRight.Y)};
  return aabb::AABB(lower, upper);
}

bool ShouldRefreshSamples(const std::vector<WorldLayerFootprintSample> *samples, int32_t z)
{
  return !samples || samples->empty() || samples->front().Z != z;
}
}

void WorldLayerSystem::Tick(GameWorldEngine &engine)
{
  for (auto &[id, entity] : engine.ObjectManager.GetEntities())
  {
    if (!entity || entity->IsPendingDestruction || entity->IsStaticProp)
      continue;

    ResolveEntity(engine, *entity);
  }

  for (auto it = _cooldownUntilTick.begin(); it != _cooldownUntilTick.end();)
  {
    if (!engine.ObjectManager.GetById(it->first))
      it = _cooldownUntilTick.erase(it);
    else
      ++it;
  }

  for (auto it = _debugStates.begin(); it != _debugStates.end();)
  {
    if (!_debugEnabled || !engine.ObjectManager.GetById(it->first))
      it = _debugStates.erase(it);
    else
      ++it;
  }
}

void WorldLayerSystem::SetDebugEnabled(bool enabled)
{
  _debugEnabled = enabled;
  if (!_debugEnabled)
    _debugStates.clear();
}

const WorldLayerDebugState *WorldLayerSystem::GetDebugState(uint32_t entityId) const
{
  auto it = _debugStates.find(entityId);
  return it == _debugStates.end() ? nullptr : &it->second;
}

void WorldLayerSystem::ResolveEntity(GameWorldEngine &engine, GameObject &entity)
{
  auto *moveMgr = engine.Ctx.GetManager<MoveComponentManager>();
  auto *move = moveMgr ? moveMgr->Get(entity.Id) : nullptr;

  WorldLayerDebugState *debug = nullptr;
  if (_debugEnabled)
  {
    debug = &_debugStates[entity.Id];
    ResetDebugState(*debug, entity, engine.TickCount);
  }

  bool transitioned = false;
  if (move)
  {
    transitioned = TryConnectorTransition(engine, entity, *move, debug);
    move->LastInputX = float32(0);
    move->LastInputY = float32(0);
  }

  if (!transitioned)
  {
    TryFall(engine, entity, debug);
  }
  else if (debug)
  {
    debug->ResolvedZ = entity.Transform.Position().Z;
  }
}

bool WorldLayerSystem::TryConnectorTransition(GameWorldEngine &engine, GameObject &entity, MoveComponent &move,
                                              WorldLayerDebugState *debug)
{
  auto cooldownIt = _cooldownUntilTick.find(entity.Id);
  if (cooldownIt != _cooldownUntilTick.end() && cooldownIt->second > engine.TickCount)
  {
    if (debug && debug->Reason.empty())
    {
      debug->Phase = "connector";
      debug->Reason = "cooldown_active";
    }
    return false;
  }

  const uint8_t movementMask = GetMovementMask(move.LastInputX, move.LastInputY);
  if (movementMask == 0)
    return false;

  std::vector<WorldLayerFootprintSample> footprintSamples;
  const int32_t currentZ = entity.Transform.Position().Z;
  CollectFootprintSamples(*engine.World.ChunkManager, entity, currentZ, footprintSamples);

  if (debug)
    debug->SupportSamples = footprintSamples;

  for (const auto &sample : footprintSamples)
  {
    const TileConnectorDef *connector = TileRegistry::GetTileConnector(sample.TileId);
    if (!connector || !connector->AutoTrigger || connector->DeltaZ == 0)
      continue;

    WorldLayerConnectorCandidateDebug candidate;
    candidate.TileX = sample.TileX;
    candidate.TileY = sample.TileY;
    candidate.SourceZ = currentZ;
    candidate.DestinationZ = currentZ + connector->DeltaZ;
    candidate.Type = connector->Type;
    candidate.TriggerMinX = connector->TriggerMinX;
    candidate.TriggerMinY = connector->TriggerMinY;
    candidate.TriggerMaxX = connector->TriggerMaxX;
    candidate.TriggerMaxY = connector->TriggerMaxY;
    candidate.AllowedEnterDirectionMask = connector->AllowedEnterDirectionMask;
    candidate.AllowedMovementDirectionMask = connector->AllowedMovementDirectionMask;
    candidate.TriggerHit = IntersectsTriggerBounds(entity, sample.TileX, sample.TileY, *connector);
    if (!candidate.TriggerHit)
    {
      candidate.RejectionReason = "trigger_miss";
      if (debug)
        debug->ConnectorCandidates.push_back(candidate);
      continue;
    }

    candidate.DirectionAllowed = IsDirectionAllowed(movementMask, *connector);
    if (!candidate.DirectionAllowed)
    {
      candidate.RejectionReason = "direction_mismatch";
      if (debug)
        debug->ConnectorCandidates.push_back(candidate);
      continue;
    }

    std::vector<WorldLayerFootprintSample> destinationSamples;
    candidate.DestinationSupportOk = !connector->RequireDestinationSupport ||
                                     HasSupportAt(*engine.World.ChunkManager, entity, candidate.DestinationZ, &destinationSamples);
    candidate.DestinationBlockedOk = !connector->RequireDestinationNotBlocked ||
                                     !IsBlockedAt(*engine.World.ChunkManager, entity, candidate.DestinationZ, &destinationSamples);

    if (!candidate.DestinationSupportOk)
    {
      candidate.RejectionReason = "destination_missing_support";
      if (debug)
        debug->ConnectorCandidates.push_back(candidate);
      continue;
    }

    if (!candidate.DestinationBlockedOk)
    {
      candidate.RejectionReason = "destination_blocked";
      if (debug)
        debug->ConnectorCandidates.push_back(candidate);
      continue;
    }

    entity.Transform.SetZPosition(candidate.DestinationZ);
    _cooldownUntilTick[entity.Id] = engine.TickCount + connector->CooldownTicks;

    if (debug)
    {
      candidate.Selected = true;
      candidate.Accepted = true;
      debug->ConnectorCandidates.push_back(candidate);
      debug->Transitioned = true;
      debug->Fell = false;
      debug->Phase = "connector";
      debug->Reason = "connector_accepted";
      debug->ResolvedZ = candidate.DestinationZ;
    }
    return true;
  }

  if (debug && debug->Reason.empty() && !debug->ConnectorCandidates.empty())
  {
    debug->Phase = "connector";
    debug->Reason = debug->ConnectorCandidates.front().RejectionReason.empty()
                        ? "connector_rejected"
                        : debug->ConnectorCandidates.front().RejectionReason;
  }

  return false;
}

bool WorldLayerSystem::TryFall(GameWorldEngine &engine, GameObject &entity, WorldLayerDebugState *debug)
{
  std::vector<WorldLayerFootprintSample> currentSamples;
  const int32_t currentZ = entity.Transform.Position().Z;
  const bool supported = HasSupportAt(*engine.World.ChunkManager, entity, currentZ, &currentSamples);

  if (debug && debug->SupportSamples.empty())
    debug->SupportSamples = currentSamples;

  if (supported)
  {
    if (debug && debug->Reason.empty())
    {
      debug->Phase = "steady";
      debug->Reason = "stable_supported";
      debug->ResolvedZ = currentZ;
    }
    return false;
  }

  if (!AllowsFallThroughAt(*engine.World.ChunkManager, entity, currentZ, &currentSamples))
  {
    if (debug)
    {
      debug->Phase = "fall";
      debug->Reason = "current_layer_disallows_fall";
      debug->ResolvedZ = currentZ;
    }
    return false;
  }

  TileConnectorDef fallRules;
  fallRules.RequireDestinationNotBlocked = true;
  fallRules.RequireDestinationSupport = true;

  for (int32_t dz = 1; dz <= MAX_FALL_SEARCH_LAYERS; ++dz)
  {
    const int32_t candidateZ = currentZ - dz;
    std::vector<WorldLayerFootprintSample> candidateSamples;
    const bool supportOk = HasSupportAt(*engine.World.ChunkManager, entity, candidateZ, &candidateSamples);
    const bool blocked = supportOk && IsBlockedAt(*engine.World.ChunkManager, entity, candidateZ, &candidateSamples);

    if (debug)
    {
      WorldLayerLandingCandidateDebug landing;
      landing.CandidateZ = candidateZ;
      landing.SupportOk = supportOk;
      landing.Blocked = blocked;
      landing.Accepted = supportOk && !blocked;
      debug->LandingCandidates.push_back(landing);
    }

    if (!supportOk || blocked)
      continue;

    entity.Transform.SetZPosition(candidateZ);
    if (debug)
    {
      debug->Transitioned = false;
      debug->Fell = true;
      debug->Phase = "fall";
      debug->Reason = "fall_landed";
      debug->ResolvedZ = candidateZ;
    }
    return true;
  }

  if (debug)
  {
    debug->Phase = "fall";
    debug->Reason = "no_landing_within_search";
    debug->ResolvedZ = currentZ;
  }
  return false;
}

void WorldLayerSystem::ResetDebugState(WorldLayerDebugState &debug, const GameObject &entity, uint32_t tick) const
{
  debug.Tick = tick;
  debug.EntityId = entity.Id;
  debug.SourceZ = entity.Transform.Position().Z;
  debug.ResolvedZ = entity.Transform.Position().Z;
  debug.Transitioned = false;
  debug.Fell = false;
  debug.Phase.clear();
  debug.Reason.clear();
  debug.SupportSamples.clear();
  debug.ConnectorCandidates.clear();
  debug.LandingCandidates.clear();
}

void WorldLayerSystem::CollectFootprintSamples(const WorldManager &world, const GameObject &entity, int32_t z,
                                               std::vector<WorldLayerFootprintSample> &samples) const
{
  samples.clear();

  const aabb::AABB box = BuildAabb(*entity.BoundingBox);
  int32_t minX = FloorFixedByTileSize(box.lowerBound[0]);
  int32_t minY = FloorFixedByTileSize(box.lowerBound[1]);
  int32_t maxX = FloorFixedByTileSizeExclusive(box.upperBound[0]);
  int32_t maxY = FloorFixedByTileSizeExclusive(box.upperBound[1]);

  if (maxX < minX)
    maxX = minX;
  if (maxY < minY)
    maxY = minY;

  for (int32_t tileY = minY; tileY <= maxY; ++tileY)
  {
    for (int32_t tileX = minX; tileX <= maxX; ++tileX)
    {
      if (!IntersectsTileFootprint(entity, tileX, tileY))
        continue;

      WorldLayerFootprintSample sample;
      sample.TileX = tileX;
      sample.TileY = tileY;
      sample.Z = z;
      sample.TileId = world.GetTileAt(tileX, tileY, z);
      sample.Support = TileRegistry::GetTileSupport(sample.TileId);
      sample.FallThrough = TileRegistry::GetTileFallThrough(sample.TileId);
      sample.Blocked = TileRegistry::GetTileCollide(sample.TileId);
      samples.push_back(sample);
    }
  }
}

bool WorldLayerSystem::IntersectsTileFootprint(const GameObject &entity, int32_t tileX, int32_t tileY) const
{
  const float32 tileLeft = float32(tileX) * TILE_SIZE;
  const float32 tileTop = float32(tileY) * TILE_SIZE;
  const float32 tileRight = tileLeft + TILE_SIZE;
  const float32 tileBottom = tileTop + TILE_SIZE;

  if (entity.BoundingBox->Type == ShapeType::Circle)
  {
    const auto *circle = static_cast<const Circle *>(entity.BoundingBox.get());
    const float32 closestX = (std::max)(tileLeft, (std::min)(circle->Center.X, tileRight));
    const float32 closestY = (std::max)(tileTop, (std::min)(circle->Center.Y, tileBottom));
    const float32 dx = circle->Center.X - closestX;
    const float32 dy = circle->Center.Y - closestY;
    return (dx * dx) + (dy * dy) <= (circle->Radius * circle->Radius);
  }

  const aabb::AABB box = BuildAabb(*entity.BoundingBox);
  return !(box.upperBound[0] <= tileLeft || box.lowerBound[0] >= tileRight ||
           box.upperBound[1] <= tileTop || box.lowerBound[1] >= tileBottom);
}

bool WorldLayerSystem::IntersectsTriggerBounds(const GameObject &entity, int32_t tileX, int32_t tileY,
                                               const TileConnectorDef &connector) const
{
  const float32 tileLeft = float32(tileX) * TILE_SIZE;
  const float32 tileTop = float32(tileY) * TILE_SIZE;
  const float32 minX = tileLeft + float32(connector.TriggerMinX);
  const float32 minY = tileTop + float32(connector.TriggerMinY);
  const float32 maxX = tileLeft + float32(connector.TriggerMaxX);
  const float32 maxY = tileTop + float32(connector.TriggerMaxY);

  if (entity.BoundingBox->Type == ShapeType::Circle)
  {
    const auto *circle = static_cast<const Circle *>(entity.BoundingBox.get());
    const float32 closestX = (std::max)(minX, (std::min)(circle->Center.X, maxX));
    const float32 closestY = (std::max)(minY, (std::min)(circle->Center.Y, maxY));
    const float32 dx = circle->Center.X - closestX;
    const float32 dy = circle->Center.Y - closestY;
    return (dx * dx) + (dy * dy) <= (circle->Radius * circle->Radius);
  }

  const aabb::AABB box = BuildAabb(*entity.BoundingBox);
  return !(box.upperBound[0] < minX || box.lowerBound[0] > maxX ||
           box.upperBound[1] < minY || box.lowerBound[1] > maxY);
}

bool WorldLayerSystem::IsDirectionAllowed(uint8_t movementMask, const TileConnectorDef &connector) const
{
  if ((movementMask & connector.AllowedMovementDirectionMask) == 0)
    return false;
  return (movementMask & connector.AllowedEnterDirectionMask) != 0;
}

bool WorldLayerSystem::IsDestinationValid(GameWorldEngine &engine, const GameObject &entity, int32_t destinationZ,
                                          const TileConnectorDef &connector,
                                          std::vector<WorldLayerFootprintSample> *samples) const
{
  if (connector.RequireDestinationSupport &&
      !HasSupportAt(*engine.World.ChunkManager, entity, destinationZ, samples))
    return false;

  if (connector.RequireDestinationNotBlocked &&
      IsBlockedAt(*engine.World.ChunkManager, entity, destinationZ, samples))
    return false;

  return true;
}

bool WorldLayerSystem::HasSupportAt(const WorldManager &world, const GameObject &entity, int32_t z,
                                    std::vector<WorldLayerFootprintSample> *samples) const
{
  std::vector<WorldLayerFootprintSample> localSamples;
  auto &resolvedSamples = samples ? *samples : localSamples;
  if (ShouldRefreshSamples(samples, z))
    CollectFootprintSamples(world, entity, z, resolvedSamples);

  if (resolvedSamples.empty())
    return false;

  for (const auto &sample : resolvedSamples)
  {
    if (!sample.Support)
      return false;
  }
  return true;
}

bool WorldLayerSystem::AllowsFallThroughAt(const WorldManager &world, const GameObject &entity, int32_t z,
                                           std::vector<WorldLayerFootprintSample> *samples) const
{
  std::vector<WorldLayerFootprintSample> localSamples;
  auto &resolvedSamples = samples ? *samples : localSamples;
  if (ShouldRefreshSamples(samples, z))
    CollectFootprintSamples(world, entity, z, resolvedSamples);

  if (resolvedSamples.empty())
    return true;

  for (const auto &sample : resolvedSamples)
  {
    if (!sample.Support && !sample.FallThrough)
      return false;
  }
  return true;
}

bool WorldLayerSystem::IsBlockedAt(const WorldManager &world, const GameObject &entity, int32_t z,
                                   std::vector<WorldLayerFootprintSample> *samples) const
{
  std::vector<WorldLayerFootprintSample> localSamples;
  auto &resolvedSamples = samples ? *samples : localSamples;
  if (ShouldRefreshSamples(samples, z))
    CollectFootprintSamples(world, entity, z, resolvedSamples);

  for (const auto &sample : resolvedSamples)
  {
    if (sample.Blocked)
      return true;
  }
  return false;
}

int32_t WorldLayerSystem::GetEntityTileX(const GameObject &entity) const
{
  return FloorFixedByTileSize(entity.Transform.Position().X);
}

int32_t WorldLayerSystem::GetEntityTileY(const GameObject &entity) const
{
  return FloorFixedByTileSize(entity.Transform.Position().Y);
}

uint8_t WorldLayerSystem::GetMovementMask(float32 dx, float32 dy) const
{
  uint8_t mask = 0;
  if (dy < float32(0))
    mask |= TileDirectionNorth;
  if (dy > float32(0))
    mask |= TileDirectionSouth;
  if (dx < float32(0))
    mask |= TileDirectionWest;
  if (dx > float32(0))
    mask |= TileDirectionEast;
  return mask;
}

std::vector<WorldLayerValidationIssue> WorldLayerSystem::ValidateLoadedWorld(const WorldManager &world) const
{
  std::vector<WorldLayerValidationIssue> issues;
  const auto loadedChunks = world.GetLoadedChunkCoords();

  for (const auto &[cx, cy, cz] : loadedChunks)
  {
    for (int32_t localZ = 0; localZ < CHUNK_SIZE; ++localZ)
    {
      for (int32_t localY = 0; localY < CHUNK_SIZE; ++localY)
      {
        for (int32_t localX = 0; localX < CHUNK_SIZE; ++localX)
        {
          const int32_t worldX = cx * CHUNK_SIZE + localX;
          const int32_t worldY = cy * CHUNK_SIZE + localY;
          const int32_t worldZ = cz * CHUNK_SIZE + localZ;
          const uint16_t tileId = world.GetTileAt(worldX, worldY, worldZ);
          const TileConnectorDef *connector = TileRegistry::GetTileConnector(tileId);
          if (!connector)
            continue;

          auto addIssue = [&](const std::string &code, const std::string &message) {
            WorldLayerValidationIssue issue;
            issue.TileX = worldX;
            issue.TileY = worldY;
            issue.TileZ = worldZ;
            issue.Code = code;
            issue.Message = message;
            issues.push_back(issue);
          };

          if (connector->DeltaZ == 0)
            addIssue("connector_zero_delta", "Connector deltaZ must not be 0.");

          if (connector->AllowedEnterDirectionMask == 0 || connector->AllowedMovementDirectionMask == 0)
            addIssue("connector_empty_direction_mask", "Connector direction masks must not be empty.");

          if (connector->TriggerMinX < 0 || connector->TriggerMinY < 0 ||
              connector->TriggerMaxX > TILE_SIZE_PIXELS || connector->TriggerMaxY > TILE_SIZE_PIXELS ||
              connector->TriggerMinX >= connector->TriggerMaxX || connector->TriggerMinY >= connector->TriggerMaxY)
          {
            addIssue("connector_invalid_trigger_bounds", "Connector trigger bounds must stay inside the tile and keep min < max.");
          }

          if (connector->OneWay && connector->Bidirectional)
            addIssue("connector_conflicting_directionality", "Connector cannot be both oneWay and bidirectional.");

          const int32_t destinationZ = worldZ + connector->DeltaZ;
          const uint16_t destinationTileId = world.GetTileAt(worldX, worldY, destinationZ);

          if (connector->RequireDestinationSupport && !TileRegistry::GetTileSupport(destinationTileId))
          {
            addIssue("connector_destination_missing_support", "Destination tile is missing support for this connector.");
          }

          if (connector->RequireDestinationNotBlocked && TileRegistry::GetTileCollide(destinationTileId))
          {
            addIssue("connector_destination_blocked", "Destination tile is blocked for this connector.");
          }

          if (connector->Bidirectional)
          {
            const TileConnectorDef *reverse = TileRegistry::GetTileConnector(destinationTileId);
            if (!reverse)
            {
              addIssue("connector_missing_reverse", "Bidirectional connector is missing a reverse connector at the destination tile.");
            }
            else
            {
              if (reverse->DeltaZ != -connector->DeltaZ)
                addIssue("connector_reverse_delta_mismatch", "Reverse connector deltaZ does not mirror the source connector.");
              if (reverse->Type != connector->Type)
                addIssue("connector_reverse_type_mismatch", "Reverse connector type does not match the source connector.");
            }
          }

          if (connector->Type == TileConnectorType::Drop)
          {
            bool foundLanding = false;
            for (int32_t dz = 1; dz <= MAX_FALL_SEARCH_LAYERS; ++dz)
            {
              const int32_t candidateZ = worldZ - dz;
              const uint16_t candidateTileId = world.GetTileAt(worldX, worldY, candidateZ);
              if (!TileRegistry::GetTileSupport(candidateTileId))
                continue;
              if (TileRegistry::GetTileCollide(candidateTileId))
                continue;
              foundLanding = true;
              break;
            }

            if (!foundLanding)
            {
              addIssue("connector_drop_no_landing", "Drop connector has no supported, unblocked landing tile within the fall search limit.");
            }
          }
        }
      }
    }
  }

  return issues;
}

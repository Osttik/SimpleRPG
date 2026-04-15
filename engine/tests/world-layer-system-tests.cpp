#include <algorithm>
#include <functional>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

#include "core/game-world-engine.h"
#include "core/world-layer-system.h"
#include "core/components/move-component.h"

namespace
{
constexpr uint16_t TILE_AIR = 0;
constexpr uint16_t TILE_FLOOR = 1;
constexpr uint16_t TILE_WALL = 2;
constexpr uint16_t TILE_LADDER_UP = 4;
constexpr uint16_t TILE_LADDER_DOWN = 5;
constexpr uint16_t TILE_BLOCKED_SUPPORT = 11;
constexpr uint16_t TILE_BIDIR_UP = 12;

TileGameplayDef MakeFloor()
{
  TileGameplayDef def;
  def.Support = true;
  def.FallThrough = false;
  return def;
}

TileGameplayDef MakeWall()
{
  TileGameplayDef def;
  def.Collide = true;
  def.Support = false;
  def.FallThrough = false;
  def.Occludes = true;
  return def;
}

TileGameplayDef MakeBlockedSupport()
{
  TileGameplayDef def;
  def.Collide = true;
  def.Support = true;
  def.FallThrough = false;
  def.Occludes = true;
  return def;
}

TileGameplayDef MakeLadder(int deltaZ, uint8_t movementMask, bool bidirectional = false)
{
  TileGameplayDef def = MakeFloor();
  def.Connector.Type = TileConnectorType::Ladder;
  def.Connector.DeltaZ = static_cast<int8_t>(deltaZ);
  def.Connector.AllowedEnterDirectionMask = TileDirectionAny;
  def.Connector.AllowedMovementDirectionMask = movementMask;
  def.Connector.AutoTrigger = true;
  def.Connector.RequireDestinationSupport = true;
  def.Connector.RequireDestinationNotBlocked = true;
  def.Connector.TriggerMinX = 14;
  def.Connector.TriggerMinY = deltaZ > 0 ? 8 : 14;
  def.Connector.TriggerMaxX = 26;
  def.Connector.TriggerMaxY = deltaZ > 0 ? 26 : 32;
  def.Connector.CooldownTicks = 3;
  def.Connector.Bidirectional = bidirectional;
  return def;
}

void RegisterTiles(GameWorldEngine &engine)
{
  std::vector<TileDef> registry = {
      {TILE_FLOOR, "floor", MakeFloor()},
      {TILE_WALL, "wall", MakeWall()},
      {TILE_LADDER_UP, "ladder_up", MakeLadder(1, TileDirectionNorth)},
      {TILE_LADDER_DOWN, "ladder_down", MakeLadder(-1, TileDirectionSouth)},
      {TILE_BLOCKED_SUPPORT, "blocked_support", MakeBlockedSupport()},
      {TILE_BIDIR_UP, "bidir_up", MakeLadder(1, TileDirectionNorth, true)},
  };
  engine.SetTileRegistry(registry);
  engine.Layers.SetDebugEnabled(true);
}

void SetupEngine(GameWorldEngine &engine)
{
  RegisterTiles(engine);
}

void ClearArea(GameWorldEngine &engine, int minX, int maxX, int minY, int maxY, int minZ, int maxZ)
{
  for (int z = minZ; z <= maxZ; ++z)
  {
    for (int y = minY; y <= maxY; ++y)
    {
      for (int x = minX; x <= maxX; ++x)
      {
        engine.World.ChunkManager->SetTileAt(x, y, z, TILE_AIR);
      }
    }
  }
}

void FillRect(GameWorldEngine &engine, int minX, int maxX, int minY, int maxY, int z, uint16_t tileId)
{
  for (int y = minY; y <= maxY; ++y)
  {
    for (int x = minX; x <= maxX; ++x)
    {
      engine.World.ChunkManager->SetTileAt(x, y, z, tileId);
    }
  }
}

uint32_t SpawnPlayer(GameWorldEngine &engine, int x, int y, int z)
{
  return engine.Players.AddPlayer(engine, Point(float32(x), float32(y), z));
}

void MoveAndTick(GameWorldEngine &engine, uint32_t entityId, int dx, int dy)
{
  auto *moveMgr = engine.Ctx.GetManager<MoveComponentManager>();
  if (!moveMgr)
    throw std::runtime_error("MoveComponentManager missing");

  moveMgr->Move(entityId, float32(dx), float32(dy));
  engine.Tick();
}

void TickWithoutInput(GameWorldEngine &engine)
{
  engine.Tick();
}

const WorldLayerDebugState &RequireDebug(GameWorldEngine &engine, uint32_t entityId)
{
  const WorldLayerDebugState *debug = engine.Layers.GetDebugState(entityId);
  if (!debug)
    throw std::runtime_error("Missing world-layer debug state");
  return *debug;
}

void Require(bool condition, const std::string &message)
{
  if (!condition)
    throw std::runtime_error(message);
}

void TestFootprintOverhangFalls()
{
  GameWorldEngine engine;
  SetupEngine(engine);
  ClearArea(engine, 0, 2, 0, 0, 0, 1);
  engine.World.ChunkManager->SetTileAt(0, 0, 1, TILE_FLOOR);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_FLOOR);
  engine.World.ChunkManager->SetTileAt(1, 0, 0, TILE_FLOOR);

  const uint32_t playerId = SpawnPlayer(engine, 39, 20, 1);
  TickWithoutInput(engine);

  auto *player = engine.ObjectManager.GetById(playerId);
  Require(player && player->Transform.Position().Z == 0, "Expected wider footprint overhang to fall to the lower supported layer.");
  const auto &debug = RequireDebug(engine, playerId);
  Require(debug.Reason == "fall_landed", "Expected fall debug reason to report a landed fall.");
}

void TestConnectorBlockedDestination()
{
  GameWorldEngine engine;
  SetupEngine(engine);
  ClearArea(engine, 0, 1, -1, 0, 0, 1);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_LADDER_UP);
  engine.World.ChunkManager->SetTileAt(0, -1, 0, TILE_FLOOR);
  engine.World.ChunkManager->SetTileAt(1, 0, 0, TILE_FLOOR);
  engine.World.ChunkManager->SetTileAt(1, -1, 0, TILE_FLOOR);
  FillRect(engine, 0, 0, -1, 0, 1, TILE_FLOOR);
  FillRect(engine, 1, 1, -1, 0, 1, TILE_BLOCKED_SUPPORT);

  const uint32_t playerId = SpawnPlayer(engine, 39, 20, 0);
  MoveAndTick(engine, playerId, 0, -1);

  auto *player = engine.ObjectManager.GetById(playerId);
  Require(player && player->Transform.Position().Z == 0, "Blocked connector destination should reject the transition.");
  const auto &debug = RequireDebug(engine, playerId);
  Require(!debug.ConnectorCandidates.empty() && debug.ConnectorCandidates.front().RejectionReason == "destination_blocked",
          "Expected connector debug to report a blocked destination.");
}

void TestConnectorMissingSupport()
{
  GameWorldEngine engine;
  SetupEngine(engine);
  ClearArea(engine, 0, 0, -1, 0, 0, 1);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_LADDER_UP);
  engine.World.ChunkManager->SetTileAt(0, -1, 0, TILE_FLOOR);

  const uint32_t playerId = SpawnPlayer(engine, 20, 20, 0);
  MoveAndTick(engine, playerId, 0, -1);

  auto *player = engine.ObjectManager.GetById(playerId);
  Require(player && player->Transform.Position().Z == 0, "Unsupported connector destination should not transition.");
  const auto &debug = RequireDebug(engine, playerId);
  Require(!debug.ConnectorCandidates.empty() && debug.ConnectorCandidates.front().RejectionReason == "destination_missing_support",
          "Expected connector debug to report missing destination support.");
}

void TestFallSearchLimit()
{
  GameWorldEngine engine;
  SetupEngine(engine);
  ClearArea(engine, 0, 0, 0, 0, 0, 20);
  engine.World.ChunkManager->SetTileAt(0, 0, 3, TILE_FLOOR);

  const uint32_t playerId = SpawnPlayer(engine, 20, 20, 20);
  TickWithoutInput(engine);

  auto *player = engine.ObjectManager.GetById(playerId);
  Require(player && player->Transform.Position().Z == 20, "Entity should stay on its layer when no landing exists within the fall search limit.");
  const auto &debug = RequireDebug(engine, playerId);
  Require(debug.Reason == "no_landing_within_search", "Expected fall debug to report that no landing was found.");
}

void TestConnectorDirectionMask()
{
  GameWorldEngine engine;
  SetupEngine(engine);
  ClearArea(engine, 0, 0, -1, 0, 0, 1);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_LADDER_UP);
  engine.World.ChunkManager->SetTileAt(0, -1, 0, TILE_FLOOR);
  FillRect(engine, 0, 0, -1, 0, 1, TILE_FLOOR);

  const uint32_t playerId = SpawnPlayer(engine, 20, 20, 0);
  MoveAndTick(engine, playerId, 1, 0);

  auto *player = engine.ObjectManager.GetById(playerId);
  Require(player && player->Transform.Position().Z == 0, "Direction mask mismatch should reject connector travel.");
  const auto &debug = RequireDebug(engine, playerId);
  Require(!debug.ConnectorCandidates.empty() && debug.ConnectorCandidates.front().RejectionReason == "direction_mismatch",
          "Expected direction mismatch in connector debug.");
}

void TestTriggerBoundsEdgeUsesFootprint()
{
  GameWorldEngine engine;
  SetupEngine(engine);
  ClearArea(engine, 0, 1, -1, 0, 0, 1);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_LADDER_UP);
  engine.World.ChunkManager->SetTileAt(0, -1, 0, TILE_FLOOR);
  engine.World.ChunkManager->SetTileAt(1, 0, 0, TILE_FLOOR);
  engine.World.ChunkManager->SetTileAt(1, -1, 0, TILE_FLOOR);
  FillRect(engine, 0, 1, -1, 0, 1, TILE_FLOOR);

  const uint32_t playerId = SpawnPlayer(engine, 32, 20, 0);
  MoveAndTick(engine, playerId, 0, -1);

  auto *player = engine.ObjectManager.GetById(playerId);
  Require(player && player->Transform.Position().Z == 1, "Footprint overlap with trigger bounds should allow connector activation even when the center is outside the trigger rect.");
}

void TestAntiBounceCooldown()
{
  GameWorldEngine engine;
  SetupEngine(engine);
  ClearArea(engine, 0, 0, -1, 0, 0, 1);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_LADDER_UP);
  engine.World.ChunkManager->SetTileAt(0, -1, 0, TILE_FLOOR);
  engine.World.ChunkManager->SetTileAt(0, 0, 1, TILE_LADDER_DOWN);
  engine.World.ChunkManager->SetTileAt(0, -1, 1, TILE_FLOOR);

  const uint32_t playerId = SpawnPlayer(engine, 20, 20, 0);
  MoveAndTick(engine, playerId, 0, -1);
  MoveAndTick(engine, playerId, 0, 1);

  auto *player = engine.ObjectManager.GetById(playerId);
  Require(player && player->Transform.Position().Z == 1, "Cooldown should prevent an immediate connector bounce back to the previous layer.");
  const auto &debug = RequireDebug(engine, playerId);
  Require(debug.Reason == "cooldown_active", "Expected cooldown_active debug reason after the blocked reverse travel.");
}

void TestFallLandingCandidateSelection()
{
  GameWorldEngine engine;
  SetupEngine(engine);
  ClearArea(engine, 0, 1, 0, 0, 1, 3);
  engine.World.ChunkManager->SetTileAt(0, 0, 2, TILE_FLOOR);
  engine.World.ChunkManager->SetTileAt(1, 0, 2, TILE_BLOCKED_SUPPORT);
  engine.World.ChunkManager->SetTileAt(0, 0, 1, TILE_FLOOR);
  engine.World.ChunkManager->SetTileAt(1, 0, 1, TILE_FLOOR);

  const uint32_t playerId = SpawnPlayer(engine, 39, 20, 3);
  TickWithoutInput(engine);

  auto *player = engine.ObjectManager.GetById(playerId);
  Require(player && player->Transform.Position().Z == 1, "Fall search should skip blocked landing candidates and choose the next valid supported layer.");
  const auto &debug = RequireDebug(engine, playerId);
  Require(debug.LandingCandidates.size() >= 2 && !debug.LandingCandidates[0].Accepted && debug.LandingCandidates[1].Accepted,
          "Expected debug landing candidates to show the blocked candidate followed by the accepted landing.");
}

void TestBidirectionalValidation()
{
  GameWorldEngine engine;
  SetupEngine(engine);
  ClearArea(engine, 0, 0, 0, 0, 0, 1);
  engine.World.ChunkManager->SetTileAt(0, 0, 0, TILE_BIDIR_UP);
  engine.World.ChunkManager->GetChunk(0, 0, 0);
  engine.World.ChunkManager->GetChunk(0, 0, 1);

  const auto issues = engine.Layers.ValidateLoadedWorld(*engine.World.ChunkManager);
  const bool hasReverseIssue = std::any_of(issues.begin(), issues.end(), [](const WorldLayerValidationIssue &issue) {
    return issue.Code == "connector_missing_reverse";
  });
  Require(hasReverseIssue, "Bidirectional connector validation should report a missing reverse connector.");
}

void Run(const std::string &name, const std::function<void()> &fn)
{
  fn();
  std::cout << "[PASS] " << name << '\n';
}
}

int main()
{
  try
  {
    Run("footprint overhang falls", TestFootprintOverhangFalls);
    Run("connector blocked destination", TestConnectorBlockedDestination);
    Run("connector missing support", TestConnectorMissingSupport);
    Run("fall search limit", TestFallSearchLimit);
    Run("connector direction mask", TestConnectorDirectionMask);
    Run("trigger bounds edge uses footprint", TestTriggerBoundsEdgeUsesFootprint);
    Run("anti-bounce cooldown", TestAntiBounceCooldown);
    Run("fall landing candidate selection", TestFallLandingCandidateSelection);
    Run("bidirectional validation", TestBidirectionalValidation);
    return 0;
  }
  catch (const std::exception &ex)
  {
    std::cerr << "[FAIL] " << ex.what() << '\n';
    return 1;
  }
}

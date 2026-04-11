#pragma once
#include <stdint.h>
#include "core/game-world-engine.h"
#include "core/components/active-attack-component.h"
#include "core/components/combat-body-component.h"
#include "core/components/combat-state-component.h"
#include "core/gameplay-constants.h"
#include "core/components/equipment-component.h"
#include "core/components/move-component.h"
#include "core/components/inventory-component.h"
#include "core/components/interactable-component.h"

class PlayerBuilder
{
public:
  static uint32_t Build(GameWorldEngine &engine, const Point &position)
  {
    auto player = engine.ObjectManager.Instantiate(position, std::make_unique<Circle>(position, PLAYER_DEFAULT_RADIUS));

    player->Type = "player";
    player->Radius = PLAYER_DEFAULT_RADIUS;

    engine.Ctx.GetManager<MoveComponentManager>()->Add(player->Id, player);
    engine.Ctx.GetManager<CombatBodyComponentManager>()->AddDefaultHumanoid(player->Id, player);
    engine.Ctx.GetManager<CombatStateComponentManager>()->Ensure(player->Id, player);
    engine.Ctx.GetManager<ActiveAttackComponentManager>()->Ensure(player->Id, player);

    auto backpack = std::make_unique<Inventory>(PLAYER_DEFAULT_BACKPACK_MAX_VOLUME, float32(0.0));
    engine.Ctx.GetManager<InventoryComponentManager>()->EquipContainer(
        player->Id, ContainerSlot::Backpack, std::move(backpack), player);
    engine.Ctx.GetManager<EquipmentComponentManager>()->Ensure(
        player->Id, player, engine.Ctx.GetManager<InventoryComponentManager>());

    engine.Ctx.GetManager<InteractableComponentManager>()->AddSensor(
        player->Id, player, std::make_unique<Circle>(position, PLAYER_DEFAULT_INTERACTION_RADIUS));

    return player->Id;
  }
};

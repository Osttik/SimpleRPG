#include "core/test-spawns.h"
#include "core/gameplay-constants.h"
#include "core/inventory.h"
#include "core/components/inventory-component.h"
#include "core/logger.h"

void SpawnTestChests(GameWorldEngine &core)
{
    constexpr int32_t TEST_PROP_Z = 0;

    auto spawnChest = [&](float32 fx, float32 fy)
    {
        Point position(fx, fy, TEST_PROP_Z);
        uint32_t id = core.Props.AddChest(core, position, TEST_CHEST_RADIUS, TEST_PROP_Z);
        EngineLog("zlevel", std::string("spawned test chest id=") + std::to_string(id) + " z=" + std::to_string(TEST_PROP_Z));

        auto *invMgr = core.Ctx.GetManager<InventoryComponentManager>();
        if (invMgr)
        {
            Inventory *mainStorage = invMgr->GetContainer(id, ContainerSlot::MainStorage);
            if (mainStorage)
            {
                mainStorage->AddItem(ItemFactory::CreateCoin(1000));
                for (int i = 0; i < 5; i++)
                {
                    mainStorage->AddItem(ItemFactory::CreateSword());
                }
                mainStorage->AddItem(ItemFactory::CreatePickaxe());
                mainStorage->AddItem(ItemFactory::CreateShovel());
                mainStorage->AddItem(ItemFactory::CreateWoodStock());
                mainStorage->AddItem(ItemFactory::CreateWoodStock());
                mainStorage->AddItem(ItemFactory::CreateStoneStock());
                mainStorage->AddItem(ItemFactory::CreateIronStock());
            }
        }
    };

    spawnChest(float32(500.0), float32(500.0));
    spawnChest(float32(450.0), float32(500.0));
    core.Props.AddSmelter(core, Point(float32(560.0), float32(500.0), TEST_PROP_Z), TEST_CHEST_RADIUS, TEST_PROP_Z);
    core.Props.AddAnvil(core, Point(float32(610.0), float32(500.0), TEST_PROP_Z), TEST_CHEST_RADIUS, TEST_PROP_Z);
    core.Props.AddWorkbench(core, Point(float32(660.0), float32(500.0), TEST_PROP_Z), TEST_CHEST_RADIUS, TEST_PROP_Z);
    core.Props.AddGrindstone(core, Point(float32(710.0), float32(500.0), TEST_PROP_Z), TEST_CHEST_RADIUS, TEST_PROP_Z);
    EngineLog("zlevel", std::string("spawned test stations on z=") + std::to_string(TEST_PROP_Z));
}

#include "core/test-spawns.h"
#include "core/gameplay-constants.h"
#include "core/inventory.h"
#include "core/components/inventory-component.h"

void SpawnTestChests(GameWorldEngine &core)
{
    auto spawnChest = [&](float32 fx, float32 fy)
    {
        Point position(fx, fy);
        uint32_t id = core.Props.AddChest(core, position, TEST_CHEST_RADIUS, 1);

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
    core.Props.AddSmelter(core, Point(float32(560.0), float32(500.0), 1), TEST_CHEST_RADIUS, 1);
    core.Props.AddAnvil(core, Point(float32(610.0), float32(500.0), 1), TEST_CHEST_RADIUS, 1);
    core.Props.AddWorkbench(core, Point(float32(660.0), float32(500.0), 1), TEST_CHEST_RADIUS, 1);
    core.Props.AddGrindstone(core, Point(float32(710.0), float32(500.0), 1), TEST_CHEST_RADIUS, 1);
}

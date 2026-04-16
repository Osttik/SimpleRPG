#include <napi.h>
#include "core/game-world-engine.h"
#include "core/tile-registry.h"
#include "core/components/dropped-item-component.h"
#include "core/components/equipment-component.h"
#include "core/components/interactable-component.h"
#include "core/components/inventory-component.h"

class GameWorldWrapper : public Napi::ObjectWrap<GameWorldWrapper>
{
private:
    std::unique_ptr<GameWorldEngine> core_;

public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports)
    {
        Napi::Function func = DefineClass(env, "GameWorld",
                                          {
                                              InstanceMethod("addPlayer", &GameWorldWrapper::AddPlayer),
                                              InstanceMethod("removePlayer", &GameWorldWrapper::RemovePlayer),
                                              InstanceMethod("addProp", &GameWorldWrapper::AddProp),
                                              InstanceMethod("destroyProp", &GameWorldWrapper::DestroyProp),
                                              InstanceMethod("destroyTile", &GameWorldWrapper::DestroyTile),
                                              InstanceMethod("mineTile", &GameWorldWrapper::MineTile),
                                              InstanceMethod("processInput", &GameWorldWrapper::ProcessInput),
                                              InstanceMethod("spawnTestChest", &GameWorldWrapper::SpawnTestChest),
                                              InstanceMethod("tick", &GameWorldWrapper::Tick),
                                              InstanceMethod("getChunk", &GameWorldWrapper::GetChunk),
                                              InstanceMethod("getChunkVisuals", &GameWorldWrapper::GetChunkVisuals),
                                              InstanceMethod("consumeDirtyTerrainChunks", &GameWorldWrapper::ConsumeDirtyTerrainChunks),
                                              InstanceMethod("getState", &GameWorldWrapper::GetState),
                                              InstanceMethod("getBinaryState", &GameWorldWrapper::GetBinaryState),
                                              InstanceMethod("getCombatEvents", &GameWorldWrapper::GetCombatEvents),
                                              InstanceMethod("getTileRegistry", &GameWorldWrapper::GetTileRegistry),
                                              InstanceMethod("setTileRegistry", &GameWorldWrapper::SetTileRegistry),
                                              InstanceMethod("getInteractionOptions", &GameWorldWrapper::GetInteractionOptions),
                                              InstanceMethod("interactTarget", &GameWorldWrapper::InteractTarget),
                                              InstanceMethod("getLootState", &GameWorldWrapper::GetLootState),
                                              InstanceMethod("getPlayerInventoryState", &GameWorldWrapper::GetPlayerInventoryState),
                                              InstanceMethod("transferItem", &GameWorldWrapper::TransferItem),
                                              InstanceMethod("toggleEquipItem", &GameWorldWrapper::ToggleEquipItem),
                                              InstanceMethod("dropItem", &GameWorldWrapper::DropItem),
                                              InstanceMethod("getBodyStateManifest", &GameWorldWrapper::GetBodyStateManifest),
                                              InstanceMethod("getEntityBodyState", &GameWorldWrapper::GetEntityBodyState),
                                              InstanceMethod("setLayerDebugEnabled", &GameWorldWrapper::SetLayerDebugEnabled),
                                              InstanceMethod("getLayerDebugState", &GameWorldWrapper::GetLayerDebugState),
                                              InstanceMethod("getLayerValidationIssues", &GameWorldWrapper::GetLayerValidationIssues),
                                              InstanceMethod("addPlayerFromSaveState", &GameWorldWrapper::AddPlayerFromSaveState),
                                              InstanceMethod("exportSaveState", &GameWorldWrapper::ExportSaveState),
                                              InstanceMethod("importSaveState", &GameWorldWrapper::ImportSaveState),
                                          });
        exports.Set("GameWorld", func);
        return exports;
    }

    GameWorldWrapper(const Napi::CallbackInfo &info) : Napi::ObjectWrap<GameWorldWrapper>(info)
    {
        core_ = std::make_unique<GameWorldEngine>();
    }

private:
    bool GetBool(const Napi::Object &obj, const char *name, bool fallback) const
    {
        if (!obj.Has(name))
            return fallback;
        Napi::Value value = obj.Get(name);
        return value.IsBoolean() ? value.As<Napi::Boolean>().Value() : fallback;
    }

    int32_t GetInt(const Napi::Object &obj, const char *name, int32_t fallback) const
    {
        if (!obj.Has(name))
            return fallback;
        Napi::Value value = obj.Get(name);
        return value.IsNumber() ? value.As<Napi::Number>().Int32Value() : fallback;
    }

    TileConnectorType ParseConnectorType(const std::string &value) const
    {
        if (value == "ladder")
            return TileConnectorType::Ladder;
        if (value == "stairs")
            return TileConnectorType::Stairs;
        if (value == "hatch")
            return TileConnectorType::Hatch;
        if (value == "drop")
            return TileConnectorType::Drop;
        return TileConnectorType::None;
    }

    ToolClass ParseToolClass(const std::string &value) const
    {
        if (value == "pickaxe")
            return ToolClass::Pickaxe;
        if (value == "shovel")
            return ToolClass::Shovel;
        return ToolClass::None;
    }

    TileStrengthClass ParseStrengthClass(const std::string &value) const
    {
        if (value == "soft")
            return TileStrengthClass::Soft;
        if (value == "strong")
            return TileStrengthClass::Strong;
        return TileStrengthClass::None;
    }

    MaterialId ParseMaterialId(const std::string &value) const
    {
        if (value == "dirt")
            return MaterialId::Dirt;
        if (value == "stone")
            return MaterialId::Stone;
        if (value == "iron")
            return MaterialId::Iron;
        if (value == "gold")
            return MaterialId::Gold;
        if (value == "clay")
            return MaterialId::Clay;
        return MaterialId::None;
    }

    std::vector<MaterialPart> ParseMaterialParts(const Napi::Value &value) const
    {
        std::vector<MaterialPart> parts;
        if (!value.IsArray())
            return parts;

        Napi::Array array = value.As<Napi::Array>();
        parts.reserve(array.Length());
        for (uint32_t i = 0; i < array.Length(); ++i)
        {
            if (!array.Get(i).IsObject())
                continue;

            Napi::Object partObj = array.Get(i).As<Napi::Object>();
            if (!partObj.Has("id") || !partObj.Get("id").IsString())
                continue;

            parts.push_back(MaterialPart{
                ParseMaterialId(partObj.Get("id").As<Napi::String>().Utf8Value()),
                static_cast<uint8_t>(GetInt(partObj, "share", 0)),
            });
        }
        return parts;
    }

    std::vector<TileStageLootDef> ParseStageLoot(const Napi::Value &value) const
    {
        std::vector<TileStageLootDef> loot;
        if (!value.IsArray())
            return loot;

        Napi::Array array = value.As<Napi::Array>();
        loot.reserve(array.Length());
        for (uint32_t i = 0; i < array.Length(); ++i)
        {
            if (!array.Get(i).IsObject())
                continue;

            Napi::Object row = array.Get(i).As<Napi::Object>();
            if (!row.Has("itemDefinitionId") || !row.Get("itemDefinitionId").IsString())
                continue;

            loot.push_back(TileStageLootDef{
                row.Get("itemDefinitionId").As<Napi::String>().Utf8Value(),
                static_cast<uint16_t>(GetInt(row, "quantity", 0)),
            });
        }
        return loot;
    }

    TileDestructionDef ParseDestruction(const Napi::Value &value) const
    {
        TileDestructionDef destruction;
        if (!value.IsObject())
            return destruction;

        Napi::Object obj = value.As<Napi::Object>();
        destruction.Destructible = GetBool(obj, "destructible", false);
        destruction.MaxIntegrity = GetInt(obj, "maxIntegrity", destruction.MaxIntegrity);
        destruction.MiningResistance = GetInt(obj, "miningResistance", destruction.MiningResistance);
        if (obj.Has("strengthClass") && obj.Get("strengthClass").IsString())
            destruction.StrengthClass = ParseStrengthClass(obj.Get("strengthClass").As<Napi::String>().Utf8Value());
        if (obj.Has("preferredTool") && obj.Get("preferredTool").IsString())
            destruction.PreferredTool = ParseToolClass(obj.Get("preferredTool").As<Napi::String>().Utf8Value());
        destruction.DestroyedTileId = static_cast<uint16_t>(GetInt(obj, "destroyedTileId", destruction.DestroyedTileId));
        destruction.MaterialYieldHints = ParseMaterialParts(obj.Get("materialYieldHints"));

        if (obj.Has("stageVisualTileIds") && obj.Get("stageVisualTileIds").IsArray())
        {
            Napi::Array array = obj.Get("stageVisualTileIds").As<Napi::Array>();
            destruction.StageVisualTileIds.reserve(array.Length());
            for (uint32_t i = 0; i < array.Length(); ++i)
            {
                destruction.StageVisualTileIds.push_back(static_cast<uint16_t>(array.Get(i).As<Napi::Number>().Uint32Value()));
            }
        }

        if (obj.Has("stages") && obj.Get("stages").IsArray())
        {
            Napi::Array array = obj.Get("stages").As<Napi::Array>();
            destruction.Stages.reserve(array.Length());
            for (uint32_t i = 0; i < array.Length(); ++i)
            {
                if (!array.Get(i).IsObject())
                    continue;

                Napi::Object stageObj = array.Get(i).As<Napi::Object>();
                TileDestructionStageDef stage;
                stage.Threshold = GetInt(stageObj, "threshold", 0);
                if (stageObj.Has("loot"))
                    stage.Loot = ParseStageLoot(stageObj.Get("loot"));
                destruction.Stages.push_back(std::move(stage));
            }
        }

        return destruction;
    }

    TileConnectorDef ParseConnector(const Napi::Object &obj, const TileConnectorDef &fallback) const
    {
        TileConnectorDef connector = fallback;
        if (obj.Has("type") && obj.Get("type").IsString())
            connector.Type = ParseConnectorType(obj.Get("type").As<Napi::String>().Utf8Value());

        connector.DeltaZ = static_cast<int8_t>(GetInt(obj, "deltaZ", connector.DeltaZ));
        connector.AllowedEnterDirectionMask = static_cast<uint8_t>(GetInt(obj, "allowedEnterDirectionMask", connector.AllowedEnterDirectionMask));
        connector.AllowedMovementDirectionMask = static_cast<uint8_t>(GetInt(obj, "allowedMovementDirectionMask", connector.AllowedMovementDirectionMask));
        connector.AutoTrigger = GetBool(obj, "autoTrigger", connector.AutoTrigger);
        connector.RequireDestinationSupport = GetBool(obj, "requireDestinationSupport", connector.RequireDestinationSupport);
        connector.RequireDestinationNotBlocked = GetBool(obj, "requireDestinationNotBlocked", connector.RequireDestinationNotBlocked);
        connector.CooldownTicks = static_cast<uint8_t>(GetInt(obj, "cooldownTicks", connector.CooldownTicks));
        connector.OneWay = GetBool(obj, "oneWay", connector.OneWay);
        connector.Bidirectional = GetBool(obj, "bidirectional", connector.Bidirectional);

        if (obj.Has("triggerBounds") && obj.Get("triggerBounds").IsObject())
        {
            Napi::Object bounds = obj.Get("triggerBounds").As<Napi::Object>();
            connector.TriggerMinX = static_cast<int16_t>(GetInt(bounds, "minX", connector.TriggerMinX));
            connector.TriggerMinY = static_cast<int16_t>(GetInt(bounds, "minY", connector.TriggerMinY));
            connector.TriggerMaxX = static_cast<int16_t>(GetInt(bounds, "maxX", connector.TriggerMaxX));
            connector.TriggerMaxY = static_cast<int16_t>(GetInt(bounds, "maxY", connector.TriggerMaxY));
        }

        return connector;
    }

    TileGameplayDef ParseTileGameplay(const Napi::Object &obj) const
    {
        TileGameplayDef gameplay;
        const bool collide = GetBool(obj, "collide", false);
        gameplay.Collide = collide;
        gameplay.Support = GetBool(obj, "support", !collide);
        gameplay.FallThrough = GetBool(obj, "fallThrough", !gameplay.Support);
        gameplay.Roof = GetBool(obj, "roof", false);
        gameplay.Occludes = GetBool(obj, "occludes", collide || gameplay.Roof);
        gameplay.DamageVisualStage = static_cast<uint8_t>(GetInt(obj, "damageVisualStage", 0));

        if (obj.Has("connector") && obj.Get("connector").IsObject())
            gameplay.Connector = ParseConnector(obj.Get("connector").As<Napi::Object>(), gameplay.Connector);
        if (obj.Has("destruction"))
            gameplay.Destruction = ParseDestruction(obj.Get("destruction"));

        return gameplay;
    }

    std::string MaterialIdToString(MaterialId materialId) const
    {
        switch (materialId)
        {
        case MaterialId::Dirt:
            return "dirt";
        case MaterialId::Stone:
            return "stone";
        case MaterialId::Iron:
            return "iron";
        case MaterialId::Gold:
            return "gold";
        case MaterialId::Clay:
            return "clay";
        default:
            return "none";
        }
    }

    Napi::Array BuildMaterialPartsArray(Napi::Env env, const std::vector<MaterialPart> &parts) const
    {
        Napi::Array out = Napi::Array::New(env, parts.size());
        for (uint32_t i = 0; i < parts.size(); ++i)
        {
            Napi::Object row = Napi::Object::New(env);
            row.Set("id", Napi::String::New(env, MaterialIdToString(parts[i].Id)));
            row.Set("share", Napi::Number::New(env, parts[i].Share));
            out.Set(i, row);
        }
        return out;
    }

    Napi::Object BuildItemSaveObject(Napi::Env env, const Item &item) const
    {
        Napi::Object row = Napi::Object::New(env);
        row.Set("definitionId", Napi::String::New(env, item.DefinitionId));
        row.Set("name", Napi::String::New(env, item.Name));
        row.Set("spriteKey", Napi::String::New(env, item.SpriteKey));
        row.Set("quantity", Napi::Number::New(env, item.Quantity));
        row.Set("stackable", Napi::Boolean::New(env, item.Stackable));
        row.Set("maxStack", Napi::Number::New(env, item.MaxStack));
        row.Set("volumeRaw", Napi::Number::New(env, item.Volume.raw_value()));
        row.Set("weightRaw", Napi::Number::New(env, item.Weight.raw_value()));

        Napi::Object features = Napi::Object::New(env);

        if (const auto *durability = item.GetFeature<DurabilityFeature>())
        {
            Napi::Object value = Napi::Object::New(env);
            value.Set("current", Napi::Number::New(env, durability->Current));
            value.Set("max", Napi::Number::New(env, durability->Max));
            features.Set("durability", value);
        }

        if (const auto *equippable = item.GetFeature<EquippableFeature>())
        {
            Napi::Array slots = Napi::Array::New(env, equippable->AllowedSlots.size());
            for (uint32_t i = 0; i < equippable->AllowedSlots.size(); ++i)
            {
                slots.Set(i, Napi::Number::New(env, static_cast<uint8_t>(equippable->AllowedSlots[i])));
            }
            features.Set("equippableSlots", slots);
        }

        if (const auto *weapon = item.GetFeature<WeaponFeature>())
        {
            Napi::Object value = Napi::Object::New(env);
            value.Set("minDamage", Napi::Number::New(env, weapon->MinDamage));
            value.Set("maxDamage", Napi::Number::New(env, weapon->MaxDamage));
            features.Set("weapon", value);
        }

        if (const auto *merchant = item.GetFeature<MerchantValueFeature>())
        {
            Napi::Object value = Napi::Object::New(env);
            value.Set("baseValueRaw", Napi::Number::New(env, merchant->BaseValue.raw_value()));
            features.Set("merchantValue", value);
        }

        if (const auto *tool = item.GetFeature<ToolFeature>())
        {
            Napi::Object value = Napi::Object::New(env);
            value.Set("toolClass", Napi::Number::New(env, static_cast<uint8_t>(tool->Mining.Class)));
            value.Set("basePower", Napi::Number::New(env, tool->Mining.BasePower));
            value.Set("softMultiplierPct", Napi::Number::New(env, tool->Mining.SoftMultiplierPct));
            value.Set("strongMultiplierPct", Napi::Number::New(env, tool->Mining.StrongMultiplierPct));
            value.Set("preferredToolBonus", Napi::Number::New(env, tool->Mining.PreferredToolBonus));
            features.Set("tool", value);
        }

        if (const auto *materials = item.GetFeature<MaterialCompositionFeature>())
        {
            features.Set("materialComposition", BuildMaterialPartsArray(env, materials->Composition.Parts));
        }

        row.Set("features", features);
        return row;
    }

    std::unique_ptr<Item> ParseItemSaveObject(const Napi::Value &value) const
    {
        if (!value.IsObject())
            return nullptr;

        Napi::Object obj = value.As<Napi::Object>();
        const std::string definitionId = obj.Has("definitionId") && obj.Get("definitionId").IsString()
            ? obj.Get("definitionId").As<Napi::String>().Utf8Value()
            : std::string();

        std::unique_ptr<Item> item = ItemFactory::CreateByDefinitionId(definitionId, GetInt(obj, "quantity", 1));
        if (!item)
        {
            item = std::make_unique<Item>(
                definitionId,
                obj.Has("name") && obj.Get("name").IsString() ? obj.Get("name").As<Napi::String>().Utf8Value() : definitionId,
                obj.Has("spriteKey") && obj.Get("spriteKey").IsString() ? obj.Get("spriteKey").As<Napi::String>().Utf8Value() : std::string(),
                float32::from_raw_value(GetInt(obj, "volumeRaw", 0)),
                float32::from_raw_value(GetInt(obj, "weightRaw", 0)),
                GetBool(obj, "stackable", false),
                GetInt(obj, "maxStack", 1),
                GetInt(obj, "quantity", 1));
        }

        item->Name = obj.Has("name") && obj.Get("name").IsString() ? obj.Get("name").As<Napi::String>().Utf8Value() : item->Name;
        item->SpriteKey = obj.Has("spriteKey") && obj.Get("spriteKey").IsString() ? obj.Get("spriteKey").As<Napi::String>().Utf8Value() : item->SpriteKey;
        item->Quantity = GetInt(obj, "quantity", item->Quantity);
        item->Stackable = GetBool(obj, "stackable", item->Stackable);
        item->MaxStack = GetInt(obj, "maxStack", item->MaxStack);
        item->Volume = float32::from_raw_value(GetInt(obj, "volumeRaw", item->Volume.raw_value()));
        item->Weight = float32::from_raw_value(GetInt(obj, "weightRaw", item->Weight.raw_value()));

        if (!obj.Has("features") || !obj.Get("features").IsObject())
            return item;

        Napi::Object features = obj.Get("features").As<Napi::Object>();

        if (features.Has("durability") && features.Get("durability").IsObject())
        {
            const Napi::Object durabilityObj = features.Get("durability").As<Napi::Object>();
            auto *durability = item->GetFeature<DurabilityFeature>();
            if (!durability)
                durability = item->AddFeature<DurabilityFeature>(GetInt(durabilityObj, "current", 0), GetInt(durabilityObj, "max", 0));
            durability->Current = GetInt(durabilityObj, "current", durability->Current);
            durability->Max = GetInt(durabilityObj, "max", durability->Max);
        }

        if (features.Has("equippableSlots") && features.Get("equippableSlots").IsArray())
        {
            std::vector<EquipSlot> slots;
            Napi::Array array = features.Get("equippableSlots").As<Napi::Array>();
            slots.reserve(array.Length());
            for (uint32_t i = 0; i < array.Length(); ++i)
            {
                if (!array.Get(i).IsNumber())
                    continue;
                slots.push_back(static_cast<EquipSlot>(array.Get(i).As<Napi::Number>().Uint32Value()));
            }

            auto *equippable = item->GetFeature<EquippableFeature>();
            if (!equippable)
                equippable = item->AddFeature<EquippableFeature>(slots);
            equippable->AllowedSlots = std::move(slots);
        }

        if (features.Has("weapon") && features.Get("weapon").IsObject())
        {
            const Napi::Object weaponObj = features.Get("weapon").As<Napi::Object>();
            auto *weapon = item->GetFeature<WeaponFeature>();
            if (!weapon)
                weapon = item->AddFeature<WeaponFeature>(GetInt(weaponObj, "minDamage", 0), GetInt(weaponObj, "maxDamage", 0));
            weapon->MinDamage = GetInt(weaponObj, "minDamage", weapon->MinDamage);
            weapon->MaxDamage = GetInt(weaponObj, "maxDamage", weapon->MaxDamage);
        }

        if (features.Has("merchantValue") && features.Get("merchantValue").IsObject())
        {
            const Napi::Object merchantObj = features.Get("merchantValue").As<Napi::Object>();
            auto *merchant = item->GetFeature<MerchantValueFeature>();
            if (!merchant)
                merchant = item->AddFeature<MerchantValueFeature>(float32::from_raw_value(GetInt(merchantObj, "baseValueRaw", 0)));
            merchant->BaseValue = float32::from_raw_value(GetInt(merchantObj, "baseValueRaw", merchant->BaseValue.raw_value()));
        }

        if (features.Has("tool") && features.Get("tool").IsObject())
        {
            const Napi::Object toolObj = features.Get("tool").As<Napi::Object>();
            MiningToolStats stats;
            stats.Class = static_cast<ToolClass>(GetInt(toolObj, "toolClass", static_cast<int32_t>(stats.Class)));
            stats.BasePower = GetInt(toolObj, "basePower", stats.BasePower);
            stats.SoftMultiplierPct = GetInt(toolObj, "softMultiplierPct", stats.SoftMultiplierPct);
            stats.StrongMultiplierPct = GetInt(toolObj, "strongMultiplierPct", stats.StrongMultiplierPct);
            stats.PreferredToolBonus = GetInt(toolObj, "preferredToolBonus", stats.PreferredToolBonus);

            auto *tool = item->GetFeature<ToolFeature>();
            if (!tool)
                tool = item->AddFeature<ToolFeature>(stats);
            tool->Mining = stats;
        }

        if (features.Has("materialComposition"))
        {
            MaterialComposition composition;
            composition.Parts = ParseMaterialParts(features.Get("materialComposition"));
            auto *materials = item->GetFeature<MaterialCompositionFeature>();
            if (!materials)
                materials = item->AddFeature<MaterialCompositionFeature>(composition);
            materials->Composition = composition;
            materials->Composition.Normalize();
        }

        return item;
    }

    Napi::Object BuildInventorySaveObject(Napi::Env env, Inventory *inventory) const
    {
        Napi::Object out = Napi::Object::New(env);
        if (!inventory)
            return out;

        out.Set("maxVolumeRaw", Napi::Number::New(env, inventory->MaxCarryVolume.raw_value()));
        out.Set("maxWeightRaw", Napi::Number::New(env, inventory->MaxCarryWeight.raw_value()));
        out.Set("weightRaw", Napi::Number::New(env, inventory->Weight.raw_value()));

        Napi::Array items = Napi::Array::New(env, inventory->Count());
        for (uint32_t i = 0; i < inventory->Count(); ++i)
        {
            const Item *item = (*inventory)[i];
            if (!item)
                continue;
            items.Set(i, BuildItemSaveObject(env, *item));
        }
        out.Set("items", items);
        return out;
    }

    std::unique_ptr<Inventory> ParseInventorySaveObject(const Napi::Value &value) const
    {
        if (!value.IsObject())
            return nullptr;

        Napi::Object obj = value.As<Napi::Object>();
        auto inventory = std::make_unique<Inventory>(
            float32::from_raw_value(GetInt(obj, "maxVolumeRaw", 0)),
            float32::from_raw_value(GetInt(obj, "weightRaw", 0)),
            float32::from_raw_value(GetInt(obj, "maxWeightRaw", 0)));

        if (!obj.Has("items") || !obj.Get("items").IsArray())
            return inventory;

        Napi::Array items = obj.Get("items").As<Napi::Array>();
        for (uint32_t i = 0; i < items.Length(); ++i)
        {
            auto item = ParseItemSaveObject(items.Get(i));
            if (item)
                inventory->AddItem(std::move(item));
        }
        return inventory;
    }

    Napi::Array BuildEquipmentSaveArray(Napi::Env env, uint32_t entityId, Inventory *inventory) const
    {
        Napi::Array out = Napi::Array::New(env);
        auto *equipmentMgr = core_->Ctx.GetManager<EquipmentComponentManager>();
        if (!equipmentMgr || !inventory)
            return out;

        uint32_t index = 0;
        for (uint32_t slot = 0; slot < static_cast<uint32_t>(EquipSlot::HandSecondary) + 1; ++slot)
        {
            const auto equipSlot = static_cast<EquipSlot>(slot);
            const Item *item = equipmentMgr->GetEquippedItem(entityId, equipSlot);
            if (!item)
                continue;

            for (uint32_t itemIndex = 0; itemIndex < inventory->Count(); ++itemIndex)
            {
                if ((*inventory)[itemIndex] != item)
                    continue;

                Napi::Object binding = Napi::Object::New(env);
                binding.Set("slot", Napi::Number::New(env, slot));
                binding.Set("itemIndex", Napi::Number::New(env, itemIndex));
                out.Set(index++, binding);
                break;
            }
        }

        return out;
    }

    void ApplyEquipmentSaveArray(uint32_t entityId, Inventory *inventory, const Napi::Value &value)
    {
        auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
        auto *equipmentMgr = core_->Ctx.GetManager<EquipmentComponentManager>();
        auto *owner = core_->ObjectManager.GetById(entityId);
        if (!inventoryMgr || !equipmentMgr || !owner || !inventory)
            return;

        auto *equipment = equipmentMgr->Ensure(entityId, owner, inventoryMgr);
        if (!equipment || !value.IsArray())
            return;

        for (auto &slot : equipment->Slots)
            slot.ItemRef = nullptr;

        Napi::Array bindings = value.As<Napi::Array>();
        for (uint32_t i = 0; i < bindings.Length(); ++i)
        {
            if (!bindings.Get(i).IsObject())
                continue;

            Napi::Object binding = bindings.Get(i).As<Napi::Object>();
            const uint32_t slotIndex = binding.Has("slot") && binding.Get("slot").IsNumber()
                ? binding.Get("slot").As<Napi::Number>().Uint32Value()
                : 0;
            const uint32_t itemIndex = binding.Has("itemIndex") && binding.Get("itemIndex").IsNumber()
                ? binding.Get("itemIndex").As<Napi::Number>().Uint32Value()
                : 0;

            if (slotIndex >= equipment->Slots.size() || itemIndex >= inventory->Count())
                continue;

            equipment->Slots[slotIndex].ItemRef = (*inventory)[itemIndex];
        }
    }

    Napi::Object BuildInventoryObject(Napi::Env env, uint32_t ownerId, Inventory *inventory) const
    {
        Napi::Object out = Napi::Object::New(env);
        Napi::Array items = Napi::Array::New(env);
        auto *equipmentMgr = core_->Ctx.GetManager<EquipmentComponentManager>();

        if (inventory)
        {
            for (size_t i = 0; i < inventory->Count(); ++i)
            {
                const Item *item = (*inventory)[i];
                if (!item)
                    continue;

                Napi::Object row = Napi::Object::New(env);
                row.Set("id", Napi::String::New(env, std::to_string(i)));
                row.Set("name", Napi::String::New(env, item->Name));
                row.Set("spriteKey", Napi::String::New(env, item->SpriteKey));
                row.Set("quantity", Napi::Number::New(env, item->Quantity));
                row.Set("stackable", Napi::Boolean::New(env, item->Stackable));
                row.Set("maxStack", Napi::Number::New(env, item->MaxStack));
                row.Set("volume", Napi::Number::New(env, static_cast<double>(item->Volume)));
                row.Set("weight", Napi::Number::New(env, static_cast<double>(item->Weight)));
                row.Set("price", Napi::Number::New(env, static_cast<double>(item->GetMerchantBaseValue())));
                const bool equipped = equipmentMgr ? equipmentMgr->IsEquipped(ownerId, item) : false;
                row.Set("equipped", Napi::Boolean::New(env, equipped));
                const auto slot = equipmentMgr ? equipmentMgr->GetEquippedSlotFor(ownerId, item) : EquipSlot::None;
                row.Set("equipSlot", Napi::String::New(env, EquipmentComponentManager::SlotName(slot)));
                items.Set(i, row);
            }

            out.Set("currentVolume", Napi::Number::New(env, static_cast<double>(inventory->GetCurrentVolume())));
            out.Set("maxVolume", Napi::Number::New(env, static_cast<double>(inventory->MaxCarryVolume)));
            out.Set("currentWeight", Napi::Number::New(env, static_cast<double>(inventory->GetAllWeight())));
        }
        else
        {
            out.Set("currentVolume", Napi::Number::New(env, 0.0));
            out.Set("maxVolume", Napi::Number::New(env, 0.0));
            out.Set("currentWeight", Napi::Number::New(env, 0.0));
        }

        out.Set("items", items);
        return out;
    }

    Napi::Value BuildPlayerInventoryState(Napi::Env env, uint32_t playerId) const
    {
        auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
        if (!inventoryMgr)
            return env.Null();

        Napi::Object payload = Napi::Object::New(env);
        auto playerInventory = BuildInventoryObject(env, playerId, inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack));
        payload.Set("playerInventory", playerInventory.Get("items"));
        payload.Set("playerInventoryMeta", playerInventory);
        return payload;
    }

    Napi::Value BuildLootState(Napi::Env env, uint32_t playerId, uint32_t targetId) const
    {
        auto *interactMgr = core_->Ctx.GetManager<InteractableComponentManager>();
        auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
        if (!interactMgr || !inventoryMgr)
            return env.Null();

        auto *player = core_->ObjectManager.GetById(playerId);
        auto *target = core_->ObjectManager.GetById(targetId);
        if (!player || !target || !interactMgr->CanInteract(playerId, targetId))
            return env.Null();

        auto *interactComp = interactMgr->Get(targetId);
        if (interactComp && interactComp->Type == InteractionType::Pickup)
        {
            if (!core_->PickupItem(playerId, targetId))
                return env.Null();

            Napi::Object payload = Napi::Object::New(env);
            payload.Set("payloadType", Napi::String::New(env, "player_inventory"));
            auto playerInventory = BuildInventoryObject(env, playerId, inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack));
            payload.Set("playerInventory", playerInventory.Get("items"));
            payload.Set("playerInventoryMeta", playerInventory);
            return payload;
        }

        Napi::Object payload = Napi::Object::New(env);
        payload.Set("chestId", Napi::String::New(env, std::to_string(targetId)));
        payload.Set("interactionType", Napi::String::New(env, "loot"));

        auto playerInventory = BuildInventoryObject(env, playerId, inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack));
        auto chestInventory = BuildInventoryObject(env, targetId, inventoryMgr->GetContainer(targetId, ContainerSlot::MainStorage));

        payload.Set("playerInventory", playerInventory.Get("items"));
        payload.Set("chestInventory", chestInventory.Get("items"));
        payload.Set("playerInventoryMeta", playerInventory);
        payload.Set("chestInventoryMeta", chestInventory);
        return payload;
    }

    Napi::Value AddPlayer(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2)
        {
            Napi::TypeError::New(info.Env(), "Requires: x, y").ThrowAsJavaScriptException();
            return info.Env().Null();
        }

        auto spawnPosition = Point(float32(info[0].As<Napi::Number>().DoubleValue()), float32(info[1].As<Napi::Number>().DoubleValue()), 1);
        auto result = core_->Players.AddPlayer(*core_, spawnPosition);

        return Napi::Number::New(info.Env(), result);
    }

    Napi::Value RemovePlayer(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1)
        {
            return info.Env().Null();
        }

        core_->RemovePlayer(info[0].As<Napi::Number>().Int32Value());
        return info.Env().Undefined();
    }

    Napi::Value AddProp(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 4)
        {
            return info.Env().Null();
        }

        auto result = core_->AddProp(
            info[0].As<Napi::Number>().DoubleValue(),
            info[1].As<Napi::Number>().DoubleValue(),
            info[2].As<Napi::Number>().DoubleValue(),
            info[3].As<Napi::Number>().Int32Value());

        return Napi::Number::New(info.Env(), result);
    }

    Napi::Value DestroyProp(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1)
        {
            return info.Env().Null();
        }

        core_->DestroyProp(info[0].As<Napi::Number>().Int32Value());
        return info.Env().Undefined();
    }

    Napi::Value DestroyTile(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 3)
            return info.Env().Null();
        core_->DestroyTile(
            info[0].As<Napi::Number>().Int32Value(),
            info[1].As<Napi::Number>().Int32Value(),
            info[2].As<Napi::Number>().Int32Value());
        return info.Env().Undefined();
    }

    Napi::Value MineTile(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 3)
            return Napi::Boolean::New(info.Env(), false);

        return Napi::Boolean::New(
            info.Env(),
            core_->MineTile(
                info[0].As<Napi::Number>().Uint32Value(),
                info[1].As<Napi::Number>().Int32Value(),
                info[2].As<Napi::Number>().Int32Value()));
    }

    Napi::Value SpawnTestChest(const Napi::CallbackInfo &info)
    {
        core_->SpawnTestChest();
        return info.Env().Undefined();
    }

    Napi::Value AddPlayerFromSaveState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsObject())
            return info.Env().Null();

        Napi::Object state = info[0].As<Napi::Object>();
        const int32_t xRaw = GetInt(state, "xRaw", 0);
        const int32_t yRaw = GetInt(state, "yRaw", 0);
        const int32_t z = GetInt(state, "z", 1);

        const uint32_t playerId = core_->Players.AddPlayer(
            *core_,
            Point(float32::from_raw_value(xRaw), float32::from_raw_value(yRaw), z));

        auto *player = core_->ObjectManager.GetById(playerId);
        auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
        if (!player || !inventoryMgr)
            return Napi::Number::New(info.Env(), playerId);

        player->Transform.SetPosition(Point(float32::from_raw_value(xRaw), float32::from_raw_value(yRaw), z));
        player->Transform.SetFacing(
            float32::from_raw_value(GetInt(state, "facingXRaw", 0)),
            float32::from_raw_value(GetInt(state, "facingYRaw", float32(1).raw_value())));
        player->Radius = float32::from_raw_value(GetInt(state, "radiusRaw", player->Radius.raw_value()));

        if (state.Has("backpack"))
        {
            auto backpack = ParseInventorySaveObject(state.Get("backpack"));
            if (backpack)
            {
                inventoryMgr->EquipContainer(playerId, ContainerSlot::Backpack, std::move(backpack), player);
            }
        }

        ApplyEquipmentSaveArray(playerId, inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack), state.Get("equipment"));
        return Napi::Number::New(info.Env(), playerId);
    }

    Napi::Value ProcessInput(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2 || !info[0].IsNumber() || (!info[1].IsBuffer() && !info[1].IsArrayBuffer() && !info[1].IsTypedArray()))
            return info.Env().Null();

        uint32_t id = info[0].As<Napi::Number>().Int32Value();
        const uint8_t *data = nullptr;
        size_t length = 0;

        if (info[1].IsBuffer())
        {
            Napi::Buffer<uint8_t> buf = info[1].As<Napi::Buffer<uint8_t>>();
            data = buf.Data();
            length = buf.Length();
        }
        else if (info[1].IsArrayBuffer())
        {
            Napi::ArrayBuffer ab = info[1].As<Napi::ArrayBuffer>();
            data = static_cast<const uint8_t *>(ab.Data());
            length = ab.ByteLength();
        }
        else if (info[1].IsTypedArray())
        {
            Napi::TypedArray ab = info[1].As<Napi::TypedArray>();
            data = static_cast<const uint8_t *>(ab.ArrayBuffer().Data()) + ab.ByteOffset();
            length = ab.ByteLength();
        }

        core_->ProcessInput(id, data, length);

        return info.Env().Undefined();
    }

    Napi::Value Tick(const Napi::CallbackInfo &info)
    {
        core_->Tick();
        return info.Env().Undefined();
    }

    Napi::Value GetInteractionOptions(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsNumber())
            return info.Env().Null();

        const uint32_t playerId = info[0].As<Napi::Number>().Uint32Value();
        auto *player = core_->ObjectManager.GetById(playerId);
        auto *interactMgr = core_->Ctx.GetManager<InteractableComponentManager>();
        if (!player || !interactMgr)
            return info.Env().Null();

        Napi::Array targets = Napi::Array::New(info.Env());
        uint32_t index = 0;

        for (const auto &[id, entity] : core_->ObjectManager.GetEntities())
        {
            if (id == playerId)
                continue;
            if (!interactMgr->IsInteractable(id))
                continue;
            if (!interactMgr->CanInteract(playerId, id))
                continue;

            auto *comp = interactMgr->Get(id);
            if (!comp)
                continue;

            if (comp->Type == InteractionType::Pickup)
            {
                auto *droppedMgr = core_->Ctx.GetManager<DroppedItemComponentManager>();
                auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
                auto *backpack = inventoryMgr ? inventoryMgr->GetContainer(playerId, ContainerSlot::Backpack) : nullptr;
                auto *item = droppedMgr ? droppedMgr->GetItem(id) : nullptr;
                if (!backpack || !item || !backpack->CanAccept(*item))
                    continue;
            }
            else if (comp->Type != InteractionType::Loot)
            {
                continue;
            }
            Napi::Object target = Napi::Object::New(info.Env());
            target.Set("targetId", Napi::String::New(info.Env(), std::to_string(id)));
            const std::string baseLabel = comp && !comp->Label.empty() ? comp->Label : entity->Type;
            target.Set("nameKey", Napi::String::New(info.Env(), baseLabel + " #" + std::to_string(id)));

            Napi::Array interactions = Napi::Array::New(info.Env(), 1);
            Napi::Object option = Napi::Object::New(info.Env());
            option.Set("interactionId", Napi::String::New(info.Env(), comp->Type == InteractionType::Pickup ? "pickup" : "loot"));
            option.Set("nameKey", Napi::String::New(info.Env(), comp->Type == InteractionType::Pickup ? "Pick up" : "Loot"));
            interactions.Set(uint32_t(0), option);
            target.Set("interactions", interactions);

            targets.Set(index++, target);
        }

        Napi::Object result = Napi::Object::New(info.Env());
        result.Set("targets", targets);
        result.Set("selectedTargetId", Napi::String::New(info.Env(), std::to_string(player->FocusedObjectId)));
        return result;
    }

    Napi::Value InteractTarget(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber())
            return info.Env().Null();

        const uint32_t playerId = info[0].As<Napi::Number>().Uint32Value();
        uint32_t targetId = info[1].As<Napi::Number>().Uint32Value();

        auto *player = core_->ObjectManager.GetById(playerId);
        auto *interactMgr = core_->Ctx.GetManager<InteractableComponentManager>();
        if (!player || !interactMgr)
            return info.Env().Null();

        if (targetId == 0)
            targetId = player->FocusedObjectId;

        if (!interactMgr->CanInteract(playerId, targetId))
            return info.Env().Null();

        player->FocusedObjectId = targetId;
        core_->Interact(playerId);

        return BuildLootState(info.Env(), playerId, targetId);
    }

    Napi::Value GetLootState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2 || !info[0].IsNumber() || !info[1].IsNumber())
            return info.Env().Null();

        const uint32_t playerId = info[0].As<Napi::Number>().Uint32Value();
        const uint32_t targetId = info[1].As<Napi::Number>().Uint32Value();
        return BuildLootState(info.Env(), playerId, targetId);
    }

    Napi::Value GetPlayerInventoryState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsNumber())
            return info.Env().Null();

        return BuildPlayerInventoryState(info.Env(), info[0].As<Napi::Number>().Uint32Value());
    }

    Napi::Value TransferItem(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 5)
            return Napi::Boolean::New(info.Env(), false);

        const uint32_t playerId = info[0].As<Napi::Number>().Uint32Value();
        const uint32_t targetId = info[1].As<Napi::Number>().Uint32Value();
        const int from = info[2].As<Napi::Number>().Int32Value();
        const int to = info[3].As<Napi::Number>().Int32Value();
        const int idx = info[4].As<Napi::Number>().Int32Value();

        return Napi::Boolean::New(info.Env(), core_->TransferItem(playerId, targetId, from, to, idx));
    }

    Napi::Value ToggleEquipItem(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2)
            return Napi::Boolean::New(info.Env(), false);

        const uint32_t entityId = info[0].As<Napi::Number>().Uint32Value();
        const int idx = info[1].As<Napi::Number>().Int32Value();
        return Napi::Boolean::New(info.Env(), core_->ToggleEquipItem(entityId, idx));
    }

    Napi::Value DropItem(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 2)
            return Napi::Boolean::New(info.Env(), false);

        const uint32_t entityId = info[0].As<Napi::Number>().Uint32Value();
        const int idx = info[1].As<Napi::Number>().Int32Value();
        return Napi::Boolean::New(info.Env(), core_->DropItem(entityId, idx));
    }

    // ─── Zero-Copy Binary State ───
    Napi::Value GetBinaryState(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();

        core_->SerializeSnapshot();
        core_->Snapshot.Swap();

        const uint8_t *readBuf = core_->Snapshot.GetReadBuffer();
        size_t payloadSize = core_->Snapshot.GetReadPayloadSize();

        auto ab = Napi::ArrayBuffer::New(
            env,
            const_cast<uint8_t *>(readBuf),
            payloadSize,
            [](Napi::Env, void *) {} // no-op release: C++ owns the memory
        );

        return ab;
    }

    Napi::Value GetCombatEvents(const Napi::CallbackInfo &info)
    {
        if (core_->CombatEvents.Empty())
        {
            return info.Env().Null();
        }

        const auto bytes = core_->CombatEvents.SerializeAndClear();
        return Napi::Buffer<uint8_t>::Copy(info.Env(), bytes.data(), bytes.size());
    }

    Napi::Value GetChunk(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 3)
            return info.Env().Null();
        const int32_t cx = info[0].As<Napi::Number>().Int32Value();
        const int32_t cy = info[1].As<Napi::Number>().Int32Value();
        const int32_t cz = info[2].As<Napi::Number>().Int32Value();
        Chunk *chunk = core_->World.GetChunkSafely(cx, cy, cz);
        if (!chunk)
            return info.Env().Null();
        const auto resolvedTiles = core_->World.ChunkManager->BuildResolvedChunkTiles(cx, cy, cz);
        if (resolvedTiles.empty())
            return info.Env().Null();
        return Napi::Buffer<uint8_t>::Copy(
            info.Env(),
            reinterpret_cast<const uint8_t *>(resolvedTiles.data()),
            resolvedTiles.size() * sizeof(uint16_t));
    }

    Napi::Value GetChunkVisuals(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 3)
            return info.Env().Null();
        Chunk *chunk = core_->World.GetChunkSafely(
            info[0].As<Napi::Number>().Int32Value(),
            info[1].As<Napi::Number>().Int32Value(),
            info[2].As<Napi::Number>().Int32Value());
        if (!chunk)
            return info.Env().Null();
        return Napi::Buffer<uint8_t>::Copy(info.Env(), reinterpret_cast<uint8_t *>(chunk->visual_mask_layer), CHUNK_VOLUME * sizeof(uint8_t));
    }

    Napi::Value ConsumeDirtyTerrainChunks(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        const auto dirty = core_->World.ChunkManager->ConsumeDirtyTerrainChunks();
        Napi::Array out = Napi::Array::New(env, dirty.size());
        for (uint32_t i = 0; i < dirty.size(); ++i)
        {
            const auto &[cx, cy, cz] = dirty[i];
            Napi::Object row = Napi::Object::New(env);
            row.Set("cx", Napi::Number::New(env, cx));
            row.Set("cy", Napi::Number::New(env, cy));
            row.Set("cz", Napi::Number::New(env, cz));
            out.Set(i, row);
        }
        return out;
    }

    Napi::Value SetTileRegistry(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsArray())
            return info.Env().Null();
        Napi::Array arr = info[0].As<Napi::Array>();
        std::vector<TileDef> definitions;

        for (uint32_t i = 0; i < arr.Length(); i++)
        {
            Napi::Value val = arr[i];
            if (val.IsObject())
            {
                Napi::Object obj = val.As<Napi::Object>();
                TileDef def;
                def.id = obj.Get("id").As<Napi::Number>().Uint32Value();
                def.name = obj.Get("name").As<Napi::String>().Utf8Value();
                def.gameplay = ParseTileGameplay(obj);
                definitions.push_back(def);
            }
        }
        core_->SetTileRegistry(definitions);
        return info.Env().Undefined();
    }

    Napi::Value GetTileRegistry(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        auto map = TileRegistry::GetAllTiles();
        Napi::Object obj = Napi::Object::New(env);
        for (const auto &[id, name] : map)
        {
            obj.Set(std::to_string(id), Napi::String::New(env, name));
        }
        return obj;
    }

    Napi::Value GetState(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        Napi::Object state = Napi::Object::New(env);
        Napi::Object players = Napi::Object::New(env);
        Napi::Array destroyed = Napi::Array::New(env);

        // Iterate all entities from ObjectManager
        for (const auto &[numId, entity] : core_->ObjectManager.GetEntities())
        {
            Napi::Object pData = Napi::Object::New(env);
            pData.Set("x", Napi::Number::New(env, static_cast<double>(entity->Transform.Position().X)));
            pData.Set("y", Napi::Number::New(env, static_cast<double>(entity->Transform.Position().Y)));
            pData.Set("radius", Napi::Number::New(env, static_cast<double>(entity->Radius)));
            pData.Set("z", Napi::Number::New(env, entity->Transform.Position().Z));
            pData.Set("type", Napi::String::New(env, entity->Type));

            // Resolve focusedId for players
            if (!entity->IsStaticProp && entity->FocusedObjectId != 0)
            {
                pData.Set("focusedId", Napi::Number::New(env, entity->FocusedObjectId));
            }

            players.Set(numId, pData);
        }

        // Populate Destroyed array
        const auto &recentlyDestroyed = core_->ObjectManager.GetRecentlyDestroyed();
        for (size_t i = 0; i < recentlyDestroyed.size(); ++i)
        {
            destroyed.Set(i, Napi::Number::New(env, recentlyDestroyed[i]));
        }

        state.Set("players", players);
        state.Set("destroyed", destroyed);
        return state;
    }

    Napi::Value ExportSaveState(const Napi::CallbackInfo &info)
    {
        Napi::Env env = info.Env();
        Napi::Object save = Napi::Object::New(env);
        save.Set("format", Napi::String::New(env, "simplerpg.session-save"));
        save.Set("version", Napi::Number::New(env, 1));
        save.Set("tickCount", Napi::Number::New(env, core_->TickCount));

        const auto loadedChunks = core_->World.ChunkManager->GetLoadedChunkCoords();
        Napi::Array chunkArray = Napi::Array::New(env, loadedChunks.size());
        for (uint32_t i = 0; i < loadedChunks.size(); ++i)
        {
            const auto &[cx, cy, cz] = loadedChunks[i];
            Napi::Object row = Napi::Object::New(env);
            row.Set("cx", Napi::Number::New(env, cx));
            row.Set("cy", Napi::Number::New(env, cy));
            row.Set("cz", Napi::Number::New(env, cz));
            chunkArray.Set(i, row);
        }
        save.Set("loadedChunks", chunkArray);

        const auto overrides = core_->World.ChunkManager->ExportTerrainOverrides();
        Napi::Array overrideArray = Napi::Array::New(env, overrides.size());
        for (uint32_t i = 0; i < overrides.size(); ++i)
        {
            const auto &entry = overrides[i];
            Napi::Object row = Napi::Object::New(env);
            row.Set("cx", Napi::Number::New(env, entry.ChunkX));
            row.Set("cy", Napi::Number::New(env, entry.ChunkY));
            row.Set("cz", Napi::Number::New(env, entry.ChunkZ));
            row.Set("localIndex", Napi::Number::New(env, entry.LocalIndex));
            row.Set("damage", Napi::Number::New(env, entry.State.Damage));
            row.Set("stage", Napi::Number::New(env, entry.State.Stage));
            row.Set("grantedStageMask", Napi::Number::New(env, entry.State.GrantedStageMask));
            row.Set("overrideTileId", Napi::Number::New(env, entry.State.OverrideTileId));
            row.Set("destroyed", Napi::Boolean::New(env, entry.State.Destroyed));
            overrideArray.Set(i, row);
        }
        save.Set("terrainOverrides", overrideArray);

        Napi::Array props = Napi::Array::New(env);
        Napi::Array playersOut = Napi::Array::New(env);
        uint32_t propIndex = 0;
        uint32_t playerIndex = 0;

        auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
        auto *droppedMgr = core_->Ctx.GetManager<DroppedItemComponentManager>();

        for (const auto &[entityId, entity] : core_->ObjectManager.GetEntities())
        {
            if (entity->Type == "player" && !entity->IsStaticProp)
            {
                Napi::Object row = Napi::Object::New(env);
                row.Set("xRaw", Napi::Number::New(env, entity->Transform.Position().X.raw_value()));
                row.Set("yRaw", Napi::Number::New(env, entity->Transform.Position().Y.raw_value()));
                row.Set("z", Napi::Number::New(env, entity->Transform.Position().Z));
                row.Set("radiusRaw", Napi::Number::New(env, entity->Radius.raw_value()));
                row.Set("facingXRaw", Napi::Number::New(env, entity->Transform.FacingDirection().X.raw_value()));
                row.Set("facingYRaw", Napi::Number::New(env, entity->Transform.FacingDirection().Y.raw_value()));
                row.Set("backpack", BuildInventorySaveObject(env, inventoryMgr ? inventoryMgr->GetContainer(entityId, ContainerSlot::Backpack) : nullptr));
                row.Set("equipment", BuildEquipmentSaveArray(env, entityId, inventoryMgr ? inventoryMgr->GetContainer(entityId, ContainerSlot::Backpack) : nullptr));
                playersOut.Set(playerIndex++, row);
                continue;
            }

            if (entity->Type == "chest")
            {
                Napi::Object row = Napi::Object::New(env);
                row.Set("type", Napi::String::New(env, entity->Type));
                row.Set("xRaw", Napi::Number::New(env, entity->Transform.Position().X.raw_value()));
                row.Set("yRaw", Napi::Number::New(env, entity->Transform.Position().Y.raw_value()));
                row.Set("z", Napi::Number::New(env, entity->Transform.Position().Z));
                row.Set("radiusRaw", Napi::Number::New(env, entity->Radius.raw_value()));
                row.Set("storage", BuildInventorySaveObject(env, inventoryMgr ? inventoryMgr->GetContainer(entityId, ContainerSlot::MainStorage) : nullptr));
                props.Set(propIndex++, row);
                continue;
            }

            if (entity->Type == "item_drop")
            {
                Napi::Object row = Napi::Object::New(env);
                row.Set("type", Napi::String::New(env, entity->Type));
                row.Set("xRaw", Napi::Number::New(env, entity->Transform.Position().X.raw_value()));
                row.Set("yRaw", Napi::Number::New(env, entity->Transform.Position().Y.raw_value()));
                row.Set("z", Napi::Number::New(env, entity->Transform.Position().Z));
                row.Set("radiusRaw", Napi::Number::New(env, entity->Radius.raw_value()));

                const Item *item = droppedMgr ? droppedMgr->GetItem(entityId) : nullptr;
                if (item)
                    row.Set("item", BuildItemSaveObject(env, *item));
                props.Set(propIndex++, row);
            }
        }

        save.Set("props", props);
        save.Set("players", playersOut);
        return save;
    }

    Napi::Value ImportSaveState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsObject())
            return Napi::Boolean::New(info.Env(), false);

        Napi::Object save = info[0].As<Napi::Object>();
        core_ = std::make_unique<GameWorldEngine>();

        if (save.Has("tickCount") && save.Get("tickCount").IsNumber())
        {
            core_->TickCount = save.Get("tickCount").As<Napi::Number>().Uint32Value();
        }

        if (save.Has("loadedChunks") && save.Get("loadedChunks").IsArray())
        {
            Napi::Array chunks = save.Get("loadedChunks").As<Napi::Array>();
            for (uint32_t i = 0; i < chunks.Length(); ++i)
            {
                if (!chunks.Get(i).IsObject())
                    continue;

                Napi::Object row = chunks.Get(i).As<Napi::Object>();
                core_->World.ChunkManager->GetChunk(
                    GetInt(row, "cx", 0),
                    GetInt(row, "cy", 0),
                    GetInt(row, "cz", 0));
            }
        }

        std::vector<std::tuple<int32_t, int32_t, int32_t>> rebuiltChunks;
        if (save.Has("terrainOverrides") && save.Get("terrainOverrides").IsArray())
        {
            Napi::Array overrides = save.Get("terrainOverrides").As<Napi::Array>();
            for (uint32_t i = 0; i < overrides.Length(); ++i)
            {
                if (!overrides.Get(i).IsObject())
                    continue;

                Napi::Object row = overrides.Get(i).As<Napi::Object>();
                TerrainOverrideEntry entry;
                entry.ChunkX = GetInt(row, "cx", 0);
                entry.ChunkY = GetInt(row, "cy", 0);
                entry.ChunkZ = GetInt(row, "cz", 0);
                entry.LocalIndex = static_cast<uint16_t>(GetInt(row, "localIndex", 0));
                entry.State.Damage = GetInt(row, "damage", 0);
                entry.State.Stage = static_cast<uint8_t>(GetInt(row, "stage", 0));
                entry.State.GrantedStageMask = static_cast<uint32_t>(GetInt(row, "grantedStageMask", 0));
                entry.State.OverrideTileId = static_cast<uint16_t>(GetInt(row, "overrideTileId", 0));
                entry.State.Destroyed = GetBool(row, "destroyed", false);
                core_->World.ChunkManager->ImportTerrainOverride(entry);
                rebuiltChunks.push_back(std::make_tuple(entry.ChunkX, entry.ChunkY, entry.ChunkZ));
            }
        }

        for (const auto &[cx, cy, cz] : rebuiltChunks)
        {
            core_->World.ChunkManager->RebuildChunkVisuals(cx, cy, cz);
        }

        auto *inventoryMgr = core_->Ctx.GetManager<InventoryComponentManager>();
        if (save.Has("props") && save.Get("props").IsArray())
        {
            Napi::Array props = save.Get("props").As<Napi::Array>();
            for (uint32_t i = 0; i < props.Length(); ++i)
            {
                if (!props.Get(i).IsObject())
                    continue;

                Napi::Object row = props.Get(i).As<Napi::Object>();
                const std::string type = row.Has("type") && row.Get("type").IsString()
                    ? row.Get("type").As<Napi::String>().Utf8Value()
                    : std::string();
                const int32_t xRaw = GetInt(row, "xRaw", 0);
                const int32_t yRaw = GetInt(row, "yRaw", 0);
                const int32_t z = GetInt(row, "z", 0);

                if (type == "chest")
                {
                    const uint32_t propId = core_->AddProp(
                        static_cast<double>(float32::from_raw_value(xRaw)),
                        static_cast<double>(float32::from_raw_value(yRaw)),
                        static_cast<double>(float32::from_raw_value(GetInt(row, "radiusRaw", 0))),
                        z);

                    auto *prop = core_->ObjectManager.GetById(propId);
                    if (!prop || !inventoryMgr)
                        continue;

                    prop->Transform.SetPosition(Point(float32::from_raw_value(xRaw), float32::from_raw_value(yRaw), z));
                    prop->Radius = float32::from_raw_value(GetInt(row, "radiusRaw", prop->Radius.raw_value()));

                    auto storage = ParseInventorySaveObject(row.Get("storage"));
                    if (storage)
                    {
                        inventoryMgr->EquipContainer(propId, ContainerSlot::MainStorage, std::move(storage), prop);
                    }
                    continue;
                }

                if (type == "item_drop")
                {
                    auto item = ParseItemSaveObject(row.Get("item"));
                    if (!item)
                        continue;

                    const uint32_t propId = core_->Props.AddDroppedItem(
                        *core_,
                        Point(float32::from_raw_value(xRaw), float32::from_raw_value(yRaw), z),
                        std::move(item));
                    auto *prop = core_->ObjectManager.GetById(propId);
                    if (!prop)
                        continue;

                    prop->Transform.SetPosition(Point(float32::from_raw_value(xRaw), float32::from_raw_value(yRaw), z));
                    prop->Radius = float32::from_raw_value(GetInt(row, "radiusRaw", prop->Radius.raw_value()));
                }
            }
        }

        return Napi::Boolean::New(info.Env(), true);
    }

    Napi::Value GetBodyStateManifest(const Napi::CallbackInfo &info)
    {
        const auto bytes = core_->SerializeBodyStateManifest();
        return Napi::Buffer<uint8_t>::Copy(info.Env(), bytes.data(), bytes.size());
    }

    Napi::Value GetEntityBodyState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsNumber())
            return info.Env().Null();

        const uint32_t entityId = info[0].As<Napi::Number>().Uint32Value();
        const auto bytes = core_->SerializeEntityBodyState(entityId);
        return Napi::Buffer<uint8_t>::Copy(info.Env(), bytes.data(), bytes.size());
    }

    Napi::Value SetLayerDebugEnabled(const Napi::CallbackInfo &info)
    {
        const bool enabled = info.Length() > 0 && info[0].IsBoolean() && info[0].As<Napi::Boolean>().Value();
        core_->Layers.SetDebugEnabled(enabled);
        return info.Env().Undefined();
    }

    Napi::Value GetLayerDebugState(const Napi::CallbackInfo &info)
    {
        if (info.Length() < 1 || !info[0].IsNumber())
            return info.Env().Null();

        const uint32_t entityId = info[0].As<Napi::Number>().Uint32Value();
        const WorldLayerDebugState *debug = core_->Layers.GetDebugState(entityId);
        if (!debug)
            return info.Env().Null();

        Napi::Env env = info.Env();
        Napi::Object out = Napi::Object::New(env);
        out.Set("tick", Napi::Number::New(env, debug->Tick));
        out.Set("entityId", Napi::Number::New(env, debug->EntityId));
        out.Set("sourceZ", Napi::Number::New(env, debug->SourceZ));
        out.Set("resolvedZ", Napi::Number::New(env, debug->ResolvedZ));
        out.Set("transitioned", Napi::Boolean::New(env, debug->Transitioned));
        out.Set("fell", Napi::Boolean::New(env, debug->Fell));
        out.Set("phase", Napi::String::New(env, debug->Phase));
        out.Set("reason", Napi::String::New(env, debug->Reason));

        Napi::Array samples = Napi::Array::New(env, debug->SupportSamples.size());
        for (uint32_t i = 0; i < debug->SupportSamples.size(); ++i)
        {
            const auto &sample = debug->SupportSamples[i];
            Napi::Object row = Napi::Object::New(env);
            row.Set("tileX", Napi::Number::New(env, sample.TileX));
            row.Set("tileY", Napi::Number::New(env, sample.TileY));
            row.Set("z", Napi::Number::New(env, sample.Z));
            row.Set("tileId", Napi::Number::New(env, sample.TileId));
            row.Set("support", Napi::Boolean::New(env, sample.Support));
            row.Set("fallThrough", Napi::Boolean::New(env, sample.FallThrough));
            row.Set("blocked", Napi::Boolean::New(env, sample.Blocked));
            samples.Set(i, row);
        }
        out.Set("supportSamples", samples);

        Napi::Array connectors = Napi::Array::New(env, debug->ConnectorCandidates.size());
        for (uint32_t i = 0; i < debug->ConnectorCandidates.size(); ++i)
        {
            const auto &candidate = debug->ConnectorCandidates[i];
            Napi::Object row = Napi::Object::New(env);
            row.Set("tileX", Napi::Number::New(env, candidate.TileX));
            row.Set("tileY", Napi::Number::New(env, candidate.TileY));
            row.Set("sourceZ", Napi::Number::New(env, candidate.SourceZ));
            row.Set("destinationZ", Napi::Number::New(env, candidate.DestinationZ));
            row.Set("type", Napi::Number::New(env, static_cast<uint8_t>(candidate.Type)));
            row.Set("triggerMinX", Napi::Number::New(env, candidate.TriggerMinX));
            row.Set("triggerMinY", Napi::Number::New(env, candidate.TriggerMinY));
            row.Set("triggerMaxX", Napi::Number::New(env, candidate.TriggerMaxX));
            row.Set("triggerMaxY", Napi::Number::New(env, candidate.TriggerMaxY));
            row.Set("allowedEnterDirectionMask", Napi::Number::New(env, candidate.AllowedEnterDirectionMask));
            row.Set("allowedMovementDirectionMask", Napi::Number::New(env, candidate.AllowedMovementDirectionMask));
            row.Set("triggerHit", Napi::Boolean::New(env, candidate.TriggerHit));
            row.Set("directionAllowed", Napi::Boolean::New(env, candidate.DirectionAllowed));
            row.Set("destinationSupportOk", Napi::Boolean::New(env, candidate.DestinationSupportOk));
            row.Set("destinationBlockedOk", Napi::Boolean::New(env, candidate.DestinationBlockedOk));
            row.Set("selected", Napi::Boolean::New(env, candidate.Selected));
            row.Set("accepted", Napi::Boolean::New(env, candidate.Accepted));
            row.Set("rejectionReason", Napi::String::New(env, candidate.RejectionReason));
            connectors.Set(i, row);
        }
        out.Set("connectorCandidates", connectors);

        Napi::Array landings = Napi::Array::New(env, debug->LandingCandidates.size());
        for (uint32_t i = 0; i < debug->LandingCandidates.size(); ++i)
        {
            const auto &candidate = debug->LandingCandidates[i];
            Napi::Object row = Napi::Object::New(env);
            row.Set("candidateZ", Napi::Number::New(env, candidate.CandidateZ));
            row.Set("supportOk", Napi::Boolean::New(env, candidate.SupportOk));
            row.Set("blocked", Napi::Boolean::New(env, candidate.Blocked));
            row.Set("accepted", Napi::Boolean::New(env, candidate.Accepted));
            landings.Set(i, row);
        }
        out.Set("landingCandidates", landings);

        return out;
    }

    Napi::Value GetLayerValidationIssues(const Napi::CallbackInfo &info)
    {
        const auto issues = core_->Layers.ValidateLoadedWorld(*core_->World.ChunkManager);
        Napi::Array result = Napi::Array::New(info.Env(), issues.size());
        for (uint32_t i = 0; i < issues.size(); ++i)
        {
            const auto &issue = issues[i];
            Napi::Object row = Napi::Object::New(info.Env());
            row.Set("tileX", Napi::Number::New(info.Env(), issue.TileX));
            row.Set("tileY", Napi::Number::New(info.Env(), issue.TileY));
            row.Set("tileZ", Napi::Number::New(info.Env(), issue.TileZ));
            row.Set("code", Napi::String::New(info.Env(), issue.Code));
            row.Set("message", Napi::String::New(info.Env(), issue.Message));
            result.Set(i, row);
        }
        return result;
    }
};

Napi::Object InitGameCore(Napi::Env env, Napi::Object exports)
{
    return GameWorldWrapper::Init(env, exports);
}

NODE_API_MODULE(gamecore, InitGameCore)

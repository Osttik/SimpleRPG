#include <napi.h>
#include "game/game-core.h"
#include "game/tile-registry.h"

class GameWorldWrapper : public Napi::ObjectWrap<GameWorldWrapper>
{
private:
  std::unique_ptr<GameCore> core_;

public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports)
  {
    Napi::Function func = DefineClass(env, "GameWorld", {
                                                            InstanceMethod("addPlayer", &GameWorldWrapper::AddPlayer),
                                                            InstanceMethod("removePlayer", &GameWorldWrapper::RemovePlayer),
                                                            InstanceMethod("addProp", &GameWorldWrapper::AddProp),
                                                            InstanceMethod("destroyProp", &GameWorldWrapper::DestroyProp),
                                                            InstanceMethod("destroyTile", &GameWorldWrapper::DestroyTile),
                                                            InstanceMethod("applyMovement", &GameWorldWrapper::ApplyMovement),
                                                            InstanceMethod("interact", &GameWorldWrapper::Interact),
                                                            InstanceMethod("transferItem", &GameWorldWrapper::TransferItem),
                                                            InstanceMethod("spawnTestChest", &GameWorldWrapper::SpawnTestChest),
                                                            InstanceMethod("tick", &GameWorldWrapper::Tick),
                                                            InstanceMethod("getChunk", &GameWorldWrapper::GetChunk),
                                                            InstanceMethod("getChunkVisuals", &GameWorldWrapper::GetChunkVisuals),
                                                            InstanceMethod("getState", &GameWorldWrapper::GetState),
                                                            InstanceMethod("getTileRegistry", &GameWorldWrapper::GetTileRegistry),
                                                            InstanceMethod("setTileRegistry", &GameWorldWrapper::SetTileRegistry),
                                                        });
    exports.Set("GameWorld", func);
    return exports;
  }

  GameWorldWrapper(const Napi::CallbackInfo &info) : Napi::ObjectWrap<GameWorldWrapper>(info)
  {
    core_ = std::make_unique<GameCore>();
  }

private:
  Napi::Value AddPlayer(const Napi::CallbackInfo &info)
  {
    if (info.Length() < 4)
    {
      Napi::TypeError::New(info.Env(), "Requires: id, x, y, radius").ThrowAsJavaScriptException();
      return info.Env().Null();
    }
    core_->AddPlayer(
        info[0].As<Napi::String>().Utf8Value(),
        info[1].As<Napi::Number>().DoubleValue(),
        info[2].As<Napi::Number>().DoubleValue(),
        info[3].As<Napi::Number>().DoubleValue());
    return info.Env().Undefined();
  }

  Napi::Value RemovePlayer(const Napi::CallbackInfo &info)
  {
    if (info.Length() < 1)
      return info.Env().Null();
    core_->RemovePlayer(info[0].As<Napi::String>().Utf8Value());
    return info.Env().Undefined();
  }

  Napi::Value AddProp(const Napi::CallbackInfo &info)
  {
    if (info.Length() < 5)
      return info.Env().Null();
    core_->AddProp(
        info[0].As<Napi::String>().Utf8Value(),
        info[1].As<Napi::Number>().DoubleValue(),
        info[2].As<Napi::Number>().DoubleValue(),
        info[3].As<Napi::Number>().DoubleValue(),
        info[4].As<Napi::Number>().Int32Value());
    return info.Env().Undefined();
  }

  Napi::Value DestroyProp(const Napi::CallbackInfo &info)
  {
    if (info.Length() < 1)
      return info.Env().Null();
    core_->DestroyProp(info[0].As<Napi::String>().Utf8Value());
    return info.Env().Undefined();
  }

  Napi::Value ApplyMovement(const Napi::CallbackInfo &info)
  {
    if (info.Length() < 4)
      return info.Env().Null();
    core_->ApplyMovement(
        info[0].As<Napi::String>().Utf8Value(),
        info[1].As<Napi::Number>().DoubleValue(),
        info[2].As<Napi::Number>().DoubleValue(),
        info[3].As<Napi::Number>().DoubleValue());
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

  Napi::Value SpawnTestChest(const Napi::CallbackInfo &info)
  {
    core_->SpawnTestChest();
    return info.Env().Undefined();
  }

  Napi::Value Interact(const Napi::CallbackInfo &info)
  {
    if (info.Length() < 1)
      return info.Env().Null();
    std::string result = core_->Interact(info[0].As<Napi::String>().Utf8Value());
    return Napi::String::New(info.Env(), result);
  }

  Napi::Value TransferItem(const Napi::CallbackInfo &info)
  {
    if (info.Length() < 5)
      return info.Env().Null();
    bool success = core_->TransferItem(
        info[0].As<Napi::String>().Utf8Value(),
        info[1].As<Napi::String>().Utf8Value(),
        info[2].As<Napi::Number>().Int32Value(),
        info[3].As<Napi::Number>().Int32Value(),
        info[4].As<Napi::Number>().Int32Value()
    );
    return Napi::Boolean::New(info.Env(), success);
  }

  Napi::Value Tick(const Napi::CallbackInfo &info)
  {
    core_->Tick();
    return info.Env().Undefined();
  }

  Napi::Value GetChunk(const Napi::CallbackInfo &info)
  {
    if (info.Length() < 3)
      return info.Env().Null();
    Chunk *chunk = core_->World.GetChunkSafely(
        info[0].As<Napi::Number>().Int32Value(),
        info[1].As<Napi::Number>().Int32Value(),
        info[2].As<Napi::Number>().Int32Value());
    if (!chunk)
      return info.Env().Null();
    return Napi::Buffer<uint8_t>::Copy(info.Env(), reinterpret_cast<uint8_t *>(chunk->tiles), CHUNK_VOLUME * sizeof(uint16_t));
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
        def.collide = obj.Has("collide") ? obj.Get("collide").As<Napi::Boolean>().Value() : false;
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

    // Populate Players map
    for (const auto &[id, record] : core_->World.Players)
    {
      Napi::Object pData = Napi::Object::New(env);
      pData.Set("x", Napi::Number::New(env, static_cast<double>(record.Object->Transform.Position.X)));
      pData.Set("y", Napi::Number::New(env, static_cast<double>(record.Object->Transform.Position.Y)));
      pData.Set("radius", Napi::Number::New(env, static_cast<double>(record.Radius)));
      pData.Set("z", Napi::Number::New(env, record.Object->ChunkZ));

      std::string idStr = "";
      if (record.Object->FocusedObjectId != 0) {
        for (const auto& [pid, pRec] : core_->World.Players) 
            if (pRec.PhysicsId == record.Object->FocusedObjectId) { idStr = pid; break; }
        if (idStr.empty()) {
            for (const auto& [pid, pRec] : core_->World.Props) 
                if (pRec.PhysicsId == record.Object->FocusedObjectId) { idStr = pid; break; }
        }
      }
      pData.Set("focusedId", Napi::String::New(env, idStr));
      pData.Set("type", Napi::String::New(env, "player"));

      players.Set(id, pData);
    }

    // Populate Props map into players map
    for (const auto &[id, record] : core_->World.Props)
    {
      Napi::Object pData = Napi::Object::New(env);
      pData.Set("x", Napi::Number::New(env, static_cast<double>(record.Object->Transform.Position.X)));
      pData.Set("y", Napi::Number::New(env, static_cast<double>(record.Object->Transform.Position.Y)));
      pData.Set("radius", Napi::Number::New(env, static_cast<double>(record.Radius)));
      pData.Set("z", Napi::Number::New(env, record.Object->ChunkZ));
      pData.Set("type", Napi::String::New(env, record.Object->Type));
      players.Set(id, pData);
    }

    // Populate Destroyed array
    for (size_t i = 0; i < core_->World.RecentlyDestroyed.size(); ++i)
    {
      destroyed.Set(i, Napi::String::New(env, core_->World.RecentlyDestroyed[i]));
    }

    state.Set("players", players);
    state.Set("destroyed", destroyed);
    return state;
  }
};

Napi::Object InitGameCore(Napi::Env env, Napi::Object exports)
{
  return GameWorldWrapper::Init(env, exports);
}

NODE_API_MODULE(gamecore, InitGameCore)
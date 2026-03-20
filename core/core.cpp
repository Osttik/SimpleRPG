#include <napi.h>
#include <unordered_map>
#include <memory>
#include <fpm/fixed.hpp>
#include <fpm/math.hpp>
#include "game/game-object-physics.h"
#include "game/game-object.h"
#include "math/rect.h"
#include "math/number.h"
#include "game/world.h"
#include "game/tile-registry.h"

class GameWorldWrapper : public Napi::ObjectWrap<GameWorldWrapper> {
public:
  static Napi::Function GetClass(Napi::Env env) {
    return DefineClass(env, "GameWorld", {
      InstanceMethod("addPlayer", &GameWorldWrapper::AddPlayer),
      InstanceMethod("removePlayer", &GameWorldWrapper::RemovePlayer),
      InstanceMethod("addProp", &GameWorldWrapper::AddProp),
      InstanceMethod("destroyProp", &GameWorldWrapper::DestroyProp),
      InstanceMethod("destroyTile", &GameWorldWrapper::DestroyTile),
      InstanceMethod("applyMovement", &GameWorldWrapper::ApplyMovement),
      InstanceMethod("tick", &GameWorldWrapper::Tick),
      InstanceMethod("getChunk", &GameWorldWrapper::GetChunk),
      InstanceMethod("getChunkVisuals", &GameWorldWrapper::GetChunkVisuals),
      InstanceMethod("getState", &GameWorldWrapper::GetState),
      InstanceMethod("getTileRegistry", &GameWorldWrapper::GetTileRegistry),
      InstanceMethod("setTileRegistry", &GameWorldWrapper::SetTileRegistry),
    });
  }

  static Napi::Object Init(Napi::Env env, Napi::Object exports) {
    Napi::Function func = GetClass(env);
    exports.Set("GameWorld", func);
    return exports;
  }

  GameWorldWrapper(const Napi::CallbackInfo &info)
      : Napi::ObjectWrap<GameWorldWrapper>(info) {
    this->physics_ = std::make_unique<GameObjectPhysics>();
    this->world_ = std::make_unique<WorldManager>();
  }

private:
  Napi::Value SetTileRegistry(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1 || !info[0].IsArray()) {
      Napi::TypeError::New(env, "setTileRegistry requires 1 argument: array of tile objects")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    Napi::Array registryArray = info[0].As<Napi::Array>();
    uint32_t length = registryArray.Length();

    for (uint32_t i = 0; i < length; i++) {
        Napi::Value val = registryArray[i];
        if (val.IsObject()) {
            Napi::Object obj = val.As<Napi::Object>();
            uint16_t id = obj.Get("id").As<Napi::Number>().Uint32Value();
            std::string name = obj.Get("name").As<Napi::String>().Utf8Value();
            bool collide = false;
            if (obj.Has("collide")) {
                collide = obj.Get("collide").As<Napi::Boolean>().Value();
            }
            TileRegistry::RegisterTile(id, name, collide);
        }
    }
    return env.Undefined();
  }

  std::unique_ptr<GameObjectPhysics> physics_;
  std::unique_ptr<WorldManager> world_;
  std::unordered_map<std::string, GameObject*> playerObjects_;
  std::unordered_map<GameObject*, std::string> playerIds_;
  std::unordered_map<std::string, GameObject*> propObjects_;
  std::unordered_map<std::string, float32> propRadius_;
  std::unordered_map<std::string, unsigned int> propPhysicsIds_;
  std::unordered_map<std::string, float32> playerRadius_;
  std::unordered_map<std::string, unsigned int> playerPhysicsIds_;

  Napi::Value AddPlayer(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 4) {
      Napi::TypeError::New(env, "addPlayer requires 4 arguments: id, x, y, radius")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string id = info[0].As<Napi::String>();
    double x = info[1].As<Napi::Number>().DoubleValue();
    double y = info[2].As<Napi::Number>().DoubleValue();
    double radius = info[3].As<Napi::Number>().DoubleValue();

    float32 fx(x);
    float32 fy(y);
    float32 fradius(radius);

    Point position(fx, fy);
    TransformData transform(position);

    auto circle = std::make_unique<Circle>(position, fradius);

    GameObject* obj = new GameObject(transform, std::move(circle));
    obj->ChunkZ = 1;

    playerObjects_[id] = obj;
    playerIds_[obj] = id;
    playerRadius_[id] = fradius;

    unsigned int physicsId = physics_->AddObject(obj);
    playerPhysicsIds_[id] = physicsId;

    return env.Undefined();
  }

  Napi::Value AddProp(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 5) {
      Napi::TypeError::New(env, "addProp requires 5 arguments: id, x, y, radius, z")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string id = info[0].As<Napi::String>();
    double x = info[1].As<Napi::Number>().DoubleValue();
    double y = info[2].As<Napi::Number>().DoubleValue();
    double radius = info[3].As<Napi::Number>().DoubleValue();
    int32_t z = info[4].As<Napi::Number>().Int32Value();

    float32 fx(x);
    float32 fy(y);
    float32 fradius(radius);

    Point position(fx, fy);
    TransformData transform(position);
    auto circle = std::make_unique<Circle>(position, fradius);

    GameObject* obj = new GameObject(transform, std::move(circle));
    obj->IsStaticProp = true;
    obj->ChunkZ = z;

    propObjects_[id] = obj;
    propRadius_[id] = fradius;

    unsigned int physicsId = physics_->AddObject(obj);
    propPhysicsIds_[id] = physicsId;

    return env.Undefined();
  }

  Napi::Value RemovePlayer(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 1) {
      Napi::TypeError::New(env, "removePlayer requires 1 argument: id")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string id = info[0].As<Napi::String>();

    auto it = playerObjects_.find(id);
    if (it != playerObjects_.end()) {
      GameObject* obj = it->second;

      auto physIt = playerPhysicsIds_.find(id);
      if (physIt != playerPhysicsIds_.end()) {
        physics_->RemoveObject(physIt->second);
        playerPhysicsIds_.erase(physIt);
      }

      playerIds_.erase(obj);
      playerRadius_.erase(id);
      playerObjects_.erase(it);
      delete obj;
    }

    return env.Undefined();
  }

  Napi::Value ApplyMovement(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 4) {
      Napi::TypeError::New(env, "applyMovement requires 4 arguments: id, dx, dy, speed")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    std::string id = info[0].As<Napi::String>();
    double dx = info[1].As<Napi::Number>().DoubleValue();
    double dy = info[2].As<Napi::Number>().DoubleValue();
    double speed = info[3].As<Napi::Number>().DoubleValue();

    auto it = playerObjects_.find(id);
    if (it == playerObjects_.end()) {
      return env.Undefined();
    }

    GameObject* obj = it->second;

    obj->Transform.Position.X += float32(dx * speed);
    obj->Transform.Position.Y += float32(dy * speed);

    Circle* circle = dynamic_cast<Circle*>(obj->BoundingBox.get());
    if (circle) {
      circle->Center = obj->Transform.Position;
    }

    auto physIt = playerPhysicsIds_.find(id);
    if (physIt != playerPhysicsIds_.end()) {
      physics_->UpdateObject(physIt->second);
    }

    return env.Undefined();
  }

  Napi::Value DestroyProp(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (info.Length() < 1) return env.Null();

    std::string id = info[0].As<Napi::String>();
    auto it = propObjects_.find(id);
    if (it != propObjects_.end()) {
        it->second->IsPendingDestruction = true;
        // The object will be removed during the next State/Cleanup
    }
    return env.Undefined();
  }

  Napi::Value DestroyTile(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    if (info.Length() < 3) return env.Null();

    int32_t wx = info[0].As<Napi::Number>().Int32Value();
    int32_t wy = info[1].As<Napi::Number>().Int32Value();
    int32_t wz = info[2].As<Napi::Number>().Int32Value();

    Chunk* chunk = world_->GetChunk(
        static_cast<int32_t>(std::floor(static_cast<double>(wx) / CHUNK_SIZE)),
        static_cast<int32_t>(std::floor(static_cast<double>(wy) / CHUNK_SIZE)),
        static_cast<int32_t>(std::floor(static_cast<double>(wz) / CHUNK_SIZE))
    );

    if (chunk) {
        int32_t lx = wx % CHUNK_SIZE; if (lx < 0) lx += CHUNK_SIZE;
        int32_t ly = wy % CHUNK_SIZE; if (ly < 0) ly += CHUNK_SIZE;
        int32_t lz = wz % CHUNK_SIZE; if (lz < 0) lz += CHUNK_SIZE;
        int index = lx + ly * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
        chunk->tiles[index] = 0;
        world_->NotifyTileChanged(wx, wy, wz);
    }

    return env.Undefined();
  }

  Napi::Value Tick(const Napi::CallbackInfo &info) {
    physics_->Tick(world_.get());
    return info.Env().Undefined();
  }

  Napi::Value GetChunk(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
      Napi::TypeError::New(env, "getChunk requires 3 arguments: cx, cy, cz")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    int32_t cx = info[0].As<Napi::Number>().Int32Value();
    int32_t cy = info[1].As<Napi::Number>().Int32Value();
    int32_t cz = info[2].As<Napi::Number>().Int32Value();

    Chunk* chunk = world_->GetChunk(cx, cy, cz);

    if (!chunk) {
      return env.Null();
    }

    Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(env, reinterpret_cast<uint8_t*>(chunk->tiles), CHUNK_VOLUME * sizeof(uint16_t));
    return buffer;
  }

  Napi::Value GetChunkVisuals(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    if (info.Length() < 3) {
      Napi::TypeError::New(env, "getChunkVisuals requires 3 arguments: cx, cy, cz")
          .ThrowAsJavaScriptException();
      return env.Null();
    }

    int32_t cx = info[0].As<Napi::Number>().Int32Value();
    int32_t cy = info[1].As<Napi::Number>().Int32Value();
    int32_t cz = info[2].As<Napi::Number>().Int32Value();

    Chunk* chunk = world_->GetChunk(cx, cy, cz);

    if (!chunk) {
      return env.Null();
    }

    Napi::Buffer<uint8_t> buffer = Napi::Buffer<uint8_t>::Copy(env, reinterpret_cast<uint8_t*>(chunk->visual_mask_layer), CHUNK_VOLUME * sizeof(uint8_t));
    return buffer;
  }

  Napi::Value GetTileRegistry(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();
    auto map = TileRegistry::GetAllTiles();
    Napi::Object obj = Napi::Object::New(env);
    for (const auto& [id, name] : map) {
      obj.Set(std::to_string(id), Napi::String::New(env, name));
    }
    return obj;
  }

  Napi::Value GetState(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    Napi::Object state = Napi::Object::New(env);
    Napi::Object players = Napi::Object::New(env);
    Napi::Array destroyed = Napi::Array::New(env);
    uint32_t destroyedIdx = 0;

    // Players
    for (auto it = playerObjects_.begin(); it != playerObjects_.end(); ) {
      GameObject* obj = it->second;
      std::string id = it->first;

      if (obj->IsPendingDestruction) {
        destroyed.Set(destroyedIdx++, Napi::String::New(env, id));
        
        physics_->RemoveObject(playerPhysicsIds_[id]);
        playerPhysicsIds_.erase(id);
        playerIds_.erase(obj);
        playerRadius_.erase(id);
        it = playerObjects_.erase(it);
        delete obj;
        continue;
      }

      Napi::Object playerData = Napi::Object::New(env);
      playerData.Set("x", Napi::Number::New(env, static_cast<double>(obj->Transform.Position.X)));
      playerData.Set("y", Napi::Number::New(env, static_cast<double>(obj->Transform.Position.Y)));
      playerData.Set("radius", Napi::Number::New(env, static_cast<double>(playerRadius_[id])));
      playerData.Set("z", Napi::Number::New(env, obj->ChunkZ));

      players.Set(id, playerData);
      ++it;
    }

    // Props
    for (auto it = propObjects_.begin(); it != propObjects_.end(); ) {
      GameObject* obj = it->second;
      std::string id = it->first;

      if (obj->IsPendingDestruction) {
        destroyed.Set(destroyedIdx++, Napi::String::New(env, id));
        
        physics_->RemoveObject(propPhysicsIds_[id]);
        propPhysicsIds_.erase(id);
        propRadius_.erase(id);
        it = propObjects_.erase(it);
        delete obj;
        continue;
      }
      ++it;
    }

    state.Set("players", players);
    state.Set("destroyed", destroyed);

    return state;
  }

private:
  std::vector<GameObject*> GetAllPlayers() const {
    std::vector<GameObject*> result;
    for (const auto& [id, obj] : playerObjects_) {
      result.push_back(obj);
    }
    return result;
  }

  void ResolveCircleCollision(GameObject* objA, GameObject* objB) {
    Circle* circleA = dynamic_cast<Circle*>(const_cast<Shape*>(objA->BoundingBox.get()));
    Circle* circleB = dynamic_cast<Circle*>(const_cast<Shape*>(objB->BoundingBox.get()));

    if (!circleA || !circleB) return;

    float32 dx = circleB->Center.X - circleA->Center.X;
    float32 dy = circleB->Center.Y - circleA->Center.Y;
    float32 minDist = circleA->Radius + circleB->Radius;

    float32 absDx = dx < float32(0) ? float32(0) - dx : dx;
    float32 absDy = dy < float32(0) ? float32(0) - dy : dy;
    if (absDx > minDist || absDy > minDist) return;

    float32 distSquared = dx * dx + dy * dy;
    float32 dist = fpm::sqrt(distSquared);

    if (dist == float32(0)) {
      dist = float32(0.0001);
    }

    float32 normalX = dx / dist;
    float32 normalY = dy / dist;

    float32 overlap = minDist - dist;

    float32 pushDistance = overlap / float32(2);

    objA->Transform.Position = Point(
        circleA->Center.X - normalX * pushDistance,
        circleA->Center.Y - normalY * pushDistance
    );
    objB->Transform.Position = Point(
        circleB->Center.X + normalX * pushDistance,
        circleB->Center.Y + normalY * pushDistance
    );

    circleA->Center = objA->Transform.Position;
    circleB->Center = objB->Transform.Position;
  }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  return GameWorldWrapper::Init(env, exports);
}

NODE_API_MODULE(gamecore, Init)
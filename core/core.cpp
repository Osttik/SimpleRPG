#include <napi.h>

Napi::String HelloWorld(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  return Napi::String::New(env, "RPG Core C++ Initialized!");
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "hello"),
              Napi::Function::New(env, HelloWorld));
  return exports;
}

NODE_API_MODULE(gamecore, Init)
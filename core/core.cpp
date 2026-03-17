#include <napi.h>


Napi::String HelloWorld(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  return Napi::String::New(env, "Hello World!");
}

Napi::String GoodNightWorld(const Napi::CallbackInfo &info) {
  Napi::Env env = info.Env();
  return Napi::String::New(env, "Good Night World!");
}


Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "hello"),
              Napi::Function::New(env, HelloWorld));

  exports.Set(Napi::String::New(env, "goodNight"),
              Napi::Function::New(env, GoodNightWorld));

  
  return exports;
}


NODE_API_MODULE(gamecore, Init)
cmake_minimum_required(VERSION 3.15)
project(SimpleRPG)

set(CMAKE_MESSAGE_LOG_LEVEL STATUS)

if(POLICY CMP0135)
  cmake_policy(SET CMP0135 NEW)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(BUILD_TESTING OFF CACHE BOOL "Disable tests" FORCE)
set(FPM_BUILD_TESTS OFF CACHE BOOL "Disable FPM tests" FORCE)
set(FPM_BUILD_BENCHMARKS OFF CACHE BOOL "Disable FPM benchmarks" FORCE)
set(FPM_BUILD_EXAMPLES OFF CACHE BOOL "Disable FPM examples" FORCE)
set(BOOST_BUILD_TESTS OFF CACHE BOOL "Disable Boost tests" FORCE)
set(BOOST_ENABLE_CMAKE ON CACHE BOOL "Enable Boost CMake" FORCE)
set(protobuf_BUILD_TESTS OFF CACHE BOOL "Disable Protobuf tests" FORCE)

include(FetchContent)

# - FPM (Fixed Point Math)
fetchcontent_declare(
  fpm
  GIT_REPOSITORY https://github.com/MikeLankamp/fpm.git
  GIT_TAG v1.0.1
)

# - Robin-Hood (Hashing)
fetchcontent_declare(
  robin_hood
  GIT_REPOSITORY https://github.com/martinus/robin-hood-hashing.git
  GIT_TAG 3.11.5
)

# - BOOST
fetchcontent_declare(
  Boost
  URL https://github.com/boostorg/boost/releases/download/boost-1.84.0/boost-1.84.0.tar.gz
  URL_HASH SHA256=4d27e9efed0f6f152dc28db6430b9d3dfb40c0345da7342eaa5a987dde57bd95
)

# - PROTOBUF
option(SIMPLERPG_USE_PROTOBUF "Enable protobuf" ON)
if(SIMPLERPG_USE_PROTOBUF)
  fetchcontent_declare(
    protobuf
    GIT_REPOSITORY https://github.com/protocolbuffers/protobuf.git
    GIT_TAG v25.3
  )
  set(protobuf_BUILD_PROTOC_BINARIES ON CACHE BOOL "" FORCE)
  set(protobuf_INSTALL OFF CACHE BOOL "" FORCE)
  fetchcontent_makeavailable(protobuf)
endif()

fetchcontent_makeavailable(robin_hood)

fetchcontent_getproperties(fpm)
if(NOT fpm_POPULATED)
  fetchcontent_populate(fpm)
  add_subdirectory(${fpm_SOURCE_DIR} ${fpm_BINARY_DIR} EXCLUDE_FROM_ALL)
endif()

fetchcontent_getproperties(Boost)
if(NOT boost_POPULATED)
  fetchcontent_populate(Boost)
  add_subdirectory(${boost_SOURCE_DIR} ${boost_BINARY_DIR} EXCLUDE_FROM_ALL)
endif()

file(GLOB_RECURSE CORE_SOURCES "engine/src/*.cpp")
list(REMOVE_ITEM CORE_SOURCES "${CMAKE_SOURCE_DIR}/engine/core.cpp")
list(REMOVE_ITEM CORE_SOURCES "${CMAKE_SOURCE_DIR}/engine/frontend.cpp")

if(SIMPLERPG_USE_PROTOBUF)
  file(GLOB PROTO_GENERATED_SOURCES "engine/generated/*.pb.cc")
endif()

add_library(game_logic STATIC ${CORE_SOURCES} ${PROTO_GENERATED_SOURCES})
target_include_directories(game_logic PUBLIC "engine/headers")

if(EXISTS "${CMAKE_SOURCE_DIR}/engine/generated")
  target_include_directories(game_logic PUBLIC "engine/generated")
endif()

target_link_libraries(game_logic PUBLIC
  fpm
  robin_hood
  Boost::headers
)

if(SIMPLERPG_USE_PROTOBUF)
  target_link_libraries(game_logic PUBLIC protobuf::libprotobuf)
endif()

if(NOT EMSCRIPTEN)
  target_link_libraries(game_logic PUBLIC Boost::container)
  add_library(gamecore_node SHARED "engine/core.cpp")
  target_include_directories(gamecore_node PRIVATE ${CMAKE_JS_INC} "${CMAKE_SOURCE_DIR}/node_modules/node-addon-api")
  target_link_libraries(gamecore_node PRIVATE game_logic ${CMAKE_JS_LIB})
  set_target_properties(gamecore_node PROPERTIES PREFIX "" SUFFIX ".node" OUTPUT_NAME "gamecore")
  target_compile_definitions(gamecore_node PRIVATE NAPI_DISABLE_CPP_EXCEPTIONS)
endif()

if(EMSCRIPTEN)
  add_executable(gamecore_wasm "engine/frontend.cpp")
  target_link_libraries(gamecore_wasm PRIVATE game_logic)
  set_target_properties(gamecore_wasm PROPERTIES OUTPUT_NAME "gamecore_wasm" SUFFIX ".js")
  target_link_options(gamecore_wasm PRIVATE "--bind" "-sWASM_BIGINT" "-sMODULARIZE=1" "-sEXPORT_ES6=1" "-sALLOW_MEMORY_GROWTH=1")
endif()

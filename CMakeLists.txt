cmake_minimum_required(VERSION 3.28)

set(CMAKE_MESSAGE_LOG_LEVEL NOTICE)
set(FETCHCONTENT_QUIET ON)

set(CMAKE_THREAD_LIBS_INIT "-lpthread")
set(CMAKE_HAVE_THREADS_LIBRARY 1)
set(CMAKE_USE_WIN32_THREADS_INIT 1)
set(CMAKE_HP_PTHREADS_INIT 0)
set(CMAKE_USE_PTHREADS_INIT 1)

project(SimpleRPG)

if(POLICY CMP0135)
  cmake_policy(SET CMP0135 NEW)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(BUILD_TESTING OFF CACHE BOOL "" FORCE)
set(FPM_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(FPM_BUILD_BENCHMARKS OFF CACHE BOOL "" FORCE)
set(FPM_BUILD_EXAMPLES OFF CACHE BOOL "" FORCE)
set(BOOST_BUILD_TESTS OFF CACHE BOOL "" FORCE)
set(BOOST_INCLUDE_TESTS OFF CACHE BOOL "" FORCE)
set(BOOST_ENABLE_CMAKE ON CACHE BOOL "" FORCE)

if(MSVC)
  add_compile_options(/W0 /wd4996)
else()
  add_compile_options(-w -Wno-deprecated-builtins -Wno-deprecated-declarations)
endif()

include(FetchContent)

fetchcontent_declare(fpm GIT_REPOSITORY https://github.com/MikeLankamp/fpm.git GIT_TAG v1.0.1 EXCLUDE_FROM_ALL)
fetchcontent_declare(robin_hood GIT_REPOSITORY https://github.com/martinus/robin-hood-hashing.git GIT_TAG 3.11.5 EXCLUDE_FROM_ALL)
fetchcontent_declare(Boost URL https://github.com/boostorg/boost/releases/download/boost-1.84.0/boost-1.84.0.tar.gz URL_HASH SHA256=4d27e9efed0f6f152dc28db6430b9d3dfb40c0345da7342eaa5a987dde57bd95 EXCLUDE_FROM_ALL)

# FlatBuffers — header-only C++ library (flatbuffers/flatbuffers.h).
# The flatc compiler is an external tool; see schema/generate.ps1.
# We disable all build targets so only the source (headers) is fetched.
set(FLATBUFFERS_BUILD_TESTS     OFF CACHE BOOL "" FORCE)
set(FLATBUFFERS_BUILD_FLATC     OFF CACHE BOOL "" FORCE)
set(FLATBUFFERS_BUILD_FLATLIB   OFF CACHE BOOL "" FORCE)
set(FLATBUFFERS_BUILD_SHAREDLIB OFF CACHE BOOL "" FORCE)
set(FLATBUFFERS_INSTALL         OFF CACHE BOOL "" FORCE)
fetchcontent_declare(flatbuffers
  GIT_REPOSITORY https://github.com/google/flatbuffers.git
  GIT_TAG v24.3.25
  EXCLUDE_FROM_ALL
)

fetchcontent_makeavailable(fpm robin_hood Boost flatbuffers)

file(GLOB_RECURSE CORE_SOURCES CONFIGURE_DEPENDS "engine/src/*.cpp")
list(REMOVE_ITEM CORE_SOURCES "${CMAKE_SOURCE_DIR}/engine/core.cpp")
list(REMOVE_ITEM CORE_SOURCES "${CMAKE_SOURCE_DIR}/engine/frontend.cpp")

add_library(game_logic STATIC ${CORE_SOURCES})

target_include_directories(game_logic PUBLIC
  "engine/headers"
  "engine/generated"
  "${flatbuffers_SOURCE_DIR}/include"
)

target_link_libraries(game_logic PUBLIC fpm robin_hood Boost::headers)

if(NOT EMSCRIPTEN)
  target_link_libraries(game_logic PUBLIC Boost::container)
  add_library(gamecore_node SHARED "engine/core.cpp")
  target_include_directories(gamecore_node PRIVATE ${CMAKE_JS_INC} "${CMAKE_SOURCE_DIR}/node_modules/node-addon-api")
  target_link_libraries(gamecore_node PRIVATE game_logic ${CMAKE_JS_LIB})
  set_target_properties(gamecore_node PROPERTIES PREFIX "" SUFFIX ".node" OUTPUT_NAME "gamecore")
  target_compile_definitions(gamecore_node PRIVATE NAPI_DISABLE_CPP_EXCEPTIONS)

  enable_testing()
  add_executable(game_logic_tests "engine/tests/world-layer-system-tests.cpp")
  target_include_directories(game_logic_tests PRIVATE
    "engine/headers"
    "engine/generated"
    "${flatbuffers_SOURCE_DIR}/include"
  )
  target_link_libraries(game_logic_tests PRIVATE game_logic)
  add_test(NAME game_logic_tests COMMAND game_logic_tests)

  add_executable(terrain_system_tests "engine/tests/terrain-destruction-tests.cpp")
  target_include_directories(terrain_system_tests PRIVATE
    "engine/headers"
    "engine/generated"
    "${flatbuffers_SOURCE_DIR}/include"
  )
  target_link_libraries(terrain_system_tests PRIVATE game_logic)
  add_test(NAME terrain_system_tests COMMAND terrain_system_tests)
endif()

if(EMSCRIPTEN)
  add_executable(gamecore_wasm "engine/frontend.cpp")
  target_link_libraries(gamecore_wasm PRIVATE game_logic)
  set_target_properties(gamecore_wasm PROPERTIES OUTPUT_NAME "gamecore_wasm" SUFFIX ".js")

  target_compile_options(gamecore_wasm PRIVATE -fexceptions -frtti)
  target_link_options(gamecore_wasm PRIVATE
    "--bind" "-sWASM_BIGINT" "-sMODULARIZE=1" "-sEXPORT_ES6=1"
    "-sALLOW_MEMORY_GROWTH=1" "-sFILESYSTEM=0" "-fexceptions" "-frtti"
  )
endif()

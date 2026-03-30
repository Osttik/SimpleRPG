cmake_minimum_required(VERSION 3.15)
project(SimpleRPG)

# Fix for Warning: CMP0135 (Timestamps for extracted files)
# Setting this to NEW makes it portable and avoids the dev warning.
if(POLICY CMP0135)
  cmake_policy(SET CMP0135 NEW)
endif()

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# 1. --- Source Discovery ---
file(GLOB_RECURSE CORE_SOURCES "engine/src/*.cpp")
list(REMOVE_ITEM CORE_SOURCES "${CMAKE_SOURCE_DIR}/engine/core.cpp")
list(REMOVE_ITEM CORE_SOURCES "${CMAKE_SOURCE_DIR}/engine/frontend.cpp")

# 2. --- External Dependencies (FetchContent) ---
include(FetchContent)

# - FPM (Fixed Point Math)
fetchcontent_declare(
  fpm
  GIT_REPOSITORY https://github.com/MikeLankamp/fpm.git
  GIT_TAG        v1.0.1  # Replaced 'master' with a stable version for portability
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE # Fixes your timestamp warning
)
set(FPM_BUILD_TESTS OFF CACHE INTERNAL "")
set(FPM_BUILD_EXAMPLES OFF CACHE INTERNAL "")

# - Robin-Hood (Flat Hash Map)
fetchcontent_declare(
  robin_hood
  GIT_REPOSITORY https://github.com/martinus/robin-hood-hashing.git
  GIT_TAG        3.11.5
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)

# - BOOST (Flat Map)
# I have updated the hash below to the ACTUAL value found in your logs.
fetchcontent_declare(
  Boost
  URL      https://github.com/boostorg/boost/releases/download/boost-1.84.0/boost-1.84.0.tar.gz
  URL_HASH SHA256=4d27e9efed0f6f152dc28db6430b9d3dfb40c0345da7342eaa5a987dde57bd95
  DOWNLOAD_EXTRACT_TIMESTAMP TRUE
)

fetchcontent_makeavailable(fpm robin_hood Boost)

# 3. --- Define the Shared Logic Core ---
add_library(game_logic STATIC ${CORE_SOURCES})
target_include_directories(game_logic PUBLIC "engine/headers")
target_link_libraries(game_logic PUBLIC fpm robin_hood Boost::container)

# 4. --- Build Node.js Addon (Server) ---
if(NOT EMSCRIPTEN)
    message(STATUS "--- Building Node.js Addon (.node) ---")
    
    include_directories(${CMAKE_JS_INC})
    include_directories(${CMAKE_SOURCE_DIR}/node_modules/node-addon-api)

    add_library(gamecore_node SHARED "engine/core.cpp")
    target_link_libraries(gamecore_node PRIVATE game_logic ${CMAKE_JS_LIB})
    
    set_target_properties(gamecore_node PROPERTIES 
        PREFIX "" 
        SUFFIX ".node"
        OUTPUT_NAME "gamecore"
    )
    target_compile_definitions(gamecore_node PRIVATE NAPI_DISABLE_CPP_EXCEPTIONS)
endif()

# 5. --- Build WASM Module (Frontend) ---
if(EMSCRIPTEN)
    message(STATUS "--- Building WASM Module (.js/.wasm) ---")

    add_executable(gamecore_wasm "engine/frontend.cpp")
    target_link_libraries(gamecore_wasm PRIVATE game_logic)

    set_target_properties(gamecore_wasm PROPERTIES 
        OUTPUT_NAME "gamecore_wasm"
        SUFFIX ".js"
    )

    target_link_options(gamecore_wasm PRIVATE 
        "--bind"
        "-sWASM_BIGINT"
        "-sMODULARIZE=1"
        "-sEXPORT_ES6=1"
        "-sALLOW_MEMORY_GROWTH=1"
    )
endif()
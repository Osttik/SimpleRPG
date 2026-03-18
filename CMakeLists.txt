cmake_minimum_required(VERSION 3.15)
project(gamecore)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
include_directories(${CMAKE_JS_INC})
include_directories("core/headers")

include_directories(${CMAKE_SOURCE_DIR}/node_modules/node-addon-api)

file(GLOB_RECURSE SOURCE_FILES "core/*.cpp")

include(FetchContent)

FetchContent_Declare(
  fpm
  GIT_REPOSITORY https://github.com/MikeLankamp/fpm.git
  GIT_TAG        master 
)

FetchContent_MakeAvailable(fpm)

add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES})

set_target_properties(${PROJECT_NAME} PROPERTIES
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
    PREFIX ""
    SUFFIX ".node"
)

target_compile_definitions(${PROJECT_NAME} PRIVATE NAPI_DISABLE_CPP_EXCEPTIONS)

target_link_libraries(${PROJECT_NAME} PRIVATE fpm ${CMAKE_JS_LIB})
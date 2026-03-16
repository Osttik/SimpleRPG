cmake_minimum_required(VERSION 3.15)
project(gamecore)

set(CMAKE_EXPORT_COMPILE_COMMANDS ON)
# 1. Grab the include directories that cmake-js downloads automatically
include_directories(${CMAKE_JS_INC})

# 2. Dynamically ask Node where the node-addon-api headers are
execute_process(COMMAND node -p "require('node-addon-api').include"
                WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
                OUTPUT_VARIABLE NODE_ADDON_API_DIR
                OUTPUT_STRIP_TRAILING_WHITESPACE)
# Clean up any quotes
string(REPLACE "\"" "" NODE_ADDON_API_DIR ${NODE_ADDON_API_DIR})
include_directories(${NODE_ADDON_API_DIR})

# 3. Compile the C++ file into a shared library
file(GLOB SOURCE_FILES "core/*.cpp")
add_library(${PROJECT_NAME} SHARED ${SOURCE_FILES})

# 4. Force C++20 and make sure it outputs as 'gamecore.node' instead of a .dll
set_target_properties(${PROJECT_NAME} PROPERTIES
    CXX_STANDARD 20
    CXX_STANDARD_REQUIRED ON
    PREFIX ""
    SUFFIX ".node"
)

# 5. Disable C++ exceptions (Standard for N-API)
target_compile_definitions(${PROJECT_NAME} PRIVATE NAPI_DISABLE_CPP_EXCEPTIONS)

# 6. Link against the Node.js/NW.js binary provided by cmake-js
target_link_libraries(${PROJECT_NAME} ${CMAKE_JS_LIB})
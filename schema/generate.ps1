# SimpleRPG FlatBuffers Generation Script
# Generates C++ headers and TypeScript accessors from messages.fbs.
#
# Requires: flatc compiler (auto-installed by build_scripts/build-core.js)
#
# Output:
#   engine/generated/messages_generated.h   — C++ zero-copy accessors + Object API
#   src/generated/simple-rpg/*.ts         — TypeScript accessor classes

$ErrorActionPreference = "Stop"
$SchemaDir   = "$PSScriptRoot"
$ProjectRoot = Split-Path $SchemaDir -Parent
$Schema      = Join-Path $SchemaDir "messages.fbs"

$CppOutDir = Join-Path $ProjectRoot "engine\generated"
$TsOutDir  = Join-Path $ProjectRoot "src\generated"

if (-not (Test-Path $CppOutDir)) { New-Item -ItemType Directory -Path $CppOutDir -Force | Out-Null }
if (-not (Test-Path $TsOutDir))  { New-Item -ItemType Directory -Path $TsOutDir  -Force | Out-Null }

Write-Host "Generating C++ headers from messages.fbs..."
flatc --cpp --gen-object-api -o "$CppOutDir" "$Schema"
Write-Host "  -> $CppOutDir\messages_generated.h"

$ServerTsOutDir = Join-Path $ProjectRoot "server\src\generated"
if (-not (Test-Path $ServerTsOutDir)) { New-Item -ItemType Directory -Path $ServerTsOutDir -Force | Out-Null }

Write-Host "Generating TypeScript accessors from messages.fbs..."
flatc --ts -o "$TsOutDir"       "$Schema"   # frontend (Vite)
flatc --ts -o "$ServerTsOutDir" "$Schema"   # server (Node.js)
Write-Host "  -> $TsOutDir\simple-rpg\  (frontend)"
Write-Host "  -> $ServerTsOutDir\simple-rpg\  (server)"

Write-Host ""
Write-Host "FlatBuffers generation complete!"

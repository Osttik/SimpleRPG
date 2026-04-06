# SimpleRPG Proto Generation Script
# Generates C++ classes and TypeScript interfaces from .proto schema

$ErrorActionPreference = "Stop"
$SchemaDir = "$PSScriptRoot"
$ProjectRoot = Split-Path $SchemaDir -Parent

# ─── C++ Generation ───
$CppOutDir = Join-Path $ProjectRoot "engine\generated"
if (-not (Test-Path $CppOutDir)) { New-Item -ItemType Directory -Path $CppOutDir -Force | Out-Null }

Write-Host "Generating C++ from .proto files..."
protoc --cpp_out="$CppOutDir" --proto_path="$SchemaDir" "$SchemaDir\messages.proto"
Write-Host "C++ generated in $CppOutDir"

# ─── TypeScript Generation (ts-proto) ───
$TsOutDir = Join-Path $ProjectRoot "src\generated"
if (-not (Test-Path $TsOutDir)) { New-Item -ItemType Directory -Path $TsOutDir -Force | Out-Null }

$TsProtoPlugin = Join-Path $ProjectRoot "node_modules\.bin\protoc-gen-ts_proto.cmd"

Write-Host "Generating TypeScript from .proto files..."
protoc --plugin="protoc-gen-ts_proto=$TsProtoPlugin" `
       --ts_proto_out="$TsOutDir" `
       --ts_proto_opt=esModuleInterop=true `
       --proto_path="$SchemaDir" `
       "$SchemaDir\messages.proto"
Write-Host "TypeScript generated in $TsOutDir"

Write-Host "Proto generation complete!"

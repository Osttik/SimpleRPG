import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const FLATC_VERSION = '24.3.25';

function ensureFlatc() {
  const isWindows = os.platform() === 'win32';
  const ext = isWindows ? '.exe' : '';
  const toolsDir = path.join(process.cwd(), 'build_tools');
  const localBin = path.join(toolsDir, `flatc${ext}`);

  try {
    execSync('flatc --version', { stdio: 'ignore' });
    return 'flatc';
  } catch { }

  if (fs.existsSync(localBin)) return `"${localBin}"`;

  console.log(`\n   flatc not found — downloading v${FLATC_VERSION}...`);
  if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir, { recursive: true });

  let zipName = isWindows ? 'Windows.flatc.binary.zip' : (os.platform() === 'darwin' ? 'Mac.flatc.binary.zip' : 'Linux.flatc.binary.clang++-17.zip');
  const url = `https://github.com/google/flatbuffers/releases/download/v${FLATC_VERSION}/${zipName}`;
  const zipPath = path.join(toolsDir, zipName);

  execSync(`curl -L -o "${zipPath}" "${url}"`, { stdio: 'inherit' });
  if (isWindows) {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${toolsDir}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${toolsDir}"`, { stdio: 'inherit' });
    execSync(`chmod +x "${localBin}"`, { stdio: 'inherit' });
  }
  fs.unlinkSync(zipPath);
  return `"${localBin}"`;
}

const flatcPath = ensureFlatc();
const nodeVersion = process.versions.node;
const cwd = process.cwd();

// --- 0. GENERATE COMBAT/RIG CONTRACT ---
console.log('\n--- Generating Combat Rig Contract ---');
execSync('node build_scripts/generate-combat-rig-contract.js', { stdio: 'inherit', cwd });

// --- 1. COMPILE FLAGS (For LSP Support) ---
const nodeIncludePath = path.join(os.homedir(), '.cmake-js', 'node-x64', `v${nodeVersion}`, 'include', 'node').replace(/\\/g, '/');
const compileFlags = [
  '-I./node_modules/node-addon-api',
  `-I${nodeIncludePath}`,
  '-I./engine/generated',
  '-DNAPI_DISABLE_CPP_EXCEPTIONS',
  '-std=c++20'
].join('\n');
fs.writeFileSync(path.join(cwd, 'compile_flags.txt'), compileFlags);

// --- 2. GENERATE FLATBUFFERS ---
console.log('\n--- Generating FlatBuffers Schemas ---');
const cppOut = path.join(cwd, 'engine', 'generated');
const tsOut = path.join(cwd, 'src', 'generated');
const serverTsOut = path.join(cwd, 'server', 'src', 'generated');
const schema = path.join(cwd, 'schema', 'messages.fbs');

[cppOut, tsOut, serverTsOut].forEach(d => !fs.existsSync(d) && fs.mkdirSync(d, { recursive: true }));

execSync(`${flatcPath} --cpp --gen-object-api -o "${cppOut}" "${schema}"`, { stdio: 'inherit' });
execSync(`${flatcPath} --ts -o "${tsOut}" "${schema}"`, { stdio: 'inherit' });
execSync(`${flatcPath} --ts -o "${serverTsOut}" "${schema}"`, { stdio: 'inherit' });

// --- 3. BUILD NODE ADDON ---
console.log('\n--- Building C++ core (Node-API) ---');
const buildDir = path.join(cwd, 'build');
const isWindows = os.platform() === 'win32';

// Check for Ninja availability
let hasNinja = false;
try { execSync('ninja --version', { stdio: 'ignore' }); hasNinja = true; } catch { }

// ON WINDOWS: Default to the 'Smart' VS generator so it finds VS 2026 automatically.
// ON OTHER: Use Ninja if available.
const useNinja = hasNinja && !isWindows;
const buildCommand = useNinja
  ? 'npx cmake-js build --generator=Ninja --runtime=node --log-level=NOTICE'
  : 'npx cmake-js build --runtime=node --log-level=NOTICE';

try {
  // We use 'compile' for the first run to ensure full configuration
  const cmd = isWindows ? buildCommand.replace('build', 'compile') : buildCommand;
  execSync(cmd, { stdio: 'inherit', cwd });
} catch (error) {
  console.log('Build failed. Nuking "build/" cache to fix generator mismatch and retrying...');
  if (fs.existsSync(buildDir)) fs.rmSync(buildDir, { recursive: true, force: true });

  // On retry, force 'compile' to regenerate the VS 2026 solution from scratch
  const retryCmd = 'npx cmake-js compile --runtime=node --log-level=NOTICE';
  execSync(retryCmd, { stdio: 'inherit', cwd });
}

// --- 4. BUILD WASM ---
console.log('\n--- Building WebAssembly (Frontend) ---');
const wasmBuildDir = path.join(cwd, 'build_wasm');

try {
  const generatorFlag = hasNinja ? '-G Ninja' : '';
  // Clean WASM build if cache is poisoned
  if (!fs.existsSync(path.join(wasmBuildDir, 'CMakeCache.txt')) && fs.existsSync(wasmBuildDir)) {
    fs.rmSync(wasmBuildDir, { recursive: true, force: true });
  }
  if (!fs.existsSync(wasmBuildDir)) fs.mkdirSync(wasmBuildDir);

  execSync(`emcmake cmake -B build_wasm . ${generatorFlag} -DCMAKE_BUILD_TYPE=Release -DSIMPLERPG_USE_PROTOBUF=OFF`, { stdio: 'inherit', cwd });
  execSync('cmake --build build_wasm', { stdio: 'inherit', cwd });
  console.log('✅ WebAssembly built successfully.');
} catch (error) {
  console.error('❌ WebAssembly build failed.');
  process.exit(1);
}

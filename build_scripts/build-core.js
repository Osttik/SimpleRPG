import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const FLATC_VERSION = '24.3.25';

/**
 * Ensures flatc is available. Resolution order:
 *   1. Already in PATH
 *   2. Local build_tools/flatc(.exe)
 *   3. Auto-download from GitHub releases into build_tools/
 */
function ensureFlatc() {
  const isWindows = os.platform() === 'win32';
  const ext = isWindows ? '.exe' : '';
  const toolsDir = path.join(process.cwd(), 'build_tools');
  const localBin = path.join(toolsDir, `flatc${ext}`);

  // 1. Check PATH
  try {
    execSync('flatc --version', { stdio: 'ignore' });
    console.log('   flatc found in PATH.');
    return 'flatc';
  } catch { /* not in PATH */ }

  // 2. Check local build_tools/
  if (fs.existsSync(localBin)) {
    console.log(`   flatc found at ${localBin}`);
    return `"${localBin}"`;
  }

  // 3. Download from GitHub releases
  console.log(`\n   flatc not found — downloading v${FLATC_VERSION} from GitHub releases...`);
  if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir, { recursive: true });

  let zipName;
  if (isWindows) {
    zipName = 'Windows.flatc.binary.zip';
  } else if (os.platform() === 'darwin') {
    zipName = 'Mac.flatc.binary.zip';
  } else {
    zipName = 'Linux.flatc.binary.clang++-17.zip';
  }

  const url = `https://github.com/google/flatbuffers/releases/download/v${FLATC_VERSION}/${zipName}`;
  const zipPath = path.join(toolsDir, zipName);

  // Download (curl ships with Windows 10+, Linux, macOS)
  execSync(`curl -L -o "${zipPath}" "${url}"`, { stdio: 'inherit' });

  // Extract
  if (isWindows) {
    execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${toolsDir}' -Force"`, { stdio: 'inherit' });
  } else {
    execSync(`unzip -o "${zipPath}" -d "${toolsDir}"`, { stdio: 'inherit' });
    execSync(`chmod +x "${localBin}"`, { stdio: 'inherit' });
  }

  // Cleanup zip
  fs.unlinkSync(zipPath);

  if (!fs.existsSync(localBin)) {
    console.error(`ERROR: flatc binary not found at ${localBin} after extraction.`);
    process.exit(1);
  }

  console.log(`   flatc v${FLATC_VERSION} installed to ${localBin}`);
  return `"${localBin}"`;
}

const flatcPath = ensureFlatc();

const nodeVersion = process.versions.node;
const homeDir = os.homedir();
const cwd = process.cwd();

// --- 1. GENERATE COMPILE FLAGS ---
const cmakeJsPath = path.join(homeDir, '.cmake-js', 'node-x64', `v${nodeVersion}`);
const nodeIncludePath = path.join(cmakeJsPath, 'include', 'node').replace(/\\/g, '/');

const compileFlagsContent = [
  '-I./node_modules/node-addon-api',
  `-I${nodeIncludePath}`,
  '-I./engine/generated',
  '-DNAPI_DISABLE_CPP_EXCEPTIONS',
  '-std=c++20'
].join('\n');

fs.writeFileSync(path.join(cwd, 'compile_flags.txt'), compileFlagsContent);
console.log(`   Auto-generated compile_flags.txt for Node v${nodeVersion}`);

// --- 2. GENERATE FLATBUFFERS ---
console.log('\n--- Generating FlatBuffers Schemas (C++ & TS) ---');
try {
  const schemaDir = path.join(cwd, 'schema');
  const cppOut = path.join(cwd, 'engine', 'generated');
  const tsOut = path.join(cwd, 'src', 'generated');
  const schema = path.join(schemaDir, 'messages.fbs');

  if (!fs.existsSync(cppOut)) fs.mkdirSync(cppOut, { recursive: true });
  if (!fs.existsSync(tsOut)) fs.mkdirSync(tsOut, { recursive: true });

  const serverTsOut = path.join(cwd, 'server', 'src', 'generated');
  if (!fs.existsSync(serverTsOut)) fs.mkdirSync(serverTsOut, { recursive: true });

  // C++ headers with Object API (enables ergonomic T-suffixed builder structs)
  execSync(`${flatcPath} --cpp --gen-object-api -o "${cppOut}" "${schema}"`, { stdio: 'inherit' });
  // TypeScript accessor classes for the frontend (Vite) and server (Node.js)
  execSync(`${flatcPath} --ts -o "${tsOut}" "${schema}"`, { stdio: 'inherit' });
  execSync(`${flatcPath} --ts -o "${serverTsOut}" "${schema}"`, { stdio: 'inherit' });

  console.log('FlatBuffers generation successful.');
  console.log(`  C++ → ${cppOut}\\messages_generated.h`);
  console.log(`  TS  → ${tsOut}\\simple-rpg\\  (frontend)`);
  console.log(`  TS  → ${serverTsOut}\\simple-rpg\\  (server)`);
} catch (error) {
  console.error('FlatBuffers generation failed. Ensure flatc is available (re-run build to auto-download).');
  process.exit(1);
}

// --- 3. BUILD NODE ADDON ---
console.log('\n--- Building C++ core for Node.js server ---');
try {
  const nodeBuildDir = path.join(cwd, 'build');
  const isNodeConfigured = fs.existsSync(path.join(nodeBuildDir, 'CMakeCache.txt'));

  if (!isNodeConfigured) {
    console.log('Configuring Node Addon (First time)...');
    execSync('npx cmake-js compile --runtime=node --log-level=NOTICE', { stdio: 'inherit', cwd });
  } else {
    console.log('Node Addon already configured. Running fast incremental build...');
    execSync('npx cmake-js build --runtime=node --log-level=NOTICE', { stdio: 'inherit', cwd });
  }
} catch (error) {
  console.error('Node.js build failed.');
  process.exit(1);
}

// --- 4. BUILD WASM ---
console.log('\n--- Building WebAssembly for Frontend ---');

function ensureEmscripten() {
  try {
    execSync(os.platform() === 'win32' ? 'where emcc' : 'which emcc', { stdio: 'ignore' });
    return true;
  } catch (e) {
    console.log('\nEmscripten (emcc) not found in PATH. Attempting to install via emsdk...');
    const emsdkDir = path.join(os.homedir(), '.emsdk');
    const isWindows = os.platform() === 'win32';

    if (!fs.existsSync(emsdkDir)) {
      console.log('Cloning emsdk repo...');
      execSync(`git clone https://github.com/emscripten-core/emsdk.git "${emsdkDir}"`, { stdio: 'inherit' });
    }

    console.log('Installing/Activating latest emscripten...');
    const emsdkCmd = isWindows ? path.join(emsdkDir, 'emsdk.bat') : path.join(emsdkDir, 'emsdk');
    execSync(`"${emsdkCmd}" install latest`, { stdio: 'inherit', cwd: emsdkDir });
    execSync(`"${emsdkCmd}" activate latest`, { stdio: 'inherit', cwd: emsdkDir });

    const emscriptenPath = path.join(emsdkDir, 'upstream', 'emscripten');
    process.env.PATH = `${emscriptenPath}${path.delimiter}${process.env.PATH}`;
    return true;
  }
}

ensureEmscripten();

try {
  const wasmBuildDir = path.join(cwd, 'build_wasm');
  if (!fs.existsSync(wasmBuildDir)) fs.mkdirSync(wasmBuildDir);

  console.log('Configuring Emscripten CMake...');
  const generator = os.platform() === 'win32' ? '-G Ninja' : '';

  execSync(`emcmake cmake -B build_wasm . ${generator} -DCMAKE_BUILD_TYPE=Release --log-level=NOTICE -Wno-dev -DSIMPLERPG_USE_PROTOBUF=OFF`, { stdio: 'inherit', cwd });

  console.log('Compiling WASM...');
  execSync('cmake --build build_wasm', { stdio: 'inherit', cwd });

  console.log('+++++++++ WebAssembly built successfully to build_wasm/gamecore_wasm.js');
} catch (error) {
  console.error('---------- WebAssembly build failed.');
  process.exit(1);
}

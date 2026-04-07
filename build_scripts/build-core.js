import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Ensures protoc is installed globally via Chocolatey if not found.
 */
function ensureProtoc() {
  try {
    execSync('protoc --version', { stdio: 'ignore' });
    return 'protoc';
  } catch (e) {
    console.error('\nInstalling ProtoBug ;)');
    // Added -y and inherit to see progress and auto-confirm
    execSync('choco install protoc -y', { stdio: 'inherit' });
    return 'protoc';
  }
}

const protocPath = ensureProtoc();

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

// --- 2. GENERATE PROTOBUF ---
console.log('\n--- Generating Protobuf Schemas (C++ & TS) ---');
try {
  const protoDir = path.join(cwd, 'schema');
  const cppOut = path.join(cwd, 'engine', 'generated');
  const tsOut = path.join(cwd, 'src', 'generated');

  if (!fs.existsSync(cppOut)) fs.mkdirSync(cppOut, { recursive: true });
  if (!fs.existsSync(tsOut)) fs.mkdirSync(tsOut, { recursive: true });

  execSync(`${protocPath} --proto_path=${protoDir} --cpp_out=${cppOut} --ts_proto_out=${tsOut} ${path.join(protoDir, '*.proto')}`, { stdio: 'inherit' });
  console.log('Protobuf generation successful.');
} catch (error) {
  console.error('Protobuf generation failed. Ensure protoc is installed.');
  process.exit(1);
}

// --- 3. BUILD NODE ADDON ---
console.log('\n--- Building C++ core for Node.js server ---');
try {
  const nodeBuildDir = path.join(cwd, 'build');
  const isNodeConfigured = fs.existsSync(path.join(nodeBuildDir, 'CMakeCache.txt'));

  // Added --log-level=NOTICE to hide internal feature detection checks
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
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const nodeVersion = process.versions.node;
const homeDir = os.homedir();
const cwd = process.cwd();

const cmakeJsPath = path.join(homeDir, '.cmake-js', 'node-x64', `v${nodeVersion}`);
const nodeIncludePath = path.join(cmakeJsPath, 'include', 'node').replace(/\\/g, '/');

const compileFlagsContent = [
  '-I./node_modules/node-addon-api',
  `-I${nodeIncludePath}`,
  '-DNAPI_DISABLE_CPP_EXCEPTIONS',
  '-std=c++20'
].join('\n');

fs.writeFileSync(path.join(cwd, 'compile_flags.txt'), compileFlagsContent);
console.log(`   Auto-generated compile_flags.txt for Node v${nodeVersion}`);

console.log('\n--- Building C++ core for Node.js server ---');
try {
  const nodeBuildDir = path.join(cwd, 'build');
  const isNodeConfigured = fs.existsSync(path.join(nodeBuildDir, 'CMakeCache.txt'));

  if (!isNodeConfigured) {
    console.log('Configuring Node Addon (First time)...');
    execSync('npx cmake-js compile --runtime=node', { stdio: 'inherit', cwd });
  } else {
    console.log('Node Addon already configured. Running fast incremental build...');
    execSync('npx cmake-js build --runtime=node', { stdio: 'inherit', cwd });
  }
} catch (error) {
  console.error('Node.js build failed.');
  process.exit(1);
}

console.log('\n--- Building WebAssembly for Frontend ---');

function isEmscriptenAvailable() {
  try {
    execSync(os.platform() === 'win32' ? 'where emcc' : 'which emcc', { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

if (!isEmscriptenAvailable()) {
  console.warn('   Emscripten not found. Skipping WASM build.');
} else {
  try {
    const wasmBuildDir = path.join(cwd, 'build_wasm');
    if (!fs.existsSync(wasmBuildDir)) fs.mkdirSync(wasmBuildDir);

    const isWasmConfigured = fs.existsSync(path.join(wasmBuildDir, 'CMakeCache.txt'));

    if (!isWasmConfigured) {
      console.log('Configuring WASM (First time)... This will take ~140s.');
      const generator = os.platform() === 'win32' ? '-G Ninja' : '';
      execSync(`emcmake cmake -B build_wasm . ${generator} -DCMAKE_BUILD_TYPE=Release`, { stdio: 'inherit', cwd });
    } else {
      console.log('WASM already configured. Running fast incremental build...');
    }

    execSync('cmake --build build_wasm', { stdio: 'inherit', cwd });
    console.log('WebAssembly built successfully.');
  } catch (error) {
    console.error('WebAssembly build failed.');
  }
}
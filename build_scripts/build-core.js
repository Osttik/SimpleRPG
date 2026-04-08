import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const FLATC_VERSION = '24.3.25';
const cwd = process.cwd();

/**
 * Ensures flatc is available.
 */
function ensureFlatc() {
  const platform = os.platform();
  const isWindows = platform === 'win32';
  const ext = isWindows ? '.exe' : '';
  const toolsDir = path.join(cwd, 'build_tools');
  const localBin = path.join(toolsDir, `flatc${ext}`);

  // 1. Check PATH
  try {
    execSync('flatc --version', { stdio: 'ignore' });
    console.log('   flatc found in PATH.');
    return 'flatc';
  } catch { /* not in PATH */ }

  // 2. Check local build_tools/
  if (fs.existsSync(localBin)) {
    return `"${localBin}"`;
  }

  // 3. Download from GitHub
  if (!fs.existsSync(toolsDir)) fs.mkdirSync(toolsDir, { recursive: true });

  let zipName;
  if (isWindows) {
    zipName = 'Windows.flatc.binary.zip';
  } else if (platform === 'darwin') {
    zipName = 'Mac.flatc.binary.zip';
  } else {
    zipName = 'Linux.flatc.binary.g++.zip';
  }

  const url = `https://github.com/google/flatbuffers/releases/download/v${FLATC_VERSION}/${zipName}`;
  const zipPath = path.join(toolsDir, zipName);

  console.log(`\n   Downloading flatc v${FLATC_VERSION} for ${platform}...`);
  try {
    execSync(`curl -fL -o "${zipPath}" "${url}"`, { stdio: 'inherit' });

    if (isWindows) {
      execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${toolsDir}' -Force"`, { stdio: 'inherit' });
    } else {
      try { execSync('unzip -v', { stdio: 'ignore' }); }
      catch (e) { throw new Error('Utility "unzip" not found. Run: sudo apt install unzip'); }

      execSync(`unzip -o "${zipPath}" -d "${toolsDir}"`, { stdio: 'inherit' });
      execSync(`chmod +x "${localBin}"`, { stdio: 'inherit' });
    }
    fs.unlinkSync(zipPath);
    console.log(`   flatc installed to ${localBin}`);
    return `"${localBin}"`;
  } catch (error) {
    console.error(`\nERROR: Failed to download flatc. ${error.message}`);
    process.exit(1);
  }
}

/**
 * Migration Guard: Aggressively purges CMake cache if it contains Windows-specific
 * indicators while running on Linux (WSL).
 */
function validateCMakeCache(buildPath) {
  const cacheFile = path.join(buildPath, 'CMakeCache.txt');
  if (fs.existsSync(cacheFile)) {
    const content = fs.readFileSync(cacheFile, 'utf8');
    const isLinux = os.platform() === 'linux';

    // Check for drive letters, double backslashes, or VS-specific generators
    const hasWindowsPaths = content.includes('C:/') || content.includes('\\\\') || content.includes(':\\');
    const isVSGenerator = content.includes('Visual Studio') || content.includes('MSVC');

    if (isLinux && (hasWindowsPaths || isVSGenerator)) {
      console.log(`\n   [Migration] Invalid Windows/VS cache detected in ${path.basename(buildPath)}. Purging for Linux build...`);
      fs.rmSync(buildPath, { recursive: true, force: true });
      return false;
    }
  }
  return fs.existsSync(cacheFile);
}

// Start Build Process
const flatcPath = ensureFlatc();
const nodeVersion = process.versions.node;
const homeDir = os.homedir();

// --- 1. COMPILE FLAGS ---
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

// --- 2. FLATBUFFERS GENERATION ---
console.log('\n--- Generating FlatBuffers Schemas (C++ & TS) ---');
try {
  const schema = path.join(cwd, 'schema', 'messages.fbs');
  const cppOut = path.join(cwd, 'engine', 'generated');
  const tsOut = path.join(cwd, 'src', 'generated');
  const serverTsOut = path.join(cwd, 'server', 'src', 'generated');

  [cppOut, tsOut, serverTsOut].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });

  execSync(`${flatcPath} --cpp --gen-object-api -o "${cppOut}" "${schema}"`, { stdio: 'inherit' });
  execSync(`${flatcPath} --ts -o "${tsOut}" "${schema}"`, { stdio: 'inherit' });
  execSync(`${flatcPath} --ts -o "${serverTsOut}" "${schema}"`, { stdio: 'inherit' });

  console.log('FlatBuffers generation successful.');
} catch (error) {
  console.error('FlatBuffers generation failed.');
  process.exit(1);
}

// --- 3. NODE ADDON BUILD ---
console.log('\n--- Building C++ core for Node.js server ---');
try {
  const nodeBuildDir = path.join(cwd, 'build');
  const isConfigured = validateCMakeCache(nodeBuildDir);

  // If we purged the cache, 'compile' will re-initialize with Linux generators
  const cmd = isConfigured ? 'build' : 'compile';
  console.log(`   Executing cmake-js ${cmd}...`);

  execSync(`npx cmake-js ${cmd} --runtime=node --log-level=NOTICE`, { stdio: 'inherit', cwd });
} catch (error) {
  console.error('Node.js build failed.');
  process.exit(1);
}

// --- 4. WASM BUILD ---
console.log('\n--- Building WebAssembly for Frontend ---');

function ensureEmscripten() {
  const isWindows = os.platform() === 'win32';
  try {
    execSync(isWindows ? 'where emcc' : 'which emcc', { stdio: 'ignore' });
    return true;
  } catch (e) {
    const emsdkDir = path.join(homeDir, '.emsdk');
    if (!fs.existsSync(emsdkDir)) {
      console.log('Cloning emsdk...');
      execSync(`git clone https://github.com/emscripten-core/emsdk.git "${emsdkDir}"`, { stdio: 'inherit' });
    }
    const emsdkCmd = path.join(emsdkDir, isWindows ? 'emsdk.bat' : 'emsdk');
    execSync(`"${emsdkCmd}" install latest`, { stdio: 'inherit' });
    execSync(`"${emsdkCmd}" activate latest`, { stdio: 'inherit' });

    const emscriptenPath = path.join(emsdkDir, 'upstream', 'emscripten');
    process.env.PATH = `${emscriptenPath}${path.delimiter}${process.env.PATH}`;
    return true;
  }
}

ensureEmscripten();

try {
  const wasmBuildDir = path.join(cwd, 'build_wasm');
  validateCMakeCache(wasmBuildDir); // Guard for WASM folder too

  if (!fs.existsSync(wasmBuildDir)) fs.mkdirSync(wasmBuildDir);

  console.log('Configuring Emscripten CMake...');
  const isWindows = os.platform() === 'win32';
  let generator = '';
  try {
    execSync('ninja --version', { stdio: 'ignore' });
    generator = '-G Ninja';
  } catch {
    generator = isWindows ? '-G "Visual Studio 17 2022"' : '-G "Unix Makefiles"';
  }

  // Ensure fresh configuration with the current OS settings
  execSync(`emcmake cmake -B build_wasm . ${generator} -DCMAKE_BUILD_TYPE=Release --log-level=NOTICE -Wno-dev -DSIMPLERPG_USE_PROTOBUF=OFF`, { stdio: 'inherit', cwd });

  console.log('Compiling WASM...');
  execSync('cmake --build build_wasm', { stdio: 'inherit', cwd });

  console.log('+++++++++ WebAssembly built successfully!');
} catch (error) {
  console.error('---------- WebAssembly build failed.');
  process.exit(1);
}
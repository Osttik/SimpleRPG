import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

function ensureProtoc() {
  try {
    execSync('protoc --version', { stdio: 'ignore' });
    return 'protoc';
  } catch (e) {
    console.error('\nInstalling ProtoBug ;)');
    execSync('choco install protoc -y', { stdio: 'inherit' }); 
    return 'protoc';
  }
}

ensureProtoc();

const nodeVersion = process.versions.node;
const homeDir = os.homedir();
const cwd = process.cwd();

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

console.log('\n--- Generating Protobuf Schemas (C++ & TS) ---');
try {
  const protoDir = path.join(cwd, 'schema');
  const cppOut = path.join(cwd, 'engine', 'generated');
  const tsOut = path.join(cwd, 'src', 'generated');

  if (!fs.existsSync(cppOut)) fs.mkdirSync(cppOut, { recursive: true });
  if (!fs.existsSync(tsOut)) fs.mkdirSync(tsOut, { recursive: true });

  execSync(`protoc --proto_path=${protoDir} --cpp_out=${cppOut} --ts_proto_out=${tsOut} ${path.join(protoDir, '*.proto')}`, { stdio: 'inherit' });
  console.log('Protobuf generation successful.');
} catch (error) {
  console.error('Protobuf generation failed. Ensure protoc is installed.');
  process.exit(1);
}

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
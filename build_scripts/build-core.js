import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const nodeVersion = process.versions.node;
const homeDir = os.homedir();
const cmakeJsPath = path.join(homeDir, '.cmake-js', 'node-x64', `v${nodeVersion}`);
const nodeIncludePath = path.join(cmakeJsPath, 'include', 'node').replace(/\\/g, '/');

const compileFlagsContent = [
  '-I./node_modules/node-addon-api',
  `-I${nodeIncludePath}`,
  '-DNAPI_DISABLE_CPP_EXCEPTIONS',
  '-std=c++20'
].join('\n');

fs.writeFileSync(path.join(process.cwd(), 'compile_flags.txt'), compileFlagsContent);
console.log(`Auto-generated compile_flags.txt for Node v${nodeVersion}`);

console.log('Building C++ core for Node.js server...');
try {
  const cmd = 'npx cmake-js compile --runtime=node';
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  console.log('✓ Node.js addon built successfully to build/Release/gamecore.node');
} catch (error) {
  console.error('✗ Build failed.');
  process.exit(1);
}
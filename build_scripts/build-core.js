import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const nwPackagePath = path.resolve(process.cwd(), 'node_modules', 'nw', 'package.json');
if (!fs.existsSync(nwPackagePath)) {
  console.error("Error: NW.js is not installed locally. Run 'npm install nw --save-dev'.");
  process.exit(1);
}

const rawVersion = JSON.parse(fs.readFileSync(nwPackagePath, 'utf-8')).version;
const cleanVersion = rawVersion.split('-')[0];

const homeDir = os.homedir();
const cmakeJsIncludePath = path.join(homeDir, '.cmake-js', 'nw-x64', `v${cleanVersion}`, 'include', 'node');
const normalizedIncludePath = cmakeJsIncludePath.replace(/\\/g, '/');

const compileFlagsContent = [
  '-I./node_modules/node-addon-api',
  `-I${normalizedIncludePath}`,
  '-DNAPI_DISABLE_CPP_EXCEPTIONS',
  '-std=c++20'
].join('\n');

fs.writeFileSync(path.join(process.cwd(), 'compile_flags.txt'), compileFlagsContent);
console.log('Auto-generated compile_flags.txt for Antigravity IDE.');

console.log(`Building C++ core via CMake for NW.js v${cleanVersion}...`);
try {
  const cmd = `npx cmake-js compile --runtime=nw --runtime-version=${cleanVersion}`;
  execSync(cmd, { stdio: 'inherit' });
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed.');
  process.exit(1);
}
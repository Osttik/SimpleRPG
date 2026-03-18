import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('Building C++ core for Node.js server...');
try {
  // Run from root directory where CMakeLists.txt is located
  const cmd = 'npx cmake-js compile --runtime=node --out=build-nodejs';
  execSync(cmd, { stdio: 'inherit', cwd: process.cwd() });
  console.log('✓ Node.js addon built to build-nodejs/Release/gamecore.node');
} catch (error) {
  console.error('✗ Build failed.');
  process.exit(1);
}

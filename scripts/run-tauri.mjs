// Automatically ensures ~/.cargo/bin and ~/.w64devkit/w64devkit/bin are in PATH before invoking Tauri CLI
import { spawn } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';

const home = os.homedir();
const cargoBin = path.join(home, '.cargo', 'bin');
const mingwBin = path.join(home, '.w64devkit', 'w64devkit', 'bin');

const pathKey = Object.keys(process.env).find((k) => k.toUpperCase() === 'PATH') || 'PATH';
const currentPath = process.env[pathKey] || '';
const delimiter = path.delimiter;

const extraPaths = [cargoBin, mingwBin].filter((p) => !currentPath.includes(p));
if (extraPaths.length > 0) {
  process.env[pathKey] = [...extraPaths, currentPath].join(delimiter);
}

const args = process.argv.slice(2);
const tauriCliJs = path.resolve('node_modules', '@tauri-apps', 'cli', 'tauri.js');

const child = spawn(process.execPath, [tauriCliJs, ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

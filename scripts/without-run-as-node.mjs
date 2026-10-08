// Runs a command with ELECTRON_RUN_AS_NODE removed from the environment.
// VS Code's terminal sets it, which makes Electron start as plain Node and the
// app fail to open. Cross-platform replacement for `env -u ELECTRON_RUN_AS_NODE`.
//
// Usage (in package.json scripts): node scripts/without-run-as-node.mjs electron-vite dev
import { spawn } from 'node:child_process'

const [cmd, ...args] = process.argv.slice(2)
if (!cmd) {
  console.error('Usage: node scripts/without-run-as-node.mjs <command> [args...]')
  process.exit(1)
}
const env = { ...process.env }
delete env.ELECTRON_RUN_AS_NODE

// A shell resolves npm's .cmd shims on Windows (e.g. node_modules/.bin/electron-vite.cmd)
const child = spawn(cmd, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 1)
})
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => child.kill(sig))

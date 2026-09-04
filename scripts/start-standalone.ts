import { spawn } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const standaloneDirectory = resolve('.next/standalone')

function copyDirectory(source: string, destination: string): void {
  if (!existsSync(source)) {
    return
  }

  cpSync(source, destination, { recursive: true, dereference: true })
}

copyDirectory(resolve('public'), resolve(standaloneDirectory, 'public'))
copyDirectory(resolve('.next/static'), resolve(standaloneDirectory, '.next/static'))
copyDirectory(resolve('node_modules/postgres'), resolve(standaloneDirectory, 'node_modules/postgres'))

const server = spawn(process.execPath, ['server.js'], {
  cwd: standaloneDirectory,
  env: process.env,
  stdio: 'inherit',
})

function handleServerExit(code: number | null, signal: NodeJS.Signals | null): void {
  if (code !== null) {
    process.exit(code)
  }

  if (signal === 'SIGINT') {
    process.exit(130)
  }

  if (signal === 'SIGTERM') {
    process.exit(143)
  }

  process.exit(1)
}

function forwardSignal(signal: NodeJS.Signals): void {
  server.kill(signal)
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))
server.on('exit', handleServerExit)

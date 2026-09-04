import { spawn } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const standaloneDirectory = resolve('.next/standalone')

function copyDirectory(source: string, destination: string): void {
  if (!existsSync(source)) {
    return
  }

  cpSync(source, destination, { recursive: true })
}

copyDirectory(resolve('public'), resolve(standaloneDirectory, 'public'))
copyDirectory(resolve('.next/static'), resolve(standaloneDirectory, '.next/static'))

const server = spawn(process.execPath, ['server.js'], {
  cwd: standaloneDirectory,
  env: process.env,
  stdio: 'inherit',
})

function handleServerExit(code: number | null): void {
  process.exit(code ?? 1)
}

function forwardSignal(signal: NodeJS.Signals): void {
  server.kill(signal)
}

process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))
server.on('exit', handleServerExit)

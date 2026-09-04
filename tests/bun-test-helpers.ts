import type { Mock } from 'bun:test'

import { jest, mock, spyOn as nativeSpyOn } from 'bun:test'

const originalGlobals = new Map<PropertyKey, PropertyDescriptor | undefined>()
const originalEnvs = new Map<string, string | undefined>()
let originalWindowTimerDescriptors: Record<string, PropertyDescriptor> | null = null

export function hoisted<T>(factory: () => T): T {
  return factory()
}

type Mocked<T> = T extends (...args: infer Arguments) => infer Return ? Mock<(...args: Arguments) => Return> : T

export function mocked<T>(value: T): Mocked<T> {
  return value as Mocked<T>
}

export function stubGlobal(name: PropertyKey, value: unknown): void {
  if (!originalGlobals.has(name)) {
    originalGlobals.set(name, Object.getOwnPropertyDescriptor(globalThis, name))
  }

  Object.defineProperty(globalThis, name, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

export function unstubAllGlobals(): void {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, name)
    }
  }

  originalGlobals.clear()
}

export function stubEnv(name: string, value: string): void {
  if (!originalEnvs.has(name)) {
    originalEnvs.set(name, process.env[name])
  }

  process.env[name] = value
}

export function unstubAllEnvs(): void {
  for (const [name, value] of originalEnvs) {
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }

  originalEnvs.clear()
}

export async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms)
  await Promise.resolve()
}

export function useFakeTimers(options?: Parameters<typeof jest.useFakeTimers>[0]) {
  const result = jest.useFakeTimers(options)
  if (typeof window !== 'undefined' && !originalWindowTimerDescriptors) {
    originalWindowTimerDescriptors = Object.fromEntries(
      ['clearInterval', 'clearTimeout', 'setInterval', 'setTimeout'].map((name) => [
        name,
        Object.getOwnPropertyDescriptor(window, name) ?? {},
      ]),
    )
  }

  if (typeof window !== 'undefined') {
    Object.defineProperties(window, {
      clearInterval: { configurable: true, value: globalThis.clearInterval },
      clearTimeout: { configurable: true, value: globalThis.clearTimeout },
      setInterval: { configurable: true, value: globalThis.setInterval },
      setTimeout: { configurable: true, value: globalThis.setTimeout },
    })
  }

  return result
}

export function useRealTimers() {
  const result = jest.useRealTimers()
  if (typeof window !== 'undefined' && originalWindowTimerDescriptors) {
    Object.defineProperties(window, originalWindowTimerDescriptors)
    originalWindowTimerDescriptors = null
  }

  return result
}

export function waitFor<T>(
  callback: () => T | Promise<T>,
  options: { interval?: number; timeout?: number } = {},
): Promise<T> {
  const interval = options.interval ?? 50
  const timeout = options.timeout ?? 1000
  const deadline = Date.now() + timeout
  let lastError: unknown

  return (async () => {
    while (Date.now() <= deadline) {
      try {
        return await callback()
      } catch (error) {
        lastError = error
      }

      await new Promise((resolve) => setTimeout(resolve, interval))
    }

    throw lastError
  })()
}

export function spyOnAccessor(target: object, property: PropertyKey, accessType: 'get' | 'set') {
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, property)
  const prototypeDescriptor = originalDescriptor
    ? undefined
    : Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), property)
  const descriptor = originalDescriptor ?? prototypeDescriptor
  const originalAccessor = descriptor?.[accessType]
  const originalGetter = descriptor?.get ? descriptor.get.bind(target) : undefined
  const originalSetter = descriptor?.set ? descriptor.set.bind(target) : undefined
  const accessorMock = mock((...args: unknown[]) =>
    originalAccessor ? Reflect.apply(originalAccessor, target, args) : undefined,
  )

  function getOriginalValue(): unknown {
    return originalGetter ? Reflect.apply(originalGetter, target, []) : undefined
  }

  function setOriginalValue(value: unknown): void {
    if (originalSetter) {
      Reflect.apply(originalSetter, target, [value])
    }
  }

  Object.defineProperty(target, property, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: accessType === 'get' ? () => accessorMock() : originalGetter ? getOriginalValue : undefined,
    set: accessType === 'set' ? (value: unknown) => accessorMock(value) : originalSetter ? setOriginalValue : undefined,
  })

  Object.defineProperty(accessorMock, 'mockRestore', {
    configurable: true,
    value: () => {
      if (originalDescriptor) {
        Object.defineProperty(target, property, originalDescriptor)
      } else {
        Reflect.deleteProperty(target, property)
      }
    },
  })

  return accessorMock
}

export function spyOn<T extends object, K extends keyof T>(target: T, property: K) {
  return nativeSpyOn(target, property)
}

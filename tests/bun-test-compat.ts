import { setSystemTime, vi as bunVi } from 'bun:test'

type AnyFunction = (...args: any[]) => any

export type MockInstance<T extends AnyFunction = AnyFunction> = T & {
  mock: { calls: unknown[][] }
  mockRestore(): void
}

type ViCompat = typeof bunVi & {
  advanceTimersByTimeAsync(ms: number): Promise<void>
  doMock(path: string, factory: () => unknown): void
  doUnmock(path: string): void
  hoisted<T>(factory: () => T): T
  mocked<T>(value: T): T
  setSystemTime(date?: Date | number): void
  stubEnv(name: string, value: string): void
  stubGlobal(name: PropertyKey, value: unknown): void
  unstubAllEnvs(): void
  unstubAllGlobals(): void
  waitFor<T>(callback: () => T | Promise<T>, options?: { interval?: number; timeout?: number }): Promise<T>
}

const originalGlobals = new Map<PropertyKey, PropertyDescriptor | undefined>()
const originalEnvs = new Map<string, string | undefined>()
let originalWindowTimerDescriptors: Record<string, PropertyDescriptor> | null = null

function stubGlobal(name: PropertyKey, value: unknown): void {
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

function unstubAllGlobals(): void {
  for (const [name, descriptor] of originalGlobals) {
    if (descriptor) {
      Object.defineProperty(globalThis, name, descriptor)
    } else {
      Reflect.deleteProperty(globalThis, name)
    }
  }

  originalGlobals.clear()
}

function stubEnv(name: string, value: string): void {
  if (!originalEnvs.has(name)) {
    originalEnvs.set(name, process.env[name])
  }

  process.env[name] = value
}

function unstubAllEnvs(): void {
  for (const [name, value] of originalEnvs) {
    if (value === undefined) {
      delete process.env[name]
    } else {
      process.env[name] = value
    }
  }

  originalEnvs.clear()
}

async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  bunVi.advanceTimersByTime(ms)
  await Promise.resolve()
}

function useFakeTimers(...args: any[]) {
  const result = nativeUseFakeTimers(...args)
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

function useRealTimers() {
  const result = nativeUseRealTimers()
  if (typeof window !== 'undefined' && originalWindowTimerDescriptors) {
    Object.defineProperties(window, originalWindowTimerDescriptors)
    originalWindowTimerDescriptors = null
  }

  return result
}

async function waitFor<T>(
  callback: () => T | Promise<T>,
  options: { interval?: number; timeout?: number } = {},
): Promise<T> {
  const interval = options.interval ?? 50
  const timeout = options.timeout ?? 1000
  const deadline = Date.now() + timeout
  let lastError: unknown

  while (Date.now() <= deadline) {
    try {
      return await callback()
    } catch (error) {
      lastError = error
    }

    await new Promise((resolve) => setTimeout(resolve, interval))
  }

  throw lastError
}

function spyOnAccessor(target: object, property: PropertyKey, accessType: 'get' | 'set') {
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, property)
  const prototypeDescriptor = originalDescriptor
    ? undefined
    : Object.getOwnPropertyDescriptor(Object.getPrototypeOf(target), property)
  const descriptor = originalDescriptor ?? prototypeDescriptor
  const originalAccessor = descriptor?.[accessType]
  const accessorMock = bunVi.fn((...args: unknown[]) => originalAccessor?.apply(target, args))

  Object.defineProperty(target, property, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    get: accessType === 'get' ? () => accessorMock() : descriptor?.get,
    set: accessType === 'set' ? (value: unknown) => accessorMock(value) : descriptor?.set,
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

const nativeSpyOn = bunVi.spyOn.bind(bunVi)
const nativeUseFakeTimers = bunVi.useFakeTimers.bind(bunVi)
const nativeUseRealTimers = bunVi.useRealTimers.bind(bunVi)

const compatVi = bunVi as ViCompat

Object.assign(compatVi, {
  advanceTimersByTimeAsync,
  doMock: (path: string, factory: () => unknown) => bunVi.mock(path, factory),
  doUnmock: (_path: string) => {},
  hoisted: <T>(factory: () => T) => factory(),
  mocked: <T>(value: T) => value,
  setSystemTime,
  spyOn: (...args: any[]) =>
    args.length === 3 ? spyOnAccessor(args[0], args[1], args[2]) : nativeSpyOn(args[0], args[1]),
  stubEnv,
  stubGlobal,
  unstubAllEnvs,
  unstubAllGlobals,
  useFakeTimers,
  useRealTimers,
  waitFor,
})

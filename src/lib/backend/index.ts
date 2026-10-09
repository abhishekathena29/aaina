import { IS_DEMO } from '../config'
import type { Backend } from './types'

// The Firebase SDK is only loaded when configured, keeping the demo bundle light.
export const backendPromise: Promise<Backend> = IS_DEMO
  ? import('./demo').then((m) => m.demoBackend)
  : import('./firebase').then((m) => m.firebaseBackend)

export type { AppUser, Backend } from './types'

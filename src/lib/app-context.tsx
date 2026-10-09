/* eslint-disable react-refresh/only-export-components -- provider + its hooks belong together */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { SlotKind } from '../shared/catalog'
import type { Booking } from '../shared/types'
import type { AppUser, Backend } from './backend'
import { ADMIN_EMAILS } from './config'

const BackendContext = createContext<Backend | null>(null)

interface AuthState {
  user: AppUser | null
  loading: boolean
  isAdmin: boolean
}
const AuthContext = createContext<AuthState>({ user: null, loading: true, isAdmin: false })

export function AppProvider({ backend, children }: { backend: Backend; children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ user: null, loading: true, isAdmin: false })
  useEffect(
    () =>
      backend.onAuthChange((user) =>
        setAuth({ user, loading: false, isAdmin: !!user && ADMIN_EMAILS.includes(user.email.toLowerCase()) }),
      ),
    [backend],
  )
  return (
    <BackendContext.Provider value={backend}>
      <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
    </BackendContext.Provider>
  )
}

export function useBackend(): Backend {
  const b = useContext(BackendContext)
  if (!b) throw new Error('useBackend outside AppProvider')
  return b
}

export const useAuth = () => useContext(AuthContext)

export function useTakenSlots(kind: SlotKind): Set<string> {
  const backend = useBackend()
  const [taken, setTaken] = useState<Set<string>>(new Set())
  useEffect(() => backend.watchTakenSlots(kind, setTaken), [backend, kind])
  return taken
}

/** `undefined` while loading, `null` if missing / not permitted. */
export function useBooking(id: string | undefined): Booking | null | undefined {
  const backend = useBackend()
  const { user } = useAuth()
  const [booking, setBooking] = useState<Booking | null | undefined>(undefined)
  useEffect(() => {
    if (!id || !user) return
    return backend.watchBooking(id, setBooking)
  }, [backend, id, user])
  return booking
}

export function useMyBookings(): Booking[] | undefined {
  const backend = useBackend()
  const { user } = useAuth()
  const [list, setList] = useState<Booking[] | undefined>(undefined)
  useEffect(() => {
    if (!user) return
    return backend.watchMyBookings(setList)
  }, [backend, user])
  return list
}

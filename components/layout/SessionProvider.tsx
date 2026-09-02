'use client';

import { createContext, useContext } from 'react';
import type { StaffSession } from '../../lib/auth/session';

const SessionContext = createContext<StaffSession | null>(null);

export function SessionProvider({ user, children }: { user: StaffSession; children: React.ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** The logged-in PFMS user. Guaranteed non-null inside (app) — the layout redirects otherwise. */
export function useSession(): StaffSession {
  const u = useContext(SessionContext);
  if (!u) throw new Error('useSession must be used within SessionProvider');
  return u;
}

import { useEffect, useState } from 'react';

import { sessionStore, type SessionState } from './SessionStore';

/**
 * React hook that subscribes to the singleton SessionStore and re-renders
 * the consuming component whenever the store emits a state update.
 */
export function useSessionStore(): SessionState {
  const [state, setState] = useState<SessionState>(() => sessionStore.getState());
  useEffect(() => {
    return sessionStore.subscribe(setState);
  }, []);
  return state;
}

export { sessionStore };

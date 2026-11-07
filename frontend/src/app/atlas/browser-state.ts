'use client';

import { useSyncExternalStore } from 'react';

const subscribeHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Mount the editable workspace only after hydration, before reading device storage. */
export function useBrowserReady() {
  return useSyncExternalStore(subscribeHydration, clientSnapshot, serverSnapshot);
}

function subscribeOnline(notify: () => void) {
  window.addEventListener('online', notify);
  window.addEventListener('offline', notify);
  return () => {
    window.removeEventListener('online', notify);
    window.removeEventListener('offline', notify);
  };
}
const onlineSnapshot = () => navigator.onLine;
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, onlineSnapshot, clientSnapshot);
}

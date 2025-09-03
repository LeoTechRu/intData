export function onKey(key: string, handler: () => void) {
  function listener(e: KeyboardEvent) {
    if (e.key === key) handler();
  }
  window.addEventListener('keydown', listener);
  return () => window.removeEventListener('keydown', listener);
}

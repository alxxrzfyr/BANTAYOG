// Store one guard in a ref so the lock takes effect before React renders pending state.
export function createFlightGuard() {
  let pending = false;
  return async (task: () => Promise<unknown>): Promise<void> => {
    if (pending) return;
    pending = true;
    try {
      await task();
    } catch {
      // Mutation callbacks report errors to the screen.
    } finally {
      pending = false;
    }
  };
}

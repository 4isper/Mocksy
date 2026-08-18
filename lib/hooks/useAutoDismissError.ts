import { useEffect, useState } from "react";

/**
 * Holds an error string that auto-clears after `delay` ms, so transient
 * validation/upload errors don't linger in the UI until the next action.
 * Returns the current message and a setter; pass `null` to dismiss early.
 */
export function useAutoDismissError(delay = 4000): [string | null, (msg: string | null) => void] {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), delay);
    return () => clearTimeout(timer);
  }, [error, delay]);

  return [error, setError];
}

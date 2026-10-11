import { useEffect, useState } from 'react';

/**
 * How long a load can take before it gets a loading state at all. Most finish
 * inside it, and then nothing appears only to be swapped out a moment later.
 */
export const LOADING_DELAY_MS = 250;

/** False until `ms` after the component mounts, then true for good. */
export function useDelayPassed(ms = LOADING_DELAY_MS): boolean {
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPassed(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return passed;
}

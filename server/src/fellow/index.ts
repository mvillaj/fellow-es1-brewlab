import { liveFellowClient } from './live';
import type { FellowClient } from './types';

export * from './types';

/**
 * There used to be a simulated client here, selected by FELLOW_MODE. It went
 * because a real user could not tell a fake ES1 from theirs. Routes still go
 * through this rather than importing the client, so the seam is one place.
 */
export function getFellowClient(): FellowClient {
  return liveFellowClient;
}

import { liveFellowClient } from './live';
import { mockFellowClient } from './mock';
import type { FellowClient } from './types';

export * from './types';

/**
 * FELLOW_MODE=live points at the real cloud API. Anything else — including
 * unset — uses the mock, so the app works out of the box.
 */
export function getFellowClient(): FellowClient {
  return process.env.FELLOW_MODE === 'live' ? liveFellowClient : mockFellowClient;
}

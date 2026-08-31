import type { PreservedWireFields } from './live';
import type { Es1Profile, FellowDevice } from '@brewlab/shared';

export interface FellowSession {
  email: string;
  accessToken: string;
}

export interface PushResult {
  ok: boolean;
  fellowProfileId?: string;
  shareLink?: string;
  /** Raw response body, surfaced in the UI so you can iterate against the real API. */
  raw?: unknown;
  message: string;
}

/**
 * Everything the app needs from Fellow, behind one seam.
 *
 * There are two implementations. `mock` always works and is what the demo runs
 * on. `live` talks to the real cloud API that fellow-aiden / fellow-aiden-ts
 * reverse-engineered. The live one is a hypothesis: those clients were written
 * for the Aiden drip brewer, and there is no public evidence that the ES1 shares
 * the backend or the profile schema. It exists so you can point it at a real
 * account, dump what comes back, and find out.
 */
export interface FellowClient {
  readonly mode: 'mock' | 'live';
  login(email: string, password: string): Promise<FellowSession>;
  listDevices(session: FellowSession): Promise<FellowDevice[]>;
  listProfiles(session: FellowSession, deviceId: string): Promise<unknown[]>;
  /** Creates a new profile. Always lands in the custom folder. */
  pushProfile(
    session: FellowSession,
    deviceId: string,
    profile: Es1Profile,
    preserved?: PreservedWireFields | null,
  ): Promise<PushResult>;
  /**
   * Updates an existing profile in place. Callers must have established that the
   * target is ours to write -- see `profileOrigin`.
   */
  updateProfile(
    session: FellowSession,
    deviceId: string,
    fellowProfileId: string,
    profile: Es1Profile,
    preserved?: PreservedWireFields | null,
  ): Promise<PushResult>;
  deleteProfile(session: FellowSession, deviceId: string, fellowProfileId: string): Promise<void>;
}

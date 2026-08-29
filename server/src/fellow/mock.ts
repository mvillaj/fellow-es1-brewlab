import type { Es1Profile, FellowDevice } from '@brewlab/shared';
import { STOCK_PROFILES, totalDurationS } from '@brewlab/shared';
import { toEs1Payload, profileOrigin, type Es1WireProfileRead, type PreservedWireFields } from './live';
import type { FellowClient, FellowSession, PushResult } from './types';

/**
 * An in-memory stand-in for Fellow's cloud. It behaves the way we believe the
 * real thing behaves — accepts a login, exposes an ES1, stores profiles, hands
 * back a brew.link-style share URL — so the whole app can be demoed end to end
 * without credentials or network.
 *
 * It stores the **wire** shape, not our model, and starts pre-populated with the
 * seven factory profiles. Both matter: an empty store meant "Dump profiles"
 * returned nothing on a fresh server, and storing our model meant the mock never
 * exercised the wire round-trip or the factory/custom distinction that the whole
 * read-only guardrail rests on.
 */
const store = new Map<string, Map<string, Es1WireProfileRead>>();
let seq = 0;

/** Shaped after a real two-device account, so the mock exercises the same code paths. */
const DEVICES: FellowDevice[] = [
  {
    id: 'FS_00000000-0000-0000-0000-000000000001',
    displayName: 'Espresso Series 1',
    model: 'Espresso Series 1',
    family: 'espresso',
    sku: '1SSE-NA',
    serialNumber: '040526050354',
    firmware: '2.3.20',
    activeProfileId: '2_mediumroast',
    enabledFlags: ['base', 'profiles', 'notifications', 'schedules', 'remoteBrewing'],
    isConnected: true,
    supportsEspressoProfiles: true,
  },
  {
    id: 'FB_00000000-0000-0000-0000-000000000002',
    displayName: 'Aiden',
    model: 'Aiden',
    family: 'brewer',
    sku: 'EBRWS-NA',
    firmware: '1.5.9',
    activeProfileId: 'plocal1',
    enabledFlags: ['base', 'profiles', 'notifications', 'schedules', 'remoteBrewing'],
    isConnected: true,
    supportsEspressoProfiles: false,
  },
];

const ES1 = DEVICES[0].id;

/** `1_lightroast` .. `7_turboshot`, matching the real id convention. */
function factoryId(name: string, i: number) {
  return `${i + 1}_${name.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
}

/**
 * Seeded once per process. The factory profiles are spelled with a capital-F
 * folder deliberately: that is what the real captured account contains, and it
 * is exactly the case a naive `folder === 'fellow'` check would misread as
 * writable.
 */
function seedStore() {
  if (store.has(ES1)) return;
  const bucket = new Map<string, Es1WireProfileRead>();

  STOCK_PROFILES.forEach((stock, i) => {
    const id = factoryId(stock.name, i);
    bucket.set(id, {
      ...toEs1Payload({ ...stock, id }),
      id,
      folder: 'Fellow',
      isDefaultProfile: true,
      synced: true,
      version: 16,
      deviceId: ES1,
      deletedAt: null,
    });
  });

  // One of the user's own, so the editable path has something to act on.
  const mine: Es1Profile = {
    ...STOCK_PROFILES[0],
    id: 'mine1',
    name: 'My Brew',
    description: 'Something I made earlier.',
  };
  bucket.set('vB6YrHqqUllak3x', {
    ...toEs1Payload(mine),
    id: 'vB6YrHqqUllak3x',
    folder: 'custom',
    isDefaultProfile: false,
    transition: 'fast',
    decliningTemp: 'on',
    synced: true,
    version: 16,
    deviceId: ES1,
    deletedAt: null,
  });

  store.set(ES1, bucket);
}

export const mockFellowClient: FellowClient = {
  mode: 'mock',

  async login(email, password) {
    if (!email || !password) throw new Error('Email and password are required');
    if (password.length < 4) throw new Error('Fellow rejected those credentials');
    return { email, accessToken: `mock_${Buffer.from(email).toString('base64url')}` };
  },

  async listDevices() {
    return DEVICES;
  },

  async listProfiles(_session, deviceId) {
    seedStore();
    return [...(store.get(deviceId)?.values() ?? [])];
  },

  async pushProfile(_session, deviceId, profile, preserved): Promise<PushResult> {
    seedStore();
    const device = DEVICES.find((d) => d.id === deviceId);
    if (!device) return { ok: false, message: `No device ${deviceId} on this account` };
    if (!device.supportsEspressoProfiles) {
      return {
        ok: false,
        message: `${device.displayName} is a ${device.model} — it cannot accept an espresso profile.`,
      };
    }
    const seconds = totalDurationS(profile);
    if (seconds > 180) {
      return { ok: false, message: `Shot is ${seconds}s; the machine caps a profile at 180s.` };
    }
    const bucket = store.get(deviceId) ?? new Map<string, Es1WireProfileRead>();
    store.set(deviceId, bucket);
    // 15-char ids, matching the real custom-profile convention.
    const fellowId = `mock${String(seq++).padStart(11, '0')}`;
    bucket.set(fellowId, {
      ...toEs1Payload(profile, preserved),
      id: fellowId,
      folder: 'custom',
      isDefaultProfile: false,
      synced: true,
      version: 16,
      deviceId,
      deletedAt: null,
    });
    return {
      ok: true,
      fellowProfileId: fellowId,
      shareLink: `https://brew.link/p/${Buffer.from(`${fellowId}${profile.name}`)
        .toString('base64url')
        .slice(0, 10)}`,
      message: `Sent "${profile.name}" to ${device.displayName}.`,
      raw: { simulated: true, deviceId, fellowId },
    };
  },

  async updateProfile(_session, deviceId, fellowProfileId, profile, preserved): Promise<PushResult> {
    seedStore();
    const bucket = store.get(deviceId);
    const existing = bucket?.get(fellowProfileId);
    if (!bucket || !existing) {
      return { ok: false, message: `No profile ${fellowProfileId} on this device` };
    }
    // The real cloud would presumably refuse this too, but we do not rely on
    // that: the mock enforces it so the guardrail is exercised in tests.
    if (profileOrigin(existing) !== 'custom') {
      return {
        ok: false,
        message: `"${existing.title}" is a Fellow profile and cannot be overwritten. Save it as your own instead.`,
      };
    }
    bucket.set(fellowProfileId, {
      ...existing,
      ...toEs1Payload(profile, preserved),
      id: fellowProfileId,
      folder: 'custom',
      updatedAt: new Date(0).toISOString(),
    });
    return {
      ok: true,
      fellowProfileId,
      raw: { simulated: true, deviceId, fellowProfileId },
      message: `Updated "${profile.name}" on the machine.`,
    };
  },

  async deleteProfile(_session, deviceId, fellowProfileId) {
    seedStore();
    const bucket = store.get(deviceId);
    const existing = bucket?.get(fellowProfileId);
    if (!bucket || !existing) return;
    if (profileOrigin(existing) !== 'custom') {
      throw new Error(`"${existing.title}" is a Fellow profile and cannot be deleted.`);
    }
    bucket.delete(fellowProfileId);
  },
};

export type { PreservedWireFields };

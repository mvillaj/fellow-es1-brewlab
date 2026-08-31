/**
 * Seeds a demo world: three brewers, a shared shelf of coffees, the Fellow
 * factory profiles, and a fortnight of shots that actually tell a story —
 * one bag being dialled in from gushing to good.
 *
 * Safe to re-run: it wipes the tables it owns first.
 */
import {
  BUILT_IN_GRINDERS,
  BUILT_IN_MACHINES,
  STOCK_PROFILES,
  settingToMicrons,
  specToUserGrinder,
  specToUserMachine,
  type GrinderSpec,
  type MachineSpec,
} from '@brewlab/shared';
import { bool, db, id, nowIso } from './lib/db';

for (const table of [
  'shots',
  'brew_profiles',
  'coffees',
  'grinders',
  'machines',
  'fellow_connections',
  'users',
]) {
  db.exec(`DELETE FROM ${table}`);
}

/**
 * Demo brewers, not accounts. Clerk owns sign-in now, and these rows carry
 * local ids rather than Clerk user ids, so nobody can log in as them — they
 * exist to give the Explore page a populated shelf of public profiles to show
 * a brand-new account on its first visit.
 */
function makeUser(email: string, displayName: string) {
  const uid = id('usr');
  db.prepare(
    'INSERT INTO users (id, email, display_name, created_at) VALUES (?, ?, ?, ?)',
  ).run(uid, email, displayName, nowIso());
  return uid;
}

function addMachine(userId: string, spec: MachineSpec, isDefault = false) {
  const mid = id('mch');
  const m = specToUserMachine(spec);
  db.prepare(
    `INSERT INTO machines (id, user_id, built_in_id, name, capabilities, limits, is_default, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    mid,
    userId,
    spec.id,
    m.name,
    JSON.stringify(m.capabilities),
    JSON.stringify(m.limits),
    bool(isDefault),
    spec.notes ?? null,
    nowIso(),
  );
  return { id: mid, ...m };
}

function addGrinder(userId: string, spec: GrinderSpec, isDefault = false) {
  const gid = id('grd');
  const g = specToUserGrinder(spec);
  db.prepare(
    `INSERT INTO grinders (id, user_id, built_in_id, name, burr_type, scale, calibration, is_default, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    gid,
    userId,
    spec.id,
    g.name,
    spec.burrType,
    JSON.stringify(g.scale),
    JSON.stringify(g.calibration),
    bool(isDefault),
    spec.notes ?? null,
    nowIso(),
  );
  return { id: gid, ...g };
}

function addCoffee(ownerId: string, c: Record<string, any>) {
  const cid = id('cof');
  db.prepare(
    `INSERT INTO coffees (id, owner_id, name, roaster, origin, region, producer, varietal, process,
       roast_level, altitude_masl, roast_date, tasting_notes, url, notes, is_public, cloned_from_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)`,
  ).run(
    cid,
    ownerId,
    c.name,
    c.roaster,
    c.origin ?? null,
    c.region ?? null,
    c.producer ?? null,
    c.varietal ?? null,
    c.process ?? null,
    c.roastLevel ?? null,
    c.altitudeMasl ?? null,
    c.roastDate ?? null,
    JSON.stringify(c.tastingNotes ?? []),
    c.url ?? null,
    c.notes ?? null,
    bool(c.isPublic ?? true),
    nowIso(),
  );
  return cid;
}

function addProfile(userId: string, p: any, isPublic: boolean) {
  const pid = id('prf');
  const now = nowIso();
  db.prepare(
    `INSERT INTO brew_profiles (id, user_id, name, description, is_public, profile, sync_state, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'local', ?, ?)`,
  ).run(pid, userId, p.name, p.description ?? null, bool(isPublic), JSON.stringify({ ...p, id: pid }), now, now);
  return pid;
}

interface ShotSeed {
  daysAgo: number;
  hour: number;
  grindSetting: number;
  doseG: number;
  yieldG: number;
  shotTimeS: number;
  preInfusionS?: number;
  rating?: number;
  tasteBalance?: number;
  notes?: string;
  flavourNotes?: string[];
}

function addShot(
  userId: string,
  coffeeId: string,
  grinder: { id: string; calibration: any; scale: any; name: string; builtInId?: string | null },
  machineId: string | null,
  profileId: string | null,
  s: ShotSeed,
) {
  const when = new Date(Date.now() - s.daysAgo * 86400_000);
  when.setHours(s.hour, 12, 0, 0);
  db.prepare(
    `INSERT INTO shots (id, user_id, coffee_id, grinder_id, machine_id, profile_id, brewed_at, grind_setting, grind_microns,
       dose_g, yield_g, shot_time_s, pre_infusion_s, brew_temp_c, peak_pressure_bar, basket, wdt,
       rating, taste_balance, flavour_notes, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
  ).run(
    id('sht'),
    userId,
    coffeeId,
    grinder.id,
    machineId,
    profileId,
    when.toISOString(),
    s.grindSetting,
    Math.round(settingToMicrons(grinder as any, s.grindSetting)),
    s.doseG,
    s.yieldG,
    s.shotTimeS,
    s.preInfusionS ?? 5,
    93,
    9,
    '18g single wall',
    s.rating ?? null,
    s.tasteBalance ?? null,
    JSON.stringify(s.flavourNotes ?? []),
    s.notes ?? null,
    when.toISOString(),
  );
}

// ── People ──────────────────────────────────────────────────────────────────
const michael = makeUser('michael@example.com', 'Michael');
const dana = makeUser('dana@example.com', 'Dana');
const sam = makeUser('sam@example.com', 'Sam');

const machineSpec = (i: string) => BUILT_IN_MACHINES.find((m) => m.id === i)!;
const es1 = addMachine(michael, machineSpec('fellow-es1'), true);
const danaEs1 = addMachine(dana, machineSpec('fellow-es1'), true);
// Sam runs something off-catalogue, so his account shows the app with the
// profile studio and Fellow page switched off.
addMachine(sam, machineSpec('generic-espresso'), true);

const spec = (i: string) => BUILT_IN_GRINDERS.find((g) => g.id === i)!;
const opus2 = addGrinder(michael, spec('fellow-opus-2'), true);
const jUltra = addGrinder(michael, spec('1zpresso-j-ultra'));
addGrinder(michael, spec('fellow-opus'));
const niche = addGrinder(dana, spec('niche-zero'), true);
addGrinder(sam, spec('df64'), true);

// ── The shared shelf ────────────────────────────────────────────────────────
const ethiopia = addCoffee(michael, {
  name: 'Guji Uraga',
  roaster: 'Onyx Coffee Lab',
  origin: 'Ethiopia',
  region: 'Guji',
  varietal: 'Heirloom',
  process: 'washed',
  roastLevel: 'light',
  altitudeMasl: 2100,
  roastDate: new Date(Date.now() - 12 * 86400_000).toISOString().slice(0, 10),
  tastingNotes: ['peach', 'jasmine', 'black tea'],
  notes: 'Wants heat and a long ratio. Fought me for three days.',
  isPublic: true,
});
const colombia = addCoffee(dana, {
  name: 'El Vergel Pink Bourbon',
  roaster: 'Sey Coffee',
  origin: 'Colombia',
  region: 'Tolima',
  producer: 'Elias Bayter',
  varietal: 'Pink Bourbon',
  process: 'anaerobic',
  roastLevel: 'light',
  altitudeMasl: 1550,
  tastingNotes: ['lychee', 'strawberry', 'cane sugar'],
  notes: 'Anaerobic — go coarser than feels right or it chokes.',
  isPublic: true,
});
addCoffee(sam, {
  name: 'Nucleus Blend',
  roaster: 'Nucleus Coffee',
  origin: 'Brazil / Ethiopia',
  process: 'natural',
  roastLevel: 'medium-dark',
  tastingNotes: ['cocoa', 'hazelnut', 'brown sugar'],
  notes: 'Milk-drink workhorse. Forgiving.',
  isPublic: true,
});
addCoffee(dana, {
  name: 'Kenya Kirinyaga AA',
  roaster: 'Prodigal',
  origin: 'Kenya',
  region: 'Kirinyaga',
  varietal: 'SL28 / SL34',
  process: 'washed',
  roastLevel: 'light',
  altitudeMasl: 1800,
  tastingNotes: ['blackcurrant', 'grapefruit', 'tomato'],
  isPublic: true,
});
addCoffee(michael, {
  name: 'Decaf Sugarcane Huila',
  roaster: 'Bird Rock',
  origin: 'Colombia',
  process: 'washed',
  roastLevel: 'medium',
  tastingNotes: ['caramel', 'red apple'],
  notes: 'Evening shots. Runs faster than the caffeinated version at the same setting.',
  isPublic: false,
});

// ── Profiles ────────────────────────────────────────────────────────────────
const stockByName = Object.fromEntries(STOCK_PROFILES.map((p) => [p.name, p]));
const lightRoast = addProfile(michael, stockByName['Light Roast'], true);
addProfile(michael, stockByName['Lever'], true);
addProfile(michael, stockByName['Turbo Shot'], false);
addProfile(dana, stockByName['Modern Arc'], true);
addProfile(sam, stockByName['Classic 9 Bar'], true);
addProfile(michael, {
  ...stockByName['Light Roast'],
  name: 'Guji Long Bloom',
  description: 'Light Roast with a 12 s pre-infusion — what finally made the Guji sweet.',
  ratio: 2.7,
  brewTempC: 94,
  stages: [
    { id: 's1', kind: 'preinfusion', label: 'Pre-infusion', durationS: 12, pressureBar: 2.5, endPressureBar: 3, flowLimitMlS: 3 },
    { id: 's2', kind: 'infusion', label: 'Infusion', durationS: 18, pressureBar: 9, endPressureBar: 9, flowLimitMlS: 4.5 },
    { id: 's3', kind: 'rampdown', label: 'Ramp down', durationS: 6, pressureBar: 9, endPressureBar: 4, flowLimitMlS: 4.5 },
  ],
}, true);

// ── A dial-in that actually goes somewhere ──────────────────────────────────
const dialIn: ShotSeed[] = [
  { daysAgo: 11, hour: 7, grindSetting: 9, doseG: 18, yieldG: 44, shotTimeS: 16, rating: 1, tasteBalance: -2, notes: 'Gusher. Straight to the sink.', flavourNotes: ['sour', 'thin'] },
  { daysAgo: 10, hour: 7, grindSetting: 7, doseG: 18, yieldG: 41, shotTimeS: 20, rating: 2, tasteBalance: -2, notes: 'Still fast, still sharp.', flavourNotes: ['sour', 'lemon'] },
  { daysAgo: 9, hour: 8, grindSetting: 5, doseG: 18, yieldG: 40, shotTimeS: 25, rating: 3, tasteBalance: -1, notes: 'Getting somewhere. Peach showing up.', flavourNotes: ['peach', 'bright'] },
  { daysAgo: 8, hour: 7, grindSetting: 4, doseG: 18, yieldG: 45, shotTimeS: 29, rating: 4, tasteBalance: 0, notes: 'Long ratio suits it. Jasmine on the finish.', flavourNotes: ['peach', 'jasmine'] },
  { daysAgo: 7, hour: 7, grindSetting: 3, doseG: 18, yieldG: 47, shotTimeS: 34, rating: 3, tasteBalance: 1, notes: 'One step too far — drying.', flavourNotes: ['drying', 'tannic'] },
  { daysAgo: 6, hour: 8, grindSetting: 4, doseG: 18, yieldG: 48, shotTimeS: 30, rating: 5, tasteBalance: 0, notes: 'This is the one. 12s pre-infusion.', flavourNotes: ['peach', 'jasmine', 'black tea'], preInfusionS: 12 },
  { daysAgo: 4, hour: 7, grindSetting: 4, doseG: 18, yieldG: 48, shotTimeS: 31, rating: 5, tasteBalance: 0, notes: 'Repeated it. Holding.', flavourNotes: ['peach', 'jasmine'], preInfusionS: 12 },
  { daysAgo: 2, hour: 7, grindSetting: 4.5, doseG: 18, yieldG: 47, shotTimeS: 28, rating: 4, tasteBalance: 0, notes: 'Day 10 off roast, opening up. Half step coarser.', flavourNotes: ['peach', 'honey'], preInfusionS: 12 },
];
for (const s of dialIn) addShot(michael, ethiopia, opus2, es1.id, lightRoast, s);

// Same bag on the hand grinder — this is what makes the converter worth having.
addShot(michael, ethiopia, jUltra, es1.id, lightRoast, {
  daysAgo: 3, hour: 15, grindSetting: 33, doseG: 18, yieldG: 46, shotTimeS: 30, rating: 4,
  tasteBalance: 0, notes: 'Travel setup. Converter said 33 clicks; it was right.',
  flavourNotes: ['peach', 'clean'], preInfusionS: 12,
});

for (const s of [
  { daysAgo: 5, hour: 9, grindSetting: 14, doseG: 18, yieldG: 38, shotTimeS: 27, rating: 4, tasteBalance: 0, notes: 'Lychee is unmistakable.', flavourNotes: ['lychee', 'strawberry'] },
  { daysAgo: 3, hour: 9, grindSetting: 15, doseG: 18, yieldG: 40, shotTimeS: 25, rating: 5, tasteBalance: 0, notes: 'Coarser was right for the anaerobic.', flavourNotes: ['lychee', 'cane sugar'] },
  { daysAgo: 1, hour: 8, grindSetting: 15, doseG: 18, yieldG: 39, shotTimeS: 26, rating: 4, tasteBalance: 0, flavourNotes: ['strawberry'] },
] as ShotSeed[]) {
  addShot(dana, colombia, niche, danaEs1.id, null, s);
}

const counts = ['users', 'machines', 'grinders', 'coffees', 'brew_profiles', 'shots'].map((t) => {
  const row = db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as any;
  return `${row.n} ${t}`;
});

console.log(`Seeded: ${counts.join(', ')}`);
console.log('\nThese are demo brewers, not sign-in accounts — Clerk owns sign-in now.');
console.log('Their public profiles are what the Explore page shows a new account:');
console.log('  michael@example.com   (3 grinders, a dial-in in progress)');
console.log('  dana@example.com');
console.log('  sam@example.com');
console.log('\nSign up through the app itself to get your own bench.');

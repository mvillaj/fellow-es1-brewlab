/**
 * Dependency-free tests for the pure logic. Run with:
 *   npm test
 * which is `node --experimental-strip-types --test` — no test runner to install.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  BUILT_IN_GRINDERS,
  GRINDERS_BY_ID,
  calibrateFromTwoPoints,
  convertSetting,
  grindBucket,
  settingToMicrons,
  snapToScale,
  specToUserGrinder,
} from './grinders.ts';
import { ES1_LIMITS, STOCK_PROFILES, pressureCurve, totalDurationS, yieldG } from './es1.ts';
import {
  BUILT_IN_MACHINES,
  NO_MACHINE_CAPABILITIES,
  activeMachine,
  capabilitiesOf,
  specToUserMachine,
} from './machines.ts';
import { coffeeExtractionSchema, suggestionToProfile } from './ai.ts';
import { buildStages, splitStages } from './es1.ts';
import { roundF } from './temp.ts';
import { es1ProfileSchema, es1StageSchema } from './schemas.ts';
import { flowRate, ratioOf, suggestNextShot } from './dialin.ts';

const g = (id: string) => specToUserGrinder(GRINDERS_BY_ID[id]);

test('every built-in grinder has a unique id and a sane dial', () => {
  const ids = new Set<string>();
  for (const spec of BUILT_IN_GRINDERS) {
    assert.ok(!ids.has(spec.id), `duplicate grinder id: ${spec.id}`);
    ids.add(spec.id);
    assert.ok(spec.scale.max > spec.scale.min, `${spec.id} dial is inverted`);
    assert.ok(spec.scale.step > 0, `${spec.id} step must be positive`);
  }
});

test('every espresso range lands inside a plausible espresso particle window', () => {
  // The whole point of the micron model is cross-grinder comparability. If a
  // grinder's own espresso window maps somewhere absurd, the model is wrong for
  // that grinder and conversions through it will be wrong too.
  for (const spec of BUILT_IN_GRINDERS) {
    if (!spec.espressoRange) continue;
    const [lo, hi] = spec.espressoRange;
    const loUm = settingToMicrons(specToUserGrinder(spec), lo);
    const hiUm = settingToMicrons(specToUserGrinder(spec), hi);
    assert.ok(loUm >= 150 && loUm <= 320, `${spec.id} fine end is ${Math.round(loUm)}µm`);
    assert.ok(hiUm >= 300 && hiUm <= 520, `${spec.id} coarse end is ${Math.round(hiUm)}µm`);
    assert.ok(hiUm > loUm, `${spec.id} espresso range is backwards`);
  }
});

test('converting a setting there and back is stable within one step', () => {
  const from = g('fellow-opus-2');
  const to = g('1zpresso-j-ultra');
  for (const setting of [2, 4, 6, 8]) {
    const there = convertSetting(from, setting, to);
    const back = convertSetting(to, there.setting, from);
    assert.ok(
      Math.abs(back.setting - setting) <= from.scale.step,
      `round trip drifted: ${setting} -> ${there.setting} -> ${back.setting}`,
    );
  }
});

test('conversion confidence is the weaker of the two calibrations', () => {
  const measured = g('1zpresso-j-ultra'); // measured
  const estimated = g('fellow-opus-2'); // estimated
  assert.equal(convertSetting(measured, 30, estimated).confidence, 'estimated');
  assert.equal(convertSetting(estimated, 4, measured).confidence, 'estimated');
});

test('a setting off the end of the target dial is flagged, not silently clamped away', () => {
  const ode = g('fellow-ode-2'); // coarse, brew-focused
  const jUltra = g('1zpresso-j-ultra');
  const result = convertSetting(ode, 11, jUltra); // very coarse -> way past the espresso dial
  assert.equal(result.outOfRange, true);
  assert.equal(result.setting, jUltra.scale.max);
});

test('snapping respects step size without floating-point dust', () => {
  const df64 = g('df64'); // 0.1 turn steps
  assert.equal(snapToScale(df64, 1.23), 1.2);
  assert.equal(snapToScale(df64, 1.26), 1.3);
  assert.equal(snapToScale(df64, -5), 0);
  assert.equal(snapToScale(df64, 99), 10);
});

test('two-point calibration reproduces its own reference points', () => {
  const cal = calibrateFromTwoPoints({ setting: 10, microns: 300 }, { setting: 20, microns: 500 });
  const grinder = { name: 'test', scale: g('niche-zero').scale, calibration: cal };
  assert.equal(settingToMicrons(grinder, 10), 300);
  assert.equal(settingToMicrons(grinder, 20), 500);
  assert.throws(() => calibrateFromTwoPoints({ setting: 5, microns: 200 }, { setting: 5, microns: 400 }));
});

test('grind buckets are ordered and cover the range', () => {
  assert.equal(grindBucket(250), 'Espresso');
  assert.equal(grindBucket(600), 'Medium (pour over)');
  assert.equal(grindBucket(1200), 'Extra coarse (cold brew)');
});

test('every stock profile is inside the ES1 hardware limits', () => {
  for (const p of STOCK_PROFILES) {
    assert.ok(p.brewTempC >= ES1_LIMITS.tempC.min && p.brewTempC <= ES1_LIMITS.tempC.max, p.name);
    assert.ok(p.stages.length >= 1 && p.stages.length <= ES1_LIMITS.stages.max, p.name);
    assert.ok(totalDurationS(p) <= ES1_LIMITS.totalDurationS.max, p.name);
    for (const s of p.stages) {
      assert.ok(s.pressureBar <= ES1_LIMITS.pressureBar.max, `${p.name}: ${s.pressureBar} bar`);
      assert.ok(s.endPressureBar <= ES1_LIMITS.pressureBar.max, `${p.name}: ${s.endPressureBar} bar`);
      assert.ok(s.flowLimitMlS <= ES1_LIMITS.flowMlS.max, `${p.name}: ${s.flowLimitMlS} ml/s`);
      assert.ok(s.durationS >= 1, `${p.name}: ${s.durationS}s stage`);
    }
  }
});

test('the pressure curve starts at t=0 and ends at the shot length', () => {
  const lever = STOCK_PROFILES.find((p) => p.name === 'Lever')!;
  const curve = pressureCurve(lever);
  assert.equal(curve[0].t, 0);
  assert.equal(curve[curve.length - 1].t, totalDurationS(lever));
  // The Lever profile descends: its last infusion pressure is below its first.
  assert.ok(lever.stages[lever.stages.length - 1].pressureBar < lever.stages[1].pressureBar);
});

test('yield follows dose and ratio', () => {
  assert.equal(yieldG({ doseG: 18, ratio: 2 }), 36);
  assert.equal(yieldG({ doseG: 18, ratio: 2.5 }), 45);
});

test('dial-in suggests finer for a fast sour shot and coarser for a slow bitter one', () => {
  const fastSour = suggestNextShot({ doseG: 18, yieldG: 44, shotTimeS: 16, tasteBalance: -2 });
  assert.equal(fastSour.direction, 'finer');
  assert.equal(fastSour.confidence, 'high');

  const slowBitter = suggestNextShot({ doseG: 18, yieldG: 40, shotTimeS: 36, tasteBalance: 2 });
  assert.equal(slowBitter.direction, 'coarser');

  const onTarget = suggestNextShot({ doseG: 18, yieldG: 48, shotTimeS: 29, tasteBalance: 0 });
  assert.equal(onTarget.direction, 'hold');
});

test('on-time but off-taste shots change the ratio, not the grind', () => {
  assert.equal(suggestNextShot({ doseG: 18, yieldG: 36, shotTimeS: 28, tasteBalance: -1 }).direction, 'more-yield');
  assert.equal(suggestNextShot({ doseG: 18, yieldG: 36, shotTimeS: 28, tasteBalance: 1 }).direction, 'less-yield');
});

test('a shot with no taste rating gets a low-confidence hold', () => {
  const s = suggestNextShot({ doseG: 18, yieldG: 36, shotTimeS: 28 });
  assert.equal(s.direction, 'hold');
  assert.equal(s.confidence, 'low');
});

test('flow rate excludes pre-infusion', () => {
  assert.equal(ratioOf({ doseG: 18, yieldG: 36, shotTimeS: 28 }), 2);
  assert.equal(flowRate({ doseG: 18, yieldG: 36, shotTimeS: 30, preInfusionS: 10 }), 1.8);
});

test('every built-in machine round-trips through specToUserMachine', () => {
  for (const spec of BUILT_IN_MACHINES) {
    const m = specToUserMachine(spec);
    assert.equal(m.builtInId, spec.id, spec.id);
    assert.ok(m.name.includes(spec.model), spec.id);
    assert.deepEqual(m.capabilities, spec.capabilities, spec.id);
    assert.deepEqual(m.limits, spec.limits, spec.id);
    assert.ok(m.limits.tempC.min < m.limits.tempC.max, spec.id);
  }
});

test('specToUserMachine copies rather than aliases the spec', () => {
  const spec = BUILT_IN_MACHINES.find((m) => m.id === 'fellow-es1')!;
  const mine = specToUserMachine(spec);
  mine.limits.tempC.max = 200;
  mine.capabilities.profiling = 'none';
  assert.equal(spec.limits.tempC.max, 94, 'catalogue temp must not be mutated');
  assert.equal(spec.capabilities.profiling, 'pressure', 'catalogue capability must not be mutated');
});

test('the ES1 spec agrees with the ES1 profile limits', () => {
  const es1 = BUILT_IN_MACHINES.find((m) => m.id === 'fellow-es1')!;
  assert.equal(es1.limits.tempC.min, ES1_LIMITS.tempC.min);
  assert.equal(es1.limits.tempC.max, ES1_LIMITS.tempC.max);
  assert.equal(es1.limits.maxPressureBar, ES1_LIMITS.pressureBar.max);
});

test('only a machine that profiles offers a profile studio', () => {
  const es1 = BUILT_IN_MACHINES.find((m) => m.id === 'fellow-es1')!;
  const generic = BUILT_IN_MACHINES.find((m) => m.id === 'generic-espresso')!;
  assert.equal(es1.capabilities.profiling, 'pressure');
  assert.equal(es1.capabilities.cloud, 'fellow');
  assert.equal(generic.capabilities.profiling, 'none');
  assert.equal(generic.capabilities.cloud, null, 'a machine we cannot talk to gets no cloud page');
});

test('activeMachine prefers the default and falls back to the first', () => {
  const a = { id: 'a', isDefault: false };
  const b = { id: 'b', isDefault: true };
  assert.equal(activeMachine([a, b])?.id, 'b');
  assert.equal(activeMachine([a])?.id, 'a', 'no default: fall back rather than strand the user');
  assert.equal(activeMachine([]), null);
});

test('capabilitiesOf treats an empty bench as the plain logbook', () => {
  assert.deepEqual(capabilitiesOf(null), NO_MACHINE_CAPABILITIES);
  assert.equal(capabilitiesOf(null).profiling, 'none');
  assert.equal(capabilitiesOf(null).cloud, null);
});

// A generated profile is held to exactly the same standard as a typed one. These
// pin the property that makes the feature safe to point at a real machine.
const GOOD_SUGGESTION = {
  name: 'Guji, gentle',
  description: 'Long pre-infusion for a dense washed Ethiopian.',
  doseG: 18,
  ratio: 2.5,
  brewTempF: 201,
  stages: [
    { kind: 'preinfusion' as const, label: 'Pre-infusion', durationS: 12, pressureBar: 3, endPressureBar: 3, flowLimitMlS: 4 },
    { kind: 'infusion' as const, label: 'Infusion', durationS: 24, pressureBar: 8, endPressureBar: 8, flowLimitMlS: 4.5 },
  ],
  rationale: 'Dense and light, so hotter and longer with a soft ramp.',
};

test('a well-formed suggestion becomes a valid profile', () => {
  const p = suggestionToProfile(GOOD_SUGGESTION, (i) => `s${i}`);
  assert.equal(es1ProfileSchema.safeParse(p).success, true);
  assert.equal(p.stages.length, 2);
  assert.equal(p.stages[0].id, 's0', 'every stage gets an id the editor can key on');
});

test('the model answers in Fahrenheit and storage keeps Celsius', () => {
  // The model works in whole degrees F, the way the machine displays them; the
  // profile that reaches the schema and the wire format is Celsius.
  const p = suggestionToProfile(GOOD_SUGGESTION, (i) => `s${i}`);
  assert.equal(roundF(p.brewTempC), 201, 'round-trips back to the degree it chose');
  assert.ok(Math.abs(p.brewTempC - 93.888) < 0.01, `got ${p.brewTempC}`);
  assert.equal(es1ProfileSchema.safeParse(p).success, true, '201F sits inside the 94C ceiling');
});

test('a Fahrenheit temperature above the machine ceiling is still rejected', () => {
  // 202F is 94.4C — one degree past what the ES1 accepts.
  const p = suggestionToProfile({ ...GOOD_SUGGESTION, brewTempF: 202 }, (i) => `s${i}`);
  assert.equal(es1ProfileSchema.safeParse(p).success, false);
});

test('a suggestion over the pressure ceiling is rejected, not opened', () => {
  const p = suggestionToProfile(
    { ...GOOD_SUGGESTION, stages: [{ ...GOOD_SUGGESTION.stages[1], pressureBar: 15, endPressureBar: 15 }] },
    (i) => `s${i}`,
  );
  assert.equal(es1ProfileSchema.safeParse(p).success, false, '15 bar must not reach the machine');
});

test('a suggestion over the total shot time is rejected', () => {
  const long = Array.from({ length: 8 }, () => ({ ...GOOD_SUGGESTION.stages[1], durationS: 30 }));
  const p = suggestionToProfile({ ...GOOD_SUGGESTION, stages: long }, (i) => `s${i}`);
  assert.equal(es1ProfileSchema.safeParse(p).success, false, '240s exceeds the 180s cap');
});

test('a suggestion far outside the temperature range is rejected', () => {
  const p = suggestionToProfile({ ...GOOD_SUGGESTION, brewTempF: 240 }, (i) => `s${i}`);
  assert.equal(es1ProfileSchema.safeParse(p).success, false);
});

test('the extraction schema keeps unstated fields null rather than inventing them', () => {
  const parsed = coffeeExtractionSchema.safeParse({
    name: 'Guji Uraga',
    roaster: 'Onyx',
    origin: 'Ethiopia',
    region: null,
    producer: null,
    varietal: null,
    process: null,
    roastLevel: null,
    altitudeMasl: null,
    tastingNotes: ['peach', 'jasmine'],
    notFound: ['region', 'producer', 'varietal', 'process', 'roastLevel', 'altitudeMasl'],
    derived: [],
  });
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.process, null);
  assert.equal(parsed.success && parsed.data.notFound.length, 6);
});

test('anything filled from knowledge rather than the page must be declared', () => {
  // The page that prompted this says "San Adolfo" and never names the country, so
  // completing it is useful -- but the user has to be told it was completed.
  const parsed = coffeeExtractionSchema.safeParse({
    name: 'Outpost Coffee',
    roaster: 'PERC COFFEE',
    origin: 'Colombia',
    region: 'San Adolfo, Huila',
    producer: 'Jhon Rodriguez',
    varietal: 'Caturra',
    process: 'washed',
    roastLevel: null,
    altitudeMasl: 1700,
    tastingNotes: ['graham cracker', 'marshmallow'],
    notFound: ['roastLevel'],
    derived: ['origin'],
  });
  assert.equal(parsed.success, true);
  assert.deepEqual(parsed.success && parsed.data.derived, ['origin']);
});

test('the extraction schema rejects a process the app cannot store', () => {
  const bad = coffeeExtractionSchema.safeParse({
    name: 'x', roaster: 'y', origin: null, region: null, producer: null, varietal: null,
    process: 'carbonic-maceration-double-fermented',
    roastLevel: null, altitudeMasl: null, tastingNotes: [], notFound: [], derived: [],
  });
  assert.equal(bad.success, false);
});

// The machine's editor is narrower than the storage format: pre-infusion and
// ramp-down are toggles, infusion is one-or-more flat steps, and a falling curve
// is successive steps rather than a slope. These pin that shape.
const SHOT = {
  preInfusion: { id: 'p1', durationS: 12, pressureBar: 3, flowLimitMlS: 4 },
  infusions: [
    { id: 'i1', durationS: 10, pressureBar: 9 },
    { id: 'i2', durationS: 10, pressureBar: 6 },
  ],
  rampDown: { id: 'r1', durationS: 5, endPressureBar: 3 },
};

test('a shot builds into stages in the order the machine runs them', () => {
  const stages = buildStages(SHOT);
  assert.deepEqual(stages.map((s) => s.kind), ['preinfusion', 'infusion', 'infusion', 'rampdown']);
  assert.deepEqual(stages.map((s) => s.label), ['Pre-infusion', 'Infusion 1', 'Infusion 2', 'Ramp down']);
});

test('every infusion step is flat — a curve is made of steps, not slopes', () => {
  for (const s of buildStages(SHOT).filter((x) => x.kind === 'infusion')) {
    assert.equal(s.pressureBar, s.endPressureBar, `${s.label} sloped`);
  }
});

test('the ramp-down starts where the last infusion ended', () => {
  const ramp = buildStages(SHOT).find((s) => s.kind === 'rampdown')!;
  assert.equal(ramp.pressureBar, 6, 'derived from the final infusion, not entered');
  assert.equal(ramp.endPressureBar, 3);
});

test('splitting and rebuilding is lossless', () => {
  const stages = buildStages(SHOT);
  assert.deepEqual(buildStages(splitStages(stages)), stages);
});

test('both optional phases can be off, leaving a bare infusion', () => {
  const stages = buildStages({ ...SHOT, preInfusion: null, rampDown: null });
  assert.deepEqual(stages.map((s) => s.kind), ['infusion', 'infusion']);
  assert.equal(es1ProfileSchema.safeParse({ ...GOOD_PROFILE, stages }).success, true);
});

test('a profile that arrives with no infusion is still editable', () => {
  // Not reachable through the editor, but a hand-edited or imported profile
  // could be shaped this way and must not produce an empty form.
  const shot = splitStages([]);
  assert.equal(shot.infusions.length, 1);
  assert.equal(shot.preInfusion, null);
});

test('a single infusion is labelled without a number', () => {
  const stages = buildStages({ ...SHOT, infusions: [SHOT.infusions[0]] });
  assert.equal(stages.find((s) => s.kind === 'infusion')!.label, 'Infusion');
});

test('pre-infusion may run longer than an infusion step', () => {
  // 90s is legal on the machine and used to fail, because one duration bound was
  // applied to every kind.
  const stages = buildStages({ ...SHOT, preInfusion: { ...SHOT.preInfusion, durationS: 90 } });
  const parsed = es1StageSchema.safeParse(stages[0]);
  assert.equal(parsed.success, true);
  assert.equal(es1StageSchema.safeParse({ ...stages[1], durationS: 90 }).success, false);
});

const GOOD_PROFILE = { id: 'p', name: 'x', doseG: 18, ratio: 2, brewTempC: 93, stages: [] };

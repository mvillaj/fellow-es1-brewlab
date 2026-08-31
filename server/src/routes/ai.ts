import { Router, type Response } from 'express';
import { z } from 'zod';
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema';
import {
  ES1_LIMITS,
  PROCESS_VALUES,
  roundF,
  RANGE_NOTES,
  ROAST_VALUES,
  coffeeExtractionSchema,
  es1ProfileSchema,
  profileSuggestionSchema,
  suggestionToProfile,
  type AiStatus,
  type Coffee,
  type Es1Profile,
} from '@brewlab/shared';
import { db, id } from '../lib/db';
import { asUrl, fetchPageText } from '../lib/page-text';
import { requireAuth, type AuthedRequest } from '../lib/auth';
import { aiLimiter } from '../lib/limits';
import { budgetRefusal, recordUsage } from '../lib/ai-budget';
import { toCoffee } from '../lib/rows';
import { AI_MODEL, aiClient, aiEnabled, aiUnavailableReason } from '../lib/ai';

export const aiRouter: Router = Router();

/** Public: the client needs this before it renders either control. */
aiRouter.get('/status', (_req, res) => {
  const status: AiStatus = { enabled: aiEnabled(), reason: aiUnavailableReason() };
  res.json(status);
});

aiRouter.use(requireAuth);
// After requireAuth so the limiter keys on the user rather than the address.
aiRouter.use(aiLimiter);

/** Returns true when the request has already been answered. */
function unavailable(res: Response): boolean {
  if (aiEnabled()) return false;
  res.status(503).json({ error: aiUnavailableReason() });
  return true;
}

/**
 * Both gates in one place: the key being absent, and the budget being spent.
 * Checked before the call rather than after, because a ceiling enforced on the
 * way out has already paid for the request it was meant to prevent.
 */
function blocked(req: AuthedRequest, res: Response): boolean {
  if (unavailable(res)) return true;
  const refusal = budgetRefusal(req.userId!);
  if (refusal) {
    res.status(429).json({ error: refusal });
    return true;
  }
  return false;
}

/*
 * The model is constrained by JSON Schema on the way out and re-validated by the
 * shared zod schema on the way in. The schemas below mirror `packages/shared/src/ai.ts`
 * -- structured outputs need every property listed in `required` and
 * `additionalProperties: false`, so a nullable field is expressed as a type union
 * rather than by omitting it.
 */

const COFFEE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    roaster: { type: 'string' },
    origin: { type: ['string', 'null'] },
    region: { type: ['string', 'null'] },
    producer: { type: ['string', 'null'] },
    varietal: { type: ['string', 'null'] },
    process: { type: ['string', 'null'], enum: [...PROCESS_VALUES, null] },
    roastLevel: { type: ['string', 'null'], enum: [...ROAST_VALUES, null] },
    altitudeMasl: { type: ['number', 'null'] },
    tastingNotes: { type: 'array', items: { type: 'string' } },
    notFound: { type: 'array', items: { type: 'string' } },
    derived: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'name',
    'roaster',
    'origin',
    'region',
    'producer',
    'varietal',
    'process',
    'roastLevel',
    'altitudeMasl',
    'tastingNotes',
    'notFound',
    'derived',
  ],
  additionalProperties: false,
} as const;

const PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    description: { type: 'string' },
    doseG: { type: 'number' },
    ratio: { type: 'number' },
    brewTempF: { type: 'number' },
    stages: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['preinfusion', 'infusion', 'rampdown'] },
          label: { type: 'string' },
          durationS: { type: 'number' },
          pressureBar: { type: 'number' },
          endPressureBar: { type: 'number' },
          flowLimitMlS: { type: 'number' },
        },
        required: ['kind', 'label', 'durationS', 'pressureBar', 'endPressureBar', 'flowLimitMlS'],
        additionalProperties: false,
      },
    },
    rationale: { type: 'string' },
  },
  required: ['name', 'description', 'doseG', 'ratio', 'brewTempF', 'stages', 'rationale'],
  additionalProperties: false,
} as const;

/* ── Paste a bag ──────────────────────────────────────────────────────────── */

const extractInput = z.object({ text: z.string().min(10).max(8000) });

aiRouter.post('/extract-coffee', async (req: AuthedRequest, res) => {
  if (blocked(req, res)) return;
  const parsed = extractInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Paste a bit more text than that.' });
    return;
  }

  // A link is the natural thing to paste, so read the page rather than making the
  // model guess from a URL string.
  let source = parsed.data.text;
  const link = asUrl(source);
  if (link) {
    try {
      source = await fetchPageText(link);
    } catch (err) {
      res.status(502).json({ error: `Could not read that page: ${(err as Error).message}` });
      return;
    }
  }

  try {
    const response = await aiClient().messages.parse({
      model: AI_MODEL,
      max_tokens: 4000,
      system:
        'You read coffee packaging and roaster product copy and pull out the facts for one ' +
        'bag of coffee.\n\n' +
        'The text may come from a shop page that mentions other coffees in passing. When a ' +
        '"Product:" line is present, that is the bag being described -- ignore any other ' +
        'coffee, origin or price on the page.\n\n' +
        'Record what the text states. If a field is not stated, return null and add its ' +
        'name to notFound. Do not infer a roast level from tasting notes, or a process from ' +
        'a flavour description.\n\n' +
        'One exception: if the text names a place you recognise as a coffee-growing region ' +
        'but not its country, you may complete it -- "San Adolfo" is in Huila, Colombia -- ' +
        'putting the country in origin and the locality in region. List every field you ' +
        'filled this way in derived, so the user knows which came from the page and which ' +
        'came from you.\n\n' +
        'Tasting notes should be the roaster\'s own short descriptors, lowercased, without ' +
        'commentary.',
      messages: [{ role: 'user', content: source }],
      output_config: { format: jsonSchemaOutputFormat(COFFEE_SCHEMA) },
    });

    recordUsage(req.userId!, 'extract-coffee', AI_MODEL, response.usage);

    const check = coffeeExtractionSchema.safeParse(response.parsed_output);
    if (!check.success) {
      res.status(502).json({ error: 'Could not read that as a coffee.' });
      return;
    }
    res.json(check.data);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

/* ── Suggest a profile for a coffee ───────────────────────────────────────── */

function describeCoffee(c: Coffee): string {
  return [
    `Name: ${c.name}`,
    `Roaster: ${c.roaster}`,
    c.origin && `Origin: ${c.origin}${c.region ? `, ${c.region}` : ''}`,
    c.varietal && `Varietal: ${c.varietal}`,
    c.process && `Process: ${c.process}`,
    c.roastLevel && `Roast level: ${c.roastLevel}`,
    c.altitudeMasl && `Altitude: ${c.altitudeMasl} masl`,
    c.tastingNotes.length ? `Tasting notes: ${c.tastingNotes.join(', ')}` : '',
    c.notes && `Roaster notes: ${c.notes}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** What the machine will actually accept, handed over as hard bounds. */
const MACHINE_BRIEF = [
  `Temperature ${roundF(ES1_LIMITS.tempC.min)}-${roundF(ES1_LIMITS.tempC.max)} °F.`,
  `Pressure ${ES1_LIMITS.pressureBar.min}-${ES1_LIMITS.pressureBar.max} bar.`,
  `Dose ${ES1_LIMITS.doseG.min}-${ES1_LIMITS.doseG.max} g.`,
  `Ratio ${ES1_LIMITS.ratio.min}-${ES1_LIMITS.ratio.max}.`,
  `Each stage ${ES1_LIMITS.stageDurationS.min}-${ES1_LIMITS.stageDurationS.max} s.`,
  `${ES1_LIMITS.stages.min}-${ES1_LIMITS.stages.max} stages, ${ES1_LIMITS.totalDurationS.max} s total at most.`,
  `Flow limit ${ES1_LIMITS.flowMlS.min}-${ES1_LIMITS.flowMlS.max} ml/s.`,
  RANGE_NOTES.pressureBar,
].join(' ');

aiRouter.post('/suggest-profile/:coffeeId', async (req: AuthedRequest, res) => {
  if (blocked(req, res)) return;
  const row = db
    .prepare(
      `SELECT c.*, u.display_name AS owner_name FROM coffees c
       JOIN users u ON u.id = c.owner_id
       WHERE c.id = ? AND (c.owner_id = ? OR c.is_public = 1)`,
    )
    .get(req.params.coffeeId, req.userId!) as any;
  if (!row) {
    res.status(404).json({ error: 'Coffee not found' });
    return;
  }
  const coffee = toCoffee(row);

  try {
    const response = await aiClient().messages.parse({
      model: AI_MODEL,
      max_tokens: 8000,
      thinking: { type: 'adaptive' },
      system:
        'You design espresso shots for the Fellow Espresso Series 1, which runs a shot as ' +
        'ordered timed phases. Each phase targets a pressure and the machine modulates flow ' +
        'to hold it. A falling curve is expressed as successive flat infusion stages, not as ' +
        'one sloped stage. Only pre-infusion honours a flow limit.\n\n' +
        'Work in Fahrenheit throughout — whole degrees, the way the machine displays them. ' +
        'brewTempF is Fahrenheit, and every temperature you mention in the rationale must ' +
        'be Fahrenheit too. Do not mention Celsius at all.\n\n' +
        `Machine limits, never to be exceeded: ${MACHINE_BRIEF}\n\n` +
        'Design for the coffee in front of you rather than returning a factory default: ' +
        'lighter and denser generally wants hotter, longer, and a gentler ramp; darker and ' +
        'softer wants cooler and shorter. In the rationale, say in two or three plain ' +
        'sentences what you chose and why, in terms a person dialling in would recognise.',
      messages: [
        { role: 'user', content: `Design a starting profile for this coffee.\n\n${describeCoffee(coffee)}` },
      ],
      output_config: { format: jsonSchemaOutputFormat(PROFILE_SCHEMA) },
    });

    recordUsage(req.userId!, 'suggest-profile', AI_MODEL, response.usage);

    const check = profileSuggestionSchema.safeParse(response.parsed_output);
    if (!check.success) {
      res.status(502).json({ error: 'Could not design a profile for that coffee.' });
      return;
    }
    const s = check.data;

    // Held to exactly the same standard as anything a user typed: a generation that
    // breaks a machine limit is rejected here rather than opened in the editor.
    const profile: Es1Profile = suggestionToProfile(s, (i) => `sug${i}_${id('stg')}`);

    const valid = es1ProfileSchema.safeParse(profile);
    if (!valid.success) {
      res.status(502).json({
        error: `The suggestion fell outside the machine's limits: ${
          valid.error.issues[0]?.message ?? 'invalid profile'
        }`,
      });
      return;
    }

    res.json({ profile, rationale: s.rationale, coffeeName: coffee.name });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

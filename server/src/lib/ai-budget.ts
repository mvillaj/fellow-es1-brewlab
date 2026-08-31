import { db, id, nowIso } from './db';

/**
 * USD per million tokens for claude-opus-5, the model in ai.ts.
 *
 * These are not interchangeable across the family — the input:output ratio
 * differs by model — so changing AI_MODEL means revisiting this table. Cached
 * reads bill at a tenth of input.
 */
const USD_PER_MTOK = { input: 5, output: 25, cached: 0.5 } as const;

/** The subset of Anthropic's usage object we bill on. */
export interface ModelUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function costOf(usage: ModelUsage): number {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cached = usage.cache_read_input_tokens ?? 0;
  return (
    (input * USD_PER_MTOK.input + output * USD_PER_MTOK.output + cached * USD_PER_MTOK.cached) /
    1_000_000
  );
}

const num = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

/** Deliberately low defaults. An unset ceiling is the failure mode being fixed. */
const userDailyCapUsd = () => num(process.env.AI_USER_DAILY_USD, 1);
const globalDailyCapUsd = () => num(process.env.AI_GLOBAL_DAILY_USD, 5);

const today = () => nowIso().slice(0, 10);

function spend(day: string, userId?: string): number {
  const row = userId
    ? (db
        .prepare('SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_usage WHERE day = ? AND user_id = ?')
        .get(day, userId) as { total: number })
    : (db
        .prepare('SELECT COALESCE(SUM(cost_usd), 0) AS total FROM ai_usage WHERE day = ?')
        .get(day) as { total: number });
  return row.total ?? 0;
}

/** `false` disables both model routes. Flip it without a redeploy; see the migration. */
export function aiDisabledByFlag(): boolean {
  const row = db.prepare("SELECT value FROM app_flags WHERE key = 'ai_enabled'").get() as
    | { value: string }
    | undefined;
  return row?.value === 'false';
}

/**
 * Checked before the call, not after: the point is to not spend the money, and
 * a ceiling enforced on the way out has already lost.
 *
 * The last call of a day can overshoot the cap, because its cost is unknown
 * until it returns. That is bounded by one call — roughly twenty cents at the
 * larger route's ceiling — and is the price of not pre-counting tokens on every
 * request.
 */
export function budgetRefusal(userId: string): string | null {
  if (aiDisabledByFlag()) {
    return 'The model-backed features are switched off right now.';
  }
  const day = today();
  if (spend(day, userId) >= userDailyCapUsd()) {
    return 'You have used your model budget for today. It resets at midnight UTC.';
  }
  if (spend(day) >= globalDailyCapUsd()) {
    return 'The daily model budget for this instance is used up. It resets at midnight UTC.';
  }
  return null;
}

/** Never throws: a metering failure must not turn a good response into an error. */
export function recordUsage(
  userId: string,
  route: string,
  model: string,
  usage: ModelUsage | null | undefined,
): void {
  if (!usage) return;
  try {
    db.prepare(
      `INSERT INTO ai_usage (id, user_id, day, route, model, input_tokens, output_tokens, cached_tokens, cost_usd, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id('aiu'),
      userId,
      today(),
      route,
      model,
      usage.input_tokens ?? 0,
      usage.output_tokens ?? 0,
      usage.cache_read_input_tokens ?? 0,
      costOf(usage),
      nowIso(),
    );
  } catch (err) {
    console.error('Failed to record model usage', err);
  }
}

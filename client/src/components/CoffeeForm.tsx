import { useState } from 'react';
import { asUrl, type Coffee, type CoffeeExtraction } from '@brewlab/shared';
import { api } from '../lib/api';
import { useAi } from '../lib/ai';
import { Banner, Field, Working } from './ui';
import { PROCESSES, ROAST_LEVELS } from '../lib/format';

export default function CoffeeForm({
  existing,
  onSaved,
}: {
  existing?: Coffee | null;
  onSaved: (c: Coffee) => void;
}) {
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    roaster: existing?.roaster ?? '',
    origin: existing?.origin ?? '',
    region: existing?.region ?? '',
    producer: existing?.producer ?? '',
    varietal: existing?.varietal ?? '',
    process: existing?.process ?? '',
    roastLevel: existing?.roastLevel ?? '',
    altitudeMasl: existing?.altitudeMasl ?? '',
    roastDate: existing?.roastDate ?? '',
    tastingNotes: (existing?.tastingNotes ?? []).join(', '),
    url: existing?.url ?? '',
    notes: existing?.notes ?? '',
    isPublic: existing?.isPublic ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const ai = useAi();
  const [paste, setPaste] = useState('');
  const [reading, setReading] = useState(false);
  const [read, setRead] = useState<CoffeeExtraction | null>(null);

  // Fills the form rather than saving: everything stays reviewable, and the
  // fields the text did not cover are named instead of silently left blank.
  async function readBag() {
    setReading(true);
    setError(null);
    try {
      const x = await api<CoffeeExtraction>('/ai/extract-coffee', {
        method: 'POST',
        body: { text: paste },
      });
      setForm((f) => ({
        ...f,
        name: x.name || f.name,
        roaster: x.roaster || f.roaster,
        origin: x.origin ?? f.origin,
        region: x.region ?? f.region,
        producer: x.producer ?? f.producer,
        varietal: x.varietal ?? f.varietal,
        process: x.process ?? f.process,
        roastLevel: x.roastLevel ?? f.roastLevel,
        altitudeMasl: x.altitudeMasl ?? f.altitudeMasl,
        tastingNotes: x.tastingNotes.length ? x.tastingNotes.join(', ') : f.tastingNotes,
        // If a link was what got pasted, it is the coffee's link — no need to
        // make anyone paste the same URL into two boxes.
        url: asUrl(paste) ?? f.url,
      }));
      setRead(x);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setReading(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...form,
        origin: form.origin || null,
        region: form.region || null,
        producer: form.producer || null,
        varietal: form.varietal || null,
        process: form.process || null,
        roastLevel: form.roastLevel || null,
        altitudeMasl: form.altitudeMasl === '' ? null : Number(form.altitudeMasl),
        roastDate: form.roastDate || null,
        url: form.url || null,
        notes: form.notes || null,
        tastingNotes: form.tastingNotes
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const saved = existing
        ? await api<Coffee>(`/coffees/${existing.id}`, { method: 'PATCH', body })
        : await api<Coffee>('/coffees', { method: 'POST', body });
      onSaved(saved);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="stack">
      {!existing ? (
        <div className="card tight stack-sm">
          <Field
            label="Paste from the bag"
            hint={
              ai.enabled
                ? 'Paste a link to the roaster\'s page, or the copy off the back of the bag. It fills the form in; you check it.'
                : ai.reason
            }
          >
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              disabled={!ai.enabled}
              placeholder="https://roaster.com/products/… — or paste the bag copy"
              style={{ minHeight: 78 }}
            />
          </Field>
          <div className="row">
            <button
              type="button"
              className="btn btn-sm"
              onClick={readBag}
              disabled={!ai.enabled || reading || paste.trim().length < 10}
              aria-busy={reading}
            >
              {reading ? <Working label="Reading" /> : 'Read the bag'}
            </button>
            {read ? (
              <span className="small dim">
                Filled in.{' '}
                {read.derived.length ? (
                  <>
                    <strong>Check {read.derived.join(', ')}</strong> — not on the page, filled from
                    what the model knows.{' '}
                  </>
                ) : null}
                {read.notFound.length ? `Not stated: ${read.notFound.join(', ')}.` : 'Everything was on the page.'}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="grid grid-2">
        <Field label="Coffee name">
          <input value={form.name} onChange={set('name')} required placeholder="Guji Uraga" />
        </Field>
        <Field label="Roaster">
          <input value={form.roaster} onChange={set('roaster')} required placeholder="Onyx Coffee Lab" />
        </Field>
      </div>

      <div className="grid grid-3">
        <Field label="Origin">
          <input value={form.origin} onChange={set('origin')} placeholder="Ethiopia" />
        </Field>
        <Field label="Region">
          <input value={form.region} onChange={set('region')} placeholder="Guji" />
        </Field>
        <Field label="Producer">
          <input value={form.producer} onChange={set('producer')} />
        </Field>
      </div>

      <div className="grid grid-4">
        <Field label="Varietal">
          <input value={form.varietal} onChange={set('varietal')} placeholder="Heirloom" />
        </Field>
        <Field label="Process">
          <select value={form.process} onChange={set('process')}>
            <option value="">—</option>
            {PROCESSES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Roast level">
          <select value={form.roastLevel} onChange={set('roastLevel')}>
            <option value="">—</option>
            {ROAST_LEVELS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Altitude (masl)">
          <input type="number" value={form.altitudeMasl} onChange={set('altitudeMasl')} />
        </Field>
      </div>

      <div className="grid grid-2">
        <Field label="Roast date" hint="Used to show days off roast.">
          <input type="date" value={form.roastDate ? form.roastDate.slice(0, 10) : ''} onChange={set('roastDate')} />
        </Field>
        <Field label="Link">
          <input type="url" value={form.url} onChange={set('url')} placeholder="https://" />
        </Field>
      </div>

      <Field label="Tasting notes" hint="Comma separated.">
        <input value={form.tastingNotes} onChange={set('tastingNotes')} placeholder="peach, jasmine, black tea" />
      </Field>

      <Field label="Notes">
        <textarea value={form.notes} onChange={set('notes')} placeholder="How it behaves on the machine." />
      </Field>

      <label className="checkbox">
        <input
          type="checkbox"
          checked={form.isPublic}
          onChange={(e) => setForm((f) => ({ ...f, isPublic: e.target.checked }))}
        />
        Publish to the shared library so other people can browse and clone it
      </label>

      {error ? <Banner kind="bad">{error}</Banner> : null}

      <div>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : existing ? 'Save changes' : 'Add coffee'}
        </button>
      </div>
    </form>
  );
}

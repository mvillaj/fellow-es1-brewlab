import { useState } from 'react';
import { changeKinds, type ChangeKind, type ChangelogEntry, type ChangelogEntryInput } from '@brewlab/shared';
import { api, useApi } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Banner, Empty, Field, Modal } from '../components/ui';

const KIND_LABEL: Record<ChangeKind, string> = { new: 'New', improved: 'Improved', fixed: 'Fixed' };
const KIND_TAG: Record<ChangeKind, string> = { new: 'crema', improved: 'cool', fixed: 'good' };

/** Filed under a calendar date, so format it as one — no timezone shift. */
function longDate(ymd: string) {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Changelog() {
  const { user } = useAuth();
  const { data: entries, error, loading, reload } = useApi<ChangelogEntry[]>('/changelog');
  const [editing, setEditing] = useState<ChangelogEntry | 'new' | null>(null);

  async function remove(e: ChangelogEntry) {
    if (!confirm(`Delete “${e.title}”? This cannot be undone.`)) return;
    await api(`/changelog/${e.id}`, { method: 'DELETE' });
    void reload();
  }

  return (
    <>
      <div className="page-head spread">
        <div>
          <h1>Changelog</h1>
          <p>What changed in Crema, and the thinking behind it.</p>
        </div>
        {user?.isAdmin ? (
          <button className="btn btn-primary" onClick={() => setEditing('new')}>
            New entry
          </button>
        ) : null}
      </div>

      {error ? <Banner kind="bad">{error}</Banner> : null}

      {loading && !entries ? (
        <span className="faint">Loading…</span>
      ) : entries?.length ? (
        <div className="changelog">
          {entries.map((e) => (
            <article className="card changelog-entry" key={e.id}>
              <header className="card-head">
                <div>
                  <div className="row-wrap small dim">
                    <time dateTime={e.publishedOn}>{longDate(e.publishedOn)}</time>
                    {e.version ? <span className="tag mono">{e.version}</span> : null}
                  </div>
                  <h2>{e.title}</h2>
                </div>
                {user?.isAdmin ? (
                  <div className="row">
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(e)}>
                      Edit
                    </button>
                    <button className="btn btn-ghost btn-sm btn-danger" onClick={() => remove(e)}>
                      Delete
                    </button>
                  </div>
                ) : null}
              </header>

              {e.changes.length ? (
                <ul className="changelog-changes">
                  {e.changes.map((c, i) => (
                    <li key={i}>
                      <span className={`tag ${KIND_TAG[c.kind]}`}>{KIND_LABEL[c.kind]}</span>
                      <span>{c.text}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {e.body.trim() ? (
                <div className="changelog-body">
                  {e.body
                    .trim()
                    .split(/\n\s*\n/)
                    .map((para, i) => (
                      <p key={i}>{para}</p>
                    ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Nothing logged yet">
          {user?.isAdmin ? 'Write the first entry.' : 'Updates will show up here.'}
        </Empty>
      )}

      {editing ? (
        <Modal title={editing === 'new' ? 'New entry' : 'Edit entry'} onClose={() => setEditing(null)} wide>
          <EntryForm
            entry={editing === 'new' ? null : editing}
            onSaved={() => {
              setEditing(null);
              void reload();
            }}
          />
        </Modal>
      ) : null}
    </>
  );
}

function EntryForm({ entry, onSaved }: { entry: ChangelogEntry | null; onSaved: () => void }) {
  const [form, setForm] = useState<ChangelogEntryInput>(() => ({
    title: entry?.title ?? '',
    version: entry?.version ?? '',
    publishedOn: entry?.publishedOn ?? today(),
    changes: entry?.changes.length ? entry.changes : [{ kind: 'new', text: '' }],
    body: entry?.body ?? '',
  }));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const setChange = (i: number, patch: Partial<ChangelogEntryInput['changes'][number]>) =>
    setForm((f) => ({ ...f, changes: f.changes.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));

  async function save() {
    setError(null);
    setSaving(true);
    // Blank rows are the spare line the form always offers, not content.
    const body = { ...form, changes: form.changes.filter((c) => c.text.trim()) };
    try {
      await api(entry ? `/changelog/${entry.id}` : '/changelog', {
        method: entry ? 'PUT' : 'POST',
        body,
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack">
      {error ? <Banner kind="bad">{error}</Banner> : null}
      <Field label="Title">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} autoFocus />
      </Field>
      <div className="grid grid-2">
        <Field label="Date">
          <input
            type="date"
            value={form.publishedOn}
            onChange={(e) => setForm({ ...form, publishedOn: e.target.value })}
          />
        </Field>
        <Field label="Version" hint="Optional, e.g. v0.4">
          <input value={form.version ?? ''} onChange={(e) => setForm({ ...form, version: e.target.value })} />
        </Field>
      </div>

      <Field label="Changes">
        <div className="stack-sm">
          {form.changes.map((c, i) => (
            <div className="row changelog-change-input" key={i}>
              <select value={c.kind} onChange={(e) => setChange(i, { kind: e.target.value as ChangeKind })}>
                {changeKinds.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
              <input
                value={c.text}
                placeholder="What changed"
                onChange={(e) => setChange(i, { text: e.target.value })}
              />
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                aria-label="Remove change"
                onClick={() => setForm((f) => ({ ...f, changes: f.changes.filter((_, j) => j !== i) }))}
              >
                ✕
              </button>
            </div>
          ))}
          <div>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setForm((f) => ({ ...f, changes: [...f.changes, { kind: 'new', text: '' }] }))}
            >
              Add change
            </button>
          </div>
        </div>
      </Field>

      <Field label="Notes" hint="Dev notes, context, what's next. Leave a blank line between paragraphs.">
        <textarea rows={8} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
      </Field>

      <div className="row">
        <button className="btn btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : entry ? 'Save changes' : 'Publish'}
        </button>
      </div>
    </div>
  );
}

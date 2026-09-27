'use client';
import { useMemo, useState } from 'react';
import {
  CalendarDays,
  WandSparkles,
  Plus,
  Trash2,
  Save,
  FlaskConical,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  forecast,
  planWarnings,
  termLabel,
  simulate,
  summary,
  statusOf,
  type RecordData,
  type Plan,
  type Scenario,
} from '@/lib/academic';
import { validateRecord } from '@/lib/import';
import { Choice, Notice, Blank } from './shared';
export function Planner({
  data,
  save,
  busy,
}: {
  data: RecordData;
  save: (d: RecordData) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<RecordData>(() => structuredClone(data)),
    [error, setError] = useState(''),
    [termCount, setTermCount] = useState(
      Math.max(4, ...data.plan.map((t) => t.term + 1)),
    );
  const warnings = useMemo(() => planWarnings(draft), [draft]);
  const projection = useMemo(() => forecast(draft), [draft]);
  const used = new Set(draft.plan.flatMap((t) => t.codes));
  const remaining = draft.curriculum.subjects.filter(
    (s) =>
      !['completed', 'current'].includes(statusOf(draft.statuses, s.code)) &&
      !used.has(s.code),
  );
  function setPlan(plan: Plan) {
    setDraft((d) => ({ ...d, plan }));
  }
  function add(term: number, code: string) {
    const existing = draft.plan.find((t) => t.term === term);
    setPlan(
      existing
        ? draft.plan.map((t) =>
            t.term === term ? { ...t, codes: [...t.codes, code] } : t,
          )
        : [...draft.plan, { term, codes: [code] }],
    );
  }
  function remove(term: number, code: string) {
    setPlan(
      draft.plan.map((t) =>
        t.term === term
          ? { ...t, codes: t.codes.filter((c) => c !== code) }
          : t,
      ),
    );
  }
  function generate() {
    setPlan(projection.plan);
    setTermCount(Math.max(4, projection.plan.length));
    setError('');
  }
  async function commit() {
    setError('');
    try {
      const valid = validateRecord(draft);
      if (planWarnings(valid).length)
        throw new Error(
          'Resolve prerequisite and unit conflicts before saving the plan.',
        );
      await save(valid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid planning settings.');
    }
  }
  const plannedUnits = draft.plan
    .flatMap((t) => t.codes)
    .reduce(
      (n, c) =>
        n + (draft.curriculum.subjects.find((s) => s.code === c)?.units ?? 0),
      0,
    );
  return (
    <div className="stack">
      <section className="panel settings-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">PLANNING ASSUMPTIONS</p>
            <h2>Your first future semester</h2>
          </div>
          <CalendarDays />
        </div>
        <div className="settings-grid">
          <label htmlFor="start-year">
            Academic year starts
            <Input
              id="start-year"
              type="number"
              min="2000"
              max="2100"
              value={draft.settings.startYear}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  settings: {
                    ...d.settings,
                    startYear: Number(e.target.value),
                  },
                }))
              }
            />
          </label>
          <div>
            <p className="field-label">First future semester</p>
            <Choice
              label="First future semester"
              value={String(draft.settings.startSemester)}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  settings: { ...d.settings, startSemester: Number(v) },
                }))
              }
              options={[
                { value: '1', label: 'Semester 1' },
                { value: '2', label: 'Semester 2' },
              ]}
            />
          </div>
          <label htmlFor="max-units">
            Maximum units per term
            <Input
              id="max-units"
              type="number"
              min="1"
              max="40"
              step=".5"
              value={draft.settings.maxUnits}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  settings: { ...d.settings, maxUnits: Number(e.target.value) },
                }))
              }
            />
          </label>
        </div>
        <label htmlFor="assume-pass" className="checkbox-label">
          <Checkbox
            id="assume-pass"
            checked={draft.settings.assumeCurrentPass}
            onCheckedChange={(v) =>
              setDraft((d) => ({
                ...d,
                settings: { ...d.settings, assumeCurrentPass: !!v },
              }))
            }
          />
          Assume I pass all currently taken subjects before this future semester
        </label>
        <p className="muted">
          Prerequisites must be passed in an earlier term. Corequisites may be
          taken together. Offerings follow the reviewed curriculum; all future
          planned subjects are assumed passed.
        </p>
      </section>
      <div className="action-bar">
        <div>
          <strong>
            {draft.plan.flatMap((t) => t.codes).length} planned subjects
          </strong>
          <span className="muted"> · {plannedUnits} units</span>
        </div>
        <div className="row">
          <Button variant="outline" onClick={generate}>
            <WandSparkles />
            Generate suggested plan
          </Button>
          <Button
            onClick={() => void commit()}
            disabled={busy || warnings.length > 0}
          >
            <Save />
            {busy ? 'Saving…' : 'Save plan & settings'}
          </Button>
        </div>
      </div>
      {error && <Notice tone="warning">{error}</Notice>}
      {warnings.length > 0 && (
        <Notice tone="warning">
          <strong>Resolve these conflicts before saving</strong>
          <ul className="help-list">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
      {projection.unresolved.length > 0 && (
        <Notice tone="warning">
          A full graduation estimate is unavailable. Not schedulable within 24
          terms: {projection.unresolved.join(', ')}. Check current outcomes,
          unit limits, offerings, and corequisite constraints.
        </Notice>
      )}
      <Notice>
        Automatic roadmap estimate:{' '}
        <strong>
          {projection.graduation === null
            ? 'Unresolved'
            : projection.graduation === -1
              ? summary(draft).remaining === 0
                ? 'Curriculum complete'
                : 'After current subjects pass'
              : termLabel(draft.settings, projection.graduation)}
        </strong>
        . This is a generated projection; your custom plan below may differ.
      </Notice>
      <div className="planner-grid">
        {Array.from({ length: termCount }, (_, term) => {
          const planned = draft.plan.find((t) => t.term === term)?.codes ?? [];
          const subjects = planned.map((c) =>
            draft.curriculum.subjects.find((s) => s.code === c)!,
          );
          const units = subjects.reduce((n, s) => n + s.units, 0);
          return (
            <section className="panel planned-term" key={term}>
              <header>
                <p className="eyebrow">FUTURE TERM {term + 1}</p>
                <h2>{termLabel(draft.settings, term)}</h2>
                <p
                  className={
                    units > draft.settings.maxUnits ? 'failed-text' : 'muted'
                  }
                >
                  {units} / {draft.settings.maxUnits} units
                </p>
              </header>
              <div className="stack">
                {subjects.map((s) => (
                  <div className="planned-subject" key={s.code}>
                    <div>
                      <strong>{s.code}</strong>
                      <p>{s.name}</p>
                      <span className="muted">{s.units} units</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={
                        'Remove ' + s.code + ' from term ' + (term + 1)
                      }
                      onClick={() => remove(term, s.code)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
              {!planned.length && (
                <p className="muted empty-term">No subjects planned yet.</p>
              )}
              <Choice
                label={'Add subject to term ' + (term + 1)}
                value=""
                onChange={(c) => {
                  if (c) add(term, c);
                }}
                options={[
                  { value: '', label: '+ Add a subject' },
                  ...remaining.map((s) => ({
                    value: s.code,
                    label: s.code + ' · ' + s.units + ' units',
                  })),
                ]}
              />
            </section>
          );
        })}
      </div>
      {termCount < 24 && (
        <Button variant="outline" onClick={() => setTermCount((n) => n + 1)}>
          <Plus />
          Add future term
        </Button>
      )}
      <p className="muted">
        Use the subject picker to arrange a custom plan. Conflicts are shown
        immediately, and an invalid plan cannot be saved. Change a term by
        removing a subject and adding it to another term.
      </p>
    </div>
  );
}
export function Simulator({ data }: { data: RecordData }) {
  const [action, setAction] = useState<Scenario['action']>('fail'),
    [code, setCode] = useState(''),
    [term, setTerm] = useState(1);
  const subjects = data.curriculum.subjects.filter((s) =>
    action === 'pass'
      ? statusOf(data.statuses, s.code) === 'current'
      : statusOf(data.statuses, s.code) !== 'completed',
  );
  const chosen = subjects.some((s) => s.code === code)
    ? code
    : (subjects[0]?.code ?? '');
  const baseline = useMemo(() => forecast(data), [data]);
  const baselineStats = summary(data);
  const scenario = chosen
    ? simulate(data, { code: chosen, action, term })
    : null;
  const label = (offset: number | null) =>
    offset === null
      ? 'Unresolved'
      : offset === -1
        ? 'No future terms needed (assumes current passes)'
        : termLabel(data.settings, offset);
  const delay =
    scenario &&
    baseline.graduation !== null &&
    scenario.forecast.graduation !== null
      ? scenario.forecast.graduation - baseline.graduation
      : null;
  return (
    <div className="stack">
      <Notice>
        <FlaskConical size={18} />
        Simulation sandbox. Changes here never save to your academic record or
        semester plan. Comparisons use the automatic roadmap and your saved
        planning assumptions.
      </Notice>
      <section className="panel simulator-controls">
        <div>
          <p className="field-label">What if I…</p>
          <Choice
            label="Scenario action"
            value={action}
            onChange={(v) => setAction(v as Scenario['action'])}
            options={[
              { value: 'fail', label: 'Fail a subject' },
              { value: 'delay', label: 'Delay a subject until a future term' },
              { value: 'move', label: 'Move a subject to an exact term' },
              { value: 'pass', label: 'Pass a currently taken subject' },
            ]}
          />
        </div>
        <div>
          <p className="field-label">Subject</p>
          <Choice
            label="Scenario subject"
            value={chosen}
            onChange={setCode}
            options={subjects.map((s) => ({
              value: s.code,
              label: s.code + ' · ' + s.name,
            }))}
          />
        </div>
        {(action === 'delay' || action === 'move') && (
          <div>
            <p className="field-label">Future term</p>
            <Choice
              label="Scenario target term"
              value={String(term)}
              onChange={(v) => setTerm(Number(v))}
              options={Array.from({ length: 24 }, (_, i) => ({
                value: String(i),
                label: 'Term ' + (i + 1) + ' · ' + termLabel(data.settings, i),
              }))}
            />
          </div>
        )}
      </section>
      {!scenario ? (
        <Blank title="No subjects available for this scenario">
          Mark currently taken subjects to simulate passing them.
        </Blank>
      ) : (
        <>
          <div className="comparison-grid">
            <section className="panel">
              <p className="eyebrow">SAVED RECORD PROJECTION</p>
              <h2>{label(baseline.graduation)}</h2>
              <div className="comparison-stats">
                <span>
                  <strong>{baselineStats.eligible.length}</strong>eligible now
                </span>
                <span>
                  <strong>{baselineStats.blocked.length}</strong>blocked now
                </span>
                <span>
                  <strong>{baselineStats.completedUnits}</strong>units complete
                </span>
              </div>
            </section>
            <div className="comparison-arrow">
              <ArrowRight />
            </div>
            <section className="panel scenario-result">
              <p className="eyebrow">SIMULATED PROJECTION</p>
              <h2>{label(scenario.forecast.graduation)}</h2>
              <div className="comparison-stats">
                <span>
                  <strong>{scenario.summary.eligible.length}</strong>eligible
                  now
                </span>
                <span>
                  <strong>{scenario.summary.blocked.length}</strong>blocked now
                </span>
                <span>
                  <strong>{scenario.summary.completedUnits}</strong>units
                  complete
                </span>
              </div>
              <p className="muted">
                {delay === null
                  ? 'Estimate unavailable until unresolved constraints are corrected.'
                  : delay === 0
                    ? 'No projected graduation shift.'
                    : Math.abs(delay) +
                      ' term(s) ' +
                      (delay > 0 ? 'later' : 'earlier') +
                      ' than the baseline.'}
              </p>
            </section>
          </div>
          {scenario.forecast.unresolved.length > 0 && (
            <Notice tone="warning">
              Unresolved: {scenario.forecast.unresolved.join(', ')}. An exact
              move may violate prerequisites, offerings, or the unit limit. Try
              another term.
            </Notice>
          )}
          <div className="two-columns">
            <section className="panel">
              <h2>Affected prerequisite chain</h2>
              <p className="muted">
                Subjects downstream of {chosen}; their dates may shift even if
                eligibility today stays the same.
              </p>
              <div className="chain">
                <strong>{chosen}</strong>
                {scenario.affected.map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
              {!scenario.affected.length && <p>No dependent subjects.</p>}
            </section>
            <section className="panel">
              <h2>Eligibility changes</h2>
              {data.curriculum.subjects
                .filter(
                  (s) =>
                    baselineStats.eligible.some((b) => b.code === s.code) !==
                    scenario.summary.eligible.some((b) => b.code === s.code),
                )
                .map((s) => (
                  <div className="record-line" key={s.code}>
                    <strong>{s.code}</strong>
                    <span>
                      {scenario.summary.eligible.some((e) => e.code === s.code)
                        ? 'Newly eligible'
                        : 'No longer eligible'}
                    </span>
                  </div>
                ))}
              <p className="muted">
                Delay and move scenarios change future scheduling. They do not
                count the subject as completed today. A failed subject that was
                already not taken may have the same retake schedule.
              </p>
            </section>
          </div>
          <section className="panel">
            <h2>Recalculated future semesters</h2>
            <div className="simulation-terms">
              {scenario.forecast.plan.map((t) => (
                <div className="simulation-term" key={t.term}>
                  <p className="eyebrow">TERM {t.term + 1}</p>
                  <strong>{termLabel(data.settings, t.term)}</strong>
                  <p>
                    {t.codes.join(', ') || 'No available subjects this term'}
                  </p>
                  <span className="muted">
                    {t.codes.reduce(
                      (n, c) =>
                        n +
                        (data.curriculum.subjects.find((s) => s.code === c)
                          ?.units ?? 0),
                      0,
                    )}{' '}
                    units
                  </span>
                </div>
              ))}
            </div>
            {!scenario.forecast.plan.length && (
              <p className="muted">
                No future subjects could be scheduled, or the curriculum is
                complete.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

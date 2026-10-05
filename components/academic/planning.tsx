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
import { Progress } from '@/components/ui/progress';
import {
  forecast,
  projectPath,
  graduationLabel,
  evaluatePlan,
  candidateEligibility,
  movePlannedSubject,
  termLabel,
  simulate,
  summary,
  statusOf,
  prerequisiteEdges,
  subjectLabel,
  type RecordData,
  type Plan,
  type Scenario,
} from '@/lib/academic';
import { validateRecord } from '@/lib/import';
import {
  Choice,
  Notice,
  Blank,
  Pill,
  CourseCode,
  ComparisonMetric,
} from './shared';

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
      Math.max(2, ...data.plan.map((t) => t.term + 1)),
    ),
    [activeTerm, setActiveTerm] = useState(0),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  const evaluation = useMemo(() => evaluatePlan(draft), [draft]);
  const projection = useMemo(() => projectPath(draft), [draft]);
  const used = new Set(draft.plan.flatMap((t) => t.codes));
  const candidates = draft.curriculum.subjects
    .filter(
      (s) =>
        !['completed', 'current'].includes(statusOf(draft.statuses, s.code)) &&
        !used.has(s.code) &&
        (s.code + ' ' + s.name).toLowerCase().includes(search.toLowerCase()),
    )
    .map((s) => ({
      s,
      result: candidateEligibility(draft, s.code, activeTerm),
    }))
    .filter((c) => filter === 'all' || c.result.eligible);
  function changePlan(plan: Plan) {
    setDraft((d) => ({ ...d, plan }));
  }
  function generate() {
    const suggested = forecast(draft);
    changePlan(suggested.plan);
    setTermCount(Math.max(2, suggested.plan.length));
    setActiveTerm(0);
    setError('');
  }
  async function commit() {
    setError('');
    try {
      const valid = validateRecord(draft);
      if (evaluatePlan(valid).warnings.length)
        throw new Error('Resolve plan conflicts before saving.');
      await save(valid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid planning settings.');
    }
  }
  const totalUnits = draft.plan
    .flatMap((t) => t.codes)
    .reduce(
      (n, c) =>
        n + (draft.curriculum.subjects.find((s) => s.code === c)?.units ?? 0),
      0,
    );
  return (
    <div className="stack">
      <section className="section-block settings-panel">
        <div className="section-heading">
          <h2>Planning assumptions</h2>
          <CalendarDays size={20} />
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
            Maximum units per semester
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
          Assume current subjects pass before this future semester
        </label>
      </section>
      <div className="action-bar soft-panel planning-summary">
        <div>
          <p className="eyebrow">PLANNING</p>
          <strong className="unit-total">
            {totalUnits} <span>units planned</span>
          </strong>
          <p className="muted">
            {used.size} subjects ·{' '}
            {draft.plan.filter((t) => t.codes.length).length} semesters
          </p>
        </div>
        <div className="row">
          <Button variant="outline" onClick={generate} disabled={busy}>
            <WandSparkles />
            Suggest Plan
          </Button>
          <Button
            onClick={() => void commit()}
            disabled={busy || evaluation.warnings.length > 0}
          >
            <Save />
            {busy ? 'Saving…' : 'Save Plan'}
          </Button>
        </div>
      </div>
      {error && <Notice tone="warning">{error}</Notice>}
      {evaluation.warnings.length > 0 && (
        <Notice tone="warning">
          <strong>Plan needs attention</strong>
          <ul className="help-list">
            {evaluation.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </Notice>
      )}
      <Notice>
        Expected graduation:{' '}
        <strong>{graduationLabel(draft, projection.graduation)}</strong>.{' '}
        {projection.unresolved.length > 0 && (
          <span>
            Unresolved within 24 terms: {projection.unresolved.join(', ')}.
          </span>
        )}
      </Notice>
      <nav className="planner-term-nav" aria-label="Planned semesters">
        {Array.from({ length: termCount }, (_, term) => {
          const termPlan = evaluation.terms.find((t) => t.term === term);
          return (
            <button
              key={term}
              className="term-selector"
              aria-pressed={activeTerm === term}
              onClick={() => setActiveTerm(term)}
            >
              <span className="eyebrow">TERM {term + 1}</span>
              <strong>{termLabel(draft.settings, term)}</strong>
              <small>
                {termPlan?.units ?? 0} units · {termPlan?.entries.length ?? 0}{' '}
                subjects
              </small>
            </button>
          );
        })}
      </nav>
      <div className="planning-layout">
        <div className="planner-timeline">
          <p className="eyebrow">MY PLANNED SEMESTER</p>
          {Array.from({ length: termCount }, (_, term) => term)
            .filter((term) => term === activeTerm)
            .map((term) => {
              const planned =
                draft.plan.find((t) => t.term === term)?.codes ?? [];
              const termEvaluation = evaluation.terms.find(
                (t) => t.term === term,
              );
              const progress =
                termEvaluation ??
                evaluatePlan(draft, [
                  ...draft.plan.filter((t) => t.term < term),
                  { term, codes: [] },
                ]).terms.at(-1)!;
              return (
                <section
                  className={
                    'soft-panel planned-term' +
                    (activeTerm === term ? ' active-term' : '')
                  }
                  key={term}
                >
                  <header className="section-heading">
                    <div>
                      <p className="eyebrow">FUTURE TERM {term + 1}</p>
                      <h2>{termLabel(draft.settings, term)}</h2>
                    </div>
                    <Button
                      variant={activeTerm === term ? 'secondary' : 'outline'}
                      onClick={() => setActiveTerm(term)}
                      aria-pressed={activeTerm === term}
                    >
                      {activeTerm === term ? 'Adding Subjects' : 'Add Subject'}
                    </Button>
                  </header>
                  {planned.length ? (
                    <div className="stack">
                      {planned.map((code) => {
                        const s = draft.curriculum.subjects.find(
                          (s) => s.code === code,
                        )!;
                        const entry = termEvaluation?.entries.find(
                          (e) => e.code === code,
                        );
                        return (
                          <div className="planned-subject" key={code}>
                            <div className="planned-subject-info">
                              <CourseCode code={s.code} />
                              <p>{s.name}</p>
                              <span className="muted">
                                {s.units} units
                              </span>{' '}
                              <Pill
                                status={
                                  entry?.eligible ? 'eligible' : 'blocked'
                                }
                              />
                              {entry?.reasons.map((r) => (
                                <p className="failed-text" key={r}>
                                  {r}
                                </p>
                              ))}
                            </div>
                            <div className="subject-actions">
                              <Choice
                                label={'Move ' + code + ' to term'}
                                value={String(term)}
                                onChange={(v) =>
                                  changePlan(
                                    movePlannedSubject(
                                      draft.plan,
                                      code,
                                      Number(v),
                                    ),
                                  )
                                }
                                options={Array.from(
                                  { length: termCount },
                                  (_, i) => ({
                                    value: String(i),
                                    label: 'Term ' + (i + 1),
                                  }),
                                )}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label={'Remove ' + code}
                                onClick={() =>
                                  changePlan(
                                    movePlannedSubject(draft.plan, code, null),
                                  )
                                }
                              >
                                <Trash2 size={16} />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <Blank title="Ready to build this semester">
                      {activeTerm === term
                        ? 'Add subjects from the available list.'
                        : 'Select Add Subject to plan this semester.'}
                    </Blank>
                  )}
                  <footer className="term-footer">
                    <div className="row">
                      <strong className="unit-total">
                        {termEvaluation?.units ?? 0}{' '}
                        <span>/ {draft.settings.maxUnits} units</span>
                      </strong>
                      <span>{progress.progress}% projected completion</span>
                    </div>
                    <Progress
                      value={progress.progress}
                      aria-label={'Projected progress after term ' + (term + 1)}
                    />
                    <small>
                      {progress.completedUnits} completed units ·{' '}
                      {progress.remainingUnits} remaining
                    </small>
                  </footer>
                </section>
              );
            })}
          {termCount < 24 && (
            <Button
              variant="outline"
              onClick={() => {
                setActiveTerm(termCount);
                setTermCount((n) => n + 1);
              }}
            >
              <Plus />
              Add future semester
            </Button>
          )}
        </div>
        <aside className="soft-panel candidate-panel">
          <p className="eyebrow">AVAILABLE SUBJECTS</p>
          <h2>Add to Term {activeTerm + 1}</h2>
          <p className="muted">{termLabel(draft.settings, activeTerm)}</p>
          <Input
            aria-label="Search candidate subjects"
            placeholder="Search code or title"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Choice
            label="Candidate eligibility filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All unplanned subjects' },
              { value: 'eligible', label: 'Can take this semester' },
            ]}
          />
          <div className="candidate-list">
            {candidates.map(({ s, result }) => {
              const coreqOnly =
                result.reasons.length > 0 &&
                result.reasons.every((r) => r.startsWith('Corequisite'));
              return (
                <article className="candidate" key={s.code}>
                  <div className="row">
                    <CourseCode code={s.code} />
                    <span>{s.units} units</span>
                  </div>
                  <p>{s.name}</p>
                  <Pill status={result.eligible ? 'eligible' : 'blocked'} />
                  {result.reasons.map((r) => (
                    <p className="candidate-reason" key={r}>
                      {r}
                    </p>
                  ))}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || (!result.eligible && !coreqOnly)}
                    onClick={() =>
                      changePlan(
                        movePlannedSubject(draft.plan, s.code, activeTerm),
                      )
                    }
                  >
                    {coreqOnly ? 'Add with Corequisite' : 'Add to semester'}{' '}
                    <Plus size={14} />
                  </Button>
                </article>
              );
            })}
          </div>
          {!candidates.length && (
            <Blank title="No matching candidates">
              Try another filter or semester.
            </Blank>
          )}
          <p className="muted">Add corequisites together before saving.</p>
        </aside>
      </div>
    </div>
  );
}
export function Simulator({ data }: { data: RecordData }) {
  const [action, setAction] = useState<Scenario['action']>('fail'),
    [code, setCode] = useState(''),
    [term, setTerm] = useState(1);
  const baseline = useMemo(() => projectPath(data), [data]),
    baselineStats = summary(data);
  const planned = new Set(
    (action === 'add'
      ? data.plan
      : data.plan.length
        ? data.plan
        : baseline.plan
    ).flatMap((t) => t.codes),
  );
  const subjects = data.curriculum.subjects.filter((s) =>
    action === 'pass'
      ? statusOf(data.statuses, s.code) === 'current'
      : action === 'remove'
        ? planned.has(s.code)
        : action === 'add'
          ? !planned.has(s.code) &&
            !['completed', 'current'].includes(statusOf(data.statuses, s.code))
          : statusOf(data.statuses, s.code) !== 'completed',
  );
  const chosen = subjects.some((s) => s.code === code)
    ? code
    : (subjects[0]?.code ?? '');
  const scenario = chosen
    ? simulate(data, { code: chosen, action, term })
    : null;
  const evaluation = scenario ? evaluatePlan(scenario.data) : null;
  const delay =
    scenario &&
    baseline.graduation !== null &&
    scenario.forecast.graduation !== null
      ? scenario.forecast.graduation - baseline.graduation
      : null;
  const eligibilityChanges = scenario
    ? data.curriculum.subjects.filter(
        (s) =>
          baselineStats.eligible.some((b) => b.code === s.code) !==
          scenario.summary.eligible.some((b) => b.code === s.code),
      )
    : [];
  return (
    <div className="stack">
      <div className="simulation-banner">
        <FlaskConical />
        <div>
          <strong>Simulation Mode</strong>
          <p>Explore a change without changing your record.</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setAction('fail');
            setCode('');
            setTerm(1);
          }}
        >
          Reset scenario
        </Button>
      </div>
      <section className="simulator-controls">
        <div>
          <p className="field-label">What if I…</p>
          <Choice
            label="Scenario action"
            value={action}
            onChange={(v) => setAction(v as Scenario['action'])}
            options={[
              { value: 'fail', label: 'Fail a subject' },
              { value: 'delay', label: 'Delay a subject' },
              { value: 'move', label: 'Move a subject to a term' },
              { value: 'pass', label: 'Pass a current subject' },
              { value: 'add', label: 'Add an unplanned subject' },
              { value: 'remove', label: 'Remove a planned subject' },
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
        {['delay', 'move', 'add'].includes(action) && (
          <div>
            <p className="field-label">Target semester</p>
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
      {action === 'remove' && (
        <Notice>Removed subjects move to a later offering.</Notice>
      )}
      {!scenario ? (
        <Blank title="No subjects available for this scenario">
          Choose another action.
        </Blank>
      ) : (
        <>
          <p className="comparison-label">
            Current Path <ArrowRight size={16} /> Simulated Path
          </p>
          <div className="comparison-grid">
            {[
              {
                title: 'CURRENT PATH',
                record: data,
                stats: baselineStats,
                result: baseline,
              },
              {
                title: 'SIMULATED PATH',
                record: scenario.data,
                stats: scenario.summary,
                result: scenario.forecast,
              },
            ].map((view, i) => (
              <section
                className={
                  'soft-panel ' + (i ? 'scenario-result' : 'baseline-result')
                }
                key={view.title}
              >
                <p className="eyebrow">{view.title}</p>
                <span className="muted">Expected graduation</span>
                <h2
                  className={
                    i && delay !== null && delay !== 0 ? 'changed-value' : ''
                  }
                >
                  {graduationLabel(view.record, view.result.graduation)}
                </h2>
                <div className="comparison-stats">
                  {scenario.summary.eligible.length !==
                    baselineStats.eligible.length && (
                    <ComparisonMetric
                      value={view.stats.eligible.length}
                      label="can take next"
                      baseline={i ? baselineStats.eligible.length : undefined}
                    />
                  )}
                  {scenario.summary.blocked.length !==
                    baselineStats.blocked.length && (
                    <ComparisonMetric
                      value={view.stats.blocked.length}
                      label="blocked now"
                      baseline={i ? baselineStats.blocked.length : undefined}
                    />
                  )}
                  {scenario.summary.remainingUnits !==
                    baselineStats.remainingUnits && (
                    <ComparisonMetric
                      value={view.stats.remainingUnits}
                      label="remaining units"
                      baseline={i ? baselineStats.remainingUnits : undefined}
                    />
                  )}
                </div>
                {i === 1 && (
                  <p
                    className={
                      'scenario-impact ' +
                      (delay !== null && delay !== 0 ? 'changed-value' : '')
                    }
                  >
                    {delay === null
                      ? 'Resolve scheduling conflicts for an estimate.'
                      : delay === 0
                        ? 'No graduation change.'
                        : Math.abs(delay) +
                          (Math.abs(delay) === 1
                            ? ' semester '
                            : ' semesters ') +
                          (delay > 0 ? 'later' : 'earlier') +
                          ' than the current path.'}
                  </p>
                )}
              </section>
            ))}
          </div>
          {scenario.forecast.unresolved.length > 0 && (
            <Notice tone="warning">
              Unresolved: {scenario.forecast.unresolved.join(', ')}. Check
              requirements and offerings.
            </Notice>
          )}
          <div className="two-columns">
            <section className="section-block">
              <h2>Affected Subjects</h2>
              <div className="edge-list">
                {prerequisiteEdges(data.curriculum.subjects, chosen).map(
                  (e) => (
                    <p key={e.from + e.to}>
                      <strong>{e.from}</strong>
                      <ArrowRight size={14} />
                      {subjectLabel(data.curriculum.subjects, e.to)}
                    </p>
                  ),
                )}
              </div>
              {!scenario.affected.length && (
                <p className="muted">No dependent subjects.</p>
              )}
            </section>
            <section className="section-block">
              <h2>Eligibility changes</h2>
              {eligibilityChanges.map((s) => (
                <div className="record-line" key={s.code}>
                  <div>
                    <CourseCode code={s.code} />
                    <p>{s.name}</p>
                  </div>
                  <span>
                    {scenario.summary.eligible.some((e) => e.code === s.code)
                      ? 'Newly eligible'
                      : 'No longer eligible'}
                  </span>
                </div>
              ))}
              {!eligibilityChanges.length && (
                <p className="muted">No eligibility changes today.</p>
              )}
            </section>
          </div>
          <section className="section-block">
            <div className="section-heading">
              <h2>Simulated Plan</h2>
            </div>
            <div className="simulation-terms">
              {scenario.forecast.plan
                .filter((t) => {
                  const previous = baseline.plan.find((b) => b.term === t.term);
                  return (
                    !previous ||
                    t.codes.length !== previous.codes.length ||
                    t.codes.some((c) => !previous.codes.includes(c))
                  );
                })
                .map((t) => {
                  const projected = evaluation?.terms.find(
                    (e) => e.term === t.term,
                  );
                  return (
                    <div className="simulation-term" key={t.term}>
                      <p className="eyebrow">TERM {t.term + 1}</p>
                      <strong>{termLabel(data.settings, t.term)}</strong>
                      <p>
                        {t.codes.join(', ') ||
                          'No available subjects this semester'}
                      </p>
                      <div className="record-line">
                        <span>{projected?.units ?? 0} units</span>
                        <span>{projected?.remainingUnits ?? 0} remaining</span>
                      </div>
                      <Progress
                        value={projected?.progress ?? 0}
                        aria-label={
                          'Simulated completion after term ' + (t.term + 1)
                        }
                      />
                    </div>
                  );
                })}
            </div>
            {scenario.forecast.plan.length > 0 &&
              scenario.forecast.plan.every((t) => {
                const previous = baseline.plan.find((b) => b.term === t.term);
                return (
                  previous &&
                  t.codes.length === previous.codes.length &&
                  t.codes.every((c) => previous.codes.includes(c))
                );
              }) && (
                <p className="muted">
                  Your semester subjects stay on the same path.
                </p>
              )}
            {!scenario.forecast.plan.length && (
              <Blank
                title={
                  scenario.forecast.unresolved.length
                    ? 'No feasible future subjects'
                    : 'No future semesters needed'
                }
              >
                Review the comparison and any unresolved subjects above.
              </Blank>
            )}
          </section>
        </>
      )}
    </div>
  );
}

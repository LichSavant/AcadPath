'use client';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  CheckCircle2,
  BookOpen,
  LockKeyhole,
  Flag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  summary,
  forecast,
  termLabel,
  descendants,
  academicState,
  statusOf,
  planWarnings,
  type RecordData,
  type Subject,
} from '@/lib/academic';
import { SubjectCard, Pill, Blank, Choice, Notice } from './shared';
export function Dashboard({
  data,
  stats,
  select,
  navigate,
}: {
  data: RecordData;
  stats: ReturnType<typeof summary>;
  select: (s: Subject) => void;
  navigate: (page: 'review' | 'planner' | 'map') => void;
}) {
  const projection = useMemo(() => forecast(data), [data]);
  const blockers = data.curriculum.subjects
    .filter((s) => statusOf(data.statuses, s.code) !== 'completed')
    .map((s) => ({
      s,
      count: descendants(data.curriculum.subjects, s.code).filter(
        (c) => statusOf(data.statuses, c) !== 'completed',
      ).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);
  const conflicts = planWarnings(data);
  return (
    <div className="stack">
      <section className="stats-grid">
        {[
          {
            label: 'Degree progress',
            value: stats.progress + '%',
            sub:
              stats.completedUnits +
              ' of ' +
              stats.totalUnits +
              ' units completed',
            Icon: CheckCircle2,
          },
          {
            label: 'Currently taking',
            value: stats.current.length,
            sub:
              stats.current.reduce((n, s) => n + s.units, 0) +
              ' units in progress',
            Icon: BookOpen,
          },
          {
            label: 'Eligible right now',
            value: stats.eligible.length,
            sub: 'All prerequisites satisfied',
            Icon: Flag,
          },
          {
            label: 'Blocked subjects',
            value: stats.blocked.length,
            sub: 'Requirements still to complete',
            Icon: LockKeyhole,
          },
        ].map(({ label, value, sub, Icon }) => (
          <article className="stat panel" key={label}>
            <div className="row">
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value}</strong>
            <p className="muted">{sub}</p>
            {label === 'Degree progress' && (
              <Progress value={stats.progress} aria-label="Degree progress" />
            )}
          </article>
        ))}
      </section>
      {conflicts.length > 0 && (
        <Notice tone="warning">
          Your saved semester plan has {conflicts.length} conflict(s) after
          record changes.{' '}
          <button className="text-button" onClick={() => navigate('planner')}>
            Review plan
          </button>
        </Notice>
      )}
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NEXT STEPS</p>
              <h2>Ready when you are</h2>
            </div>
            <Button variant="ghost" onClick={() => navigate('planner')}>
              Plan semester <ArrowUpRight />
            </Button>
          </div>
          <p className="muted">
            Eligible based on completed subjects. Term offerings and unit limits
            apply in the planner.
          </p>
          <div className="subject-grid">
            {stats.eligible.slice(0, 6).map((s) => (
              <SubjectCard
                key={s.code}
                subject={s}
                data={data}
                onSelect={select}
              />
            ))}
          </div>
          {!stats.eligible.length && (
            <Blank
              title={
                stats.remaining
                  ? 'No subjects are immediately eligible'
                  : 'All subjects completed'
              }
            >
              {stats.remaining
                ? 'Review prerequisite blockers or plan corequisites together.'
                : 'Your curriculum is complete.'}
            </Blank>
          )}
        </section>
        <aside className="stack">
          <section className="graduation-card">
            <Flag size={26} />
            <p className="eyebrow">PROJECTED COMPLETION</p>
            <h2>
              {projection.graduation === null
                ? 'More information needed'
                : projection.graduation === -1
                  ? stats.remaining === 0
                    ? 'Curriculum complete'
                    : 'After current subjects pass'
                  : termLabel(data.settings, projection.graduation)}
            </h2>
            <p>
              Automatic roadmap · up to {data.settings.maxUnits} units per term
            </p>
            <small>
              {data.settings.assumeCurrentPass
                ? 'Assumes all current subjects are passed before the first future term.'
                : 'Current subjects must be resolved before a full forecast is possible.'}{' '}
              Future subjects are assumed passed; offerings follow your
              curriculum.
            </small>
            <Button variant="secondary" onClick={() => navigate('planner')}>
              Adjust planning assumptions <ArrowUpRight />
            </Button>
          </section>
          <section className="panel">
            <h2>Your record</h2>
            <div className="record-line">
              <span>Completed subjects</span>
              <strong>{stats.completed.length}</strong>
            </div>
            <div className="record-line">
              <span>Remaining subjects</span>
              <strong>{stats.remaining}</strong>
            </div>
            <div className="record-line">
              <span>Remaining units</span>
              <strong>{stats.remainingUnits}</strong>
            </div>
            <Button variant="outline" onClick={() => navigate('review')}>
              Update subject statuses
            </Button>
          </section>
        </aside>
      </div>
      <div className="two-columns">
        <section className="panel">
          <div className="section-heading">
            <h2>Currently taking</h2>
            <Pill status="current" />
          </div>
          {stats.current.length ? (
            <div className="compact-list">
              {stats.current.map((s) => (
                <button
                  key={s.code}
                  className="list-row"
                  onClick={() => select(s)}
                >
                  <div>
                    <strong>{s.code}</strong>
                    <p>{s.name}</p>
                  </div>
                  <span>{s.units} units</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted">
              Mark your enrolled subjects in Review & mark.
            </p>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Subjects with the biggest impact</h2>
            <Button variant="ghost" onClick={() => navigate('map')}>
              View map
            </Button>
          </div>
          <p className="muted">
            Unfinished subjects with the most downstream dependencies.
          </p>
          <div className="compact-list">
            {blockers.map(({ s, count }) => (
              <button
                className="list-row"
                key={s.code}
                onClick={() => select(s)}
              >
                <div>
                  <strong>{s.code}</strong>
                  <p>{s.name}</p>
                </div>
                <span className="count-badge">{count} downstream</span>
              </button>
            ))}
          </div>
          {!blockers.length && (
            <p className="muted">No outstanding prerequisite chains.</p>
          )}
        </section>
      </div>
    </div>
  );
}
export function CurriculumMap({
  data,
  select,
}: {
  data: RecordData;
  select: (s: Subject) => void;
}) {
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [focus, setFocus] = useState('');
  const related = useMemo(
    () => (focus ? descendants(data.curriculum.subjects, focus) : []),
    [data.curriculum.subjects, focus],
  );
  const terms = [
    ...new Set(
      data.curriculum.subjects.map((s) => (s.year - 1) * 2 + s.semester - 1),
    ),
  ].sort((a, b) => a - b);
  const visible = (s: Subject) =>
    (s.code + ' ' + s.name).toLowerCase().includes(search.toLowerCase()) &&
    (filter === 'all' ||
      (filter === 'remaining'
        ? statusOf(data.statuses, s.code) !== 'completed'
        : academicState(s, data.statuses) === filter));
  return (
    <div className="stack">
      <div className="map-toolbar panel">
        <Input
          aria-label="Search subjects"
          placeholder="Search by code or subject name"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Choice
          label="Filter status"
          value={filter}
          onChange={setFilter}
          options={[
            'all',
            'completed',
            'current',
            'eligible',
            'blocked',
            'remaining',
          ].map((v) => ({
            value: v,
            label:
              v === 'all' ? 'All statuses' : v[0].toUpperCase() + v.slice(1),
          }))}
        />
        <Choice
          label="Highlight prerequisite chain"
          value={focus}
          onChange={setFocus}
          options={[
            { value: '', label: 'Highlight a prerequisite chain' },
            ...data.curriculum.subjects.map((s) => ({
              value: s.code,
              label: s.code + ' · ' + s.name,
            })),
          ]}
        />
      </div>
      <div className="legend">
        {['completed', 'current', 'eligible', 'blocked'].map((s) => (
          <Pill key={s} status={s} />
        ))}
        <span className="muted">
          Remaining = all unfinished subjects, including current and retakes.
        </span>
      </div>
      {focus && (
        <Notice>
          {focus} affects {related.length} downstream subjects. Highlighted
          cards show this chain; select any subject for requirements.
        </Notice>
      )}
      <div className="map-board">
        {terms.map((t) => {
          const subjects = data.curriculum.subjects.filter(
            (s) => (s.year - 1) * 2 + s.semester - 1 === t && visible(s),
          );
          return (
            <section className="term-column" key={t}>
              <header>
                <p className="eyebrow">YEAR {Math.floor(t / 2) + 1}</p>
                <div className="row">
                  <h2>Semester {(t % 2) + 1}</h2>
                  <span>{subjects.reduce((n, s) => n + s.units, 0)} units</span>
                </div>
              </header>
              <div className="stack">
                {subjects.map((s) => (
                  <SubjectCard
                    key={s.code}
                    subject={s}
                    data={data}
                    onSelect={select}
                    highlight={s.code === focus || related.includes(s.code)}
                  />
                ))}
                {!subjects.length && (
                  <p className="muted">No matching subjects.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
      <p className="muted">
        Columns show the recommended curriculum sequence. The planner calculates
        your personal sequence from completed prerequisites.
      </p>
    </div>
  );
}

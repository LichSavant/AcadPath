'use client';
import { useMemo, useState } from 'react';
import { ArrowUpRight, CheckCircle2, BookOpen, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import {
  summary,
  projectPath,
  graduationLabel,
  termLabel,
  descendants,
  statusOf,
  prerequisiteEdges,
  subjectLabel,
  matchesSubject,
  type RecordData,
  type Subject,
} from '@/lib/academic';
import {
  SubjectCard,
  Pill,
  Blank,
  Choice,
  Notice,
  filterOptions,
} from './shared';
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
  const path = useMemo(() => projectPath(data), [data]);
  const currentUnits = stats.current.reduce((n, s) => n + s.units, 0);
  const unfinishedUnits = Math.max(0, stats.remainingUnits - currentUnits);
  const blockers = data.curriculum.subjects
    .filter((s) => statusOf(data.statuses, s.code) !== 'completed')
    .map((s) => ({
      s,
      downstream: descendants(data.curriculum.subjects, s.code).filter(
        (c) => statusOf(data.statuses, c) !== 'completed',
      ),
    }))
    .filter((b) => b.downstream.length)
    .sort((a, b) => b.downstream.length - a.downstream.length)
    .slice(0, 3);
  const next = [...data.plan]
    .filter((t) => t.codes.length)
    .sort((a, b) => a.term - b.term)[0];
  return (
    <div className="stack">
      <section className="stats-grid">
        {[
          {
            label: 'Academic progress',
            value: stats.progress + '%',
            detail: stats.completed.length + ' subjects completed',
          },
          {
            label: 'Units completed',
            value: stats.completedUnits + ' / ' + stats.totalUnits,
            detail: 'Curriculum units',
          },
          {
            label: 'Remaining units',
            value: stats.remainingUnits,
            detail: stats.remaining + ' unfinished subjects',
          },
          {
            label: 'Current subjects',
            value: stats.current.length,
            detail: currentUnits + ' units in progress',
          },
          {
            label: 'Eligible subjects',
            value: stats.eligible.length,
            detail: 'Requirements satisfied today',
          },
          {
            label: 'Expected graduation',
            value: graduationLabel(data, path.graduation),
            detail: data.plan.length
              ? 'Based on your saved placements'
              : 'Based on a suggested pathway',
          },
        ].map((k) => (
          <article className="stat panel" key={k.label}>
            <span className="stat-label">{k.label}</span>
            <strong
              className={k.label === 'Expected graduation' ? 'term-value' : ''}
            >
              {k.value}
            </strong>
            <p className="muted">{k.detail}</p>
          </article>
        ))}
      </section>
      {path.warnings.length > 0 && (
        <Notice tone="warning">
          Your saved plan has {path.warnings.length} conflict(s). Correct them
          to restore your graduation estimate.{' '}
          <button className="text-button" onClick={() => navigate('planner')}>
            Review plan
          </button>
        </Notice>
      )}
      <section className="panel progress-panel">
        <div className="section-heading">
          <div>
            <h2>Academic Progress</h2>
            <p className="muted">
              Every completed subject moves your pathway forward.
            </p>
          </div>
          <strong>{stats.progress}% complete</strong>
        </div>
        <figure
          className="segmented-progress"
          aria-label={
            stats.completedUnits +
            ' completed units, ' +
            currentUnits +
            ' current units, ' +
            unfinishedUnits +
            ' other remaining units'
          }
        >
          {stats.totalUnits > 0 ? (
            <>
              <span
                className="segment-completed"
                style={{
                  width: (stats.completedUnits / stats.totalUnits) * 100 + '%',
                }}
              />
              <span
                className="segment-current"
                style={{ width: (currentUnits / stats.totalUnits) * 100 + '%' }}
              />
            </>
          ) : (
            <Progress value={stats.progress} aria-label="Subjects completed" />
          )}
        </figure>
        <div className="progress-legend">
          <span>
            <i className="dot completed" />
            <strong>{stats.completedUnits}</strong> completed units
          </span>
          <span>
            <i className="dot current" />
            <strong>{currentUnits}</strong> current units
          </span>
          <span>
            <i className="dot remaining" />
            <strong>{unfinishedUnits}</strong> other remaining units
          </span>
          <Button variant="ghost" onClick={() => navigate('review')}>
            Update academic record <ArrowUpRight />
          </Button>
        </div>
      </section>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR NEXT STEP</p>
              <h2>Continue Your Path</h2>
            </div>
            <Button variant="ghost" onClick={() => navigate('planner')}>
              Plan subjects <ArrowUpRight />
            </Button>
          </div>
          <p className="muted">
            Eligible now. The planner checks availability in your chosen
            semester.
          </p>
          <div className="subject-grid">
            {stats.eligible.slice(0, 4).map((s) => (
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
                  ? 'No immediately eligible subjects'
                  : 'Curriculum completed'
              }
            >
              {stats.remaining
                ? 'Review the blockers below or plan corequisites together.'
                : 'All recorded subjects have been completed.'}
            </Blank>
          )}
          {stats.eligible.length > 4 && (
            <Button variant="ghost" onClick={() => navigate('map')}>
              View all {stats.eligible.length} eligible subjects
            </Button>
          )}
        </section>
        <section className="panel upcoming-plan">
          <div className="section-heading">
            <div>
              <p className="eyebrow">LOOKING AHEAD</p>
              <h2>Upcoming Plan</h2>
            </div>
            <Flag size={20} />
          </div>
          {next ? (
            <>
              <h3>{termLabel(data.settings, next.term)}</h3>
              <div className="compact-list">
                {next.codes.map((c) => {
                  const s = data.curriculum.subjects.find((s) => s.code === c)!;
                  return (
                    <button
                      className="list-row"
                      key={c}
                      onClick={() => select(s)}
                    >
                      <div>
                        <strong>{c}</strong>
                        <p>{s.name}</p>
                      </div>
                      <span>{s.units} units</span>
                    </button>
                  );
                })}
              </div>
              <div className="record-line">
                <strong>Total units</strong>
                <strong>
                  {next.codes.reduce(
                    (n, c) =>
                      n +
                      data.curriculum.subjects.find((s) => s.code === c)!.units,
                    0,
                  )}
                </strong>
              </div>
            </>
          ) : (
            <Blank title="Your next semester is open">
              Add subjects to your semester plan to preview them here.
            </Blank>
          )}
          <Button variant="outline" onClick={() => navigate('planner')}>
            {next ? 'Edit semester plan' : 'Create semester plan'}{' '}
            <ArrowUpRight />
          </Button>
        </section>
      </div>
      <div className="two-columns">
        <section className="panel table-section">
          <div className="section-heading">
            <h2>Current Semester</h2>
            <BookOpen size={20} />
          </div>
          {stats.current.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.current.map((s) => (
                  <TableRow key={s.code}>
                    <TableCell>
                      <button
                        className="subject-link"
                        onClick={() => select(s)}
                      >
                        <strong>{s.code}</strong>
                        <span>{s.name}</span>
                      </button>
                    </TableCell>
                    <TableCell>{s.units}</TableCell>
                    <TableCell>
                      <Pill status="current" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Blank title="No current subjects marked">
              Mark your enrolled subjects in Curriculum → Academic record.
            </Blank>
          )}
        </section>
        <section className="panel">
          <div className="section-heading">
            <h2>Important Blockers</h2>
            <Button variant="ghost" onClick={() => navigate('map')}>
              View map
            </Button>
          </div>
          {blockers.map(({ s, downstream }) => (
            <article className="blocker" key={s.code}>
              <button className="subject-link" onClick={() => select(s)}>
                <strong>
                  {subjectLabel(data.curriculum.subjects, s.code)}
                </strong>
              </button>
              <p className="muted">
                {statusOf(data.statuses, s.code) === 'current'
                  ? 'A passing outcome is still needed.'
                  : statusOf(data.statuses, s.code) === 'failed'
                    ? 'This subject needs a passing retake.'
                    : 'This prerequisite has not been completed.'}{' '}
                Affects {downstream.length} unfinished subject(s).
              </p>
              <div className="edge-list">
                {prerequisiteEdges(data.curriculum.subjects, s.code)
                  .filter((e) => statusOf(data.statuses, e.to) !== 'completed')
                  .slice(0, 3)
                  .map((e) => (
                    <p key={e.from + e.to}>
                      <strong>{e.from}</strong>
                      <span aria-hidden="true"> → </span>
                      {subjectLabel(data.curriculum.subjects, e.to)}
                    </p>
                  ))}
              </div>
            </article>
          ))}
          {!blockers.length && (
            <Blank title="No outstanding prerequisite chains">
              <CheckCircle2 size={22} />
            </Blank>
          )}
        </section>
      </div>
      <p className="muted estimate-note">
        Projection: up to {data.settings.maxUnits} units each term; reviewed
        semester offerings repeat annually.{' '}
        {data.settings.assumeCurrentPass
          ? 'Current subjects are assumed passed before the first future term.'
          : 'Current outcomes are unresolved until marked completed.'}{' '}
        Unplanned subjects fill available future terms. Future passes are
        assumed.
      </p>
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
  const years = [...new Set(data.curriculum.subjects.map((s) => s.year))].sort(
    (a, b) => a - b,
  );
  const shown = data.curriculum.subjects.filter((s) =>
    matchesSubject(s, data.statuses, search, filter),
  );
  return (
    <div className="stack">
      <div className="map-toolbar panel">
        <Input
          aria-label="Search subjects"
          placeholder="Search code or title"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Choice
          label="Filter map status"
          value={filter}
          onChange={setFilter}
          options={filterOptions}
        />
        <Choice
          label="Highlight prerequisite chain"
          value={focus}
          onChange={setFocus}
          options={[
            { value: '', label: 'Trace a prerequisite' },
            ...data.curriculum.subjects.map((s) => ({
              value: s.code,
              label: s.code + ' · ' + s.name,
            })),
          ]}
        />
      </div>
      <div className="legend">
        {['completed', 'current', 'eligible', 'blocked', 'remaining'].map(
          (s) => (
            <Pill key={s} status={s} />
          ),
        )}
        <span className="muted">
          Remaining includes all unfinished subjects.
        </span>
      </div>
      {focus && (
        <Notice>
          <strong>{focus}</strong> affects {related.length} downstream subjects.{' '}
          <button className="text-button" onClick={() => setFocus('')}>
            Clear trace
          </button>
          <div className="edge-list">
            {prerequisiteEdges(data.curriculum.subjects, focus).map((e) => (
              <p key={e.from + e.to}>
                {e.from} → {e.to}
              </p>
            ))}
          </div>
        </Notice>
      )}
      {!shown.length ? (
        <Blank title="No matching subjects">
          Try another status or search term.
        </Blank>
      ) : (
        <div className="map-board">
          {years.map((year) => {
            const inYear = shown.filter((s) => s.year === year);
            if (!inYear.length) return null;
            return (
              <section className="year-group" key={year}>
                <header className="year-heading">
                  <h2>Year {year}</h2>
                  <span>
                    {inYear.length} subjects ·{' '}
                    {inYear.reduce((n, s) => n + s.units, 0)} units shown
                  </span>
                </header>
                <div className="year-semesters">
                  {[1, 2].map((sem) => {
                    const subjects = inYear.filter((s) => s.semester === sem);
                    return (
                      <section className="term-column" key={sem}>
                        <header>
                          <h3>Semester {sem}</h3>
                          <span>
                            {subjects.reduce((n, s) => n + s.units, 0)} units
                          </span>
                        </header>
                        <div className="map-subjects">
                          {subjects.map((s) => (
                            <SubjectCard
                              key={s.code}
                              subject={s}
                              data={data}
                              onSelect={select}
                              highlight={
                                s.code === focus || related.includes(s.code)
                              }
                            />
                          ))}
                        </div>
                        {!subjects.length && (
                          <p className="muted">
                            No subjects match in this semester.
                          </p>
                        )}
                      </section>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
      <p className="muted">
        This map shows the recommended curriculum sequence. Select a card to
        inspect its requirements; your semester plan can follow a different
        valid sequence.
      </p>
    </div>
  );
}

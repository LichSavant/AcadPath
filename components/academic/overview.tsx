'use client';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Route,
  BookOpen,
  GraduationCap,
} from 'lucide-react';
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
  matchesSubject,
  type RecordData,
  type Subject,
} from '@/lib/academic';
import {
  SubjectCard,
  CourseCode,
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
      <section
        className="accent-panel academic-progress"
        aria-labelledby="progress-heading"
      >
        <div className="hero-heading">
          <div>
            <p className="eyebrow">YOUR PATH</p>
            <h2 id="progress-heading">Academic Progress</h2>
          </div>
          <Route className="path-icon" aria-hidden="true" />
        </div>
        <div className="progress-summary">
          <div className="row">
            <strong>
              {stats.completedUnits} <span>/ {stats.totalUnits} units</span>
            </strong>
            <span className="progress-percentage">{stats.progress}%</span>
          </div>
          <Progress value={stats.progress} aria-label="Academic progress" />
        </div>
        <dl className="progress-metrics">
          <div>
            <dt>
              <ArrowUpRight aria-hidden="true" />
              Can Take Next
            </dt>
            <dd>
              {stats.eligible.length}{' '}
              <span>
                {stats.eligible.length === 1 ? 'subject' : 'subjects'}
              </span>
            </dd>
          </div>
          <div>
            <dt>
              <BookOpen aria-hidden="true" />
              Remaining
            </dt>
            <dd>
              {stats.remainingUnits} <span>units</span>
            </dd>
          </div>
          <div>
            <dt>
              <GraduationCap aria-hidden="true" />
              Est. Graduation
            </dt>
            <dd>{graduationLabel(data, path.graduation)}</dd>
          </div>
        </dl>
      </section>
      {path.warnings.length > 0 && (
        <Notice tone="warning">
          Saved plan has conflicts.{' '}
          <button className="text-button" onClick={() => navigate('planner')}>
            Review plan
          </button>
        </Notice>
      )}
      <div className="dashboard-grid">
        <section className="soft-panel next-subjects">
          <div className="section-heading">
            <div>
              <p className="eyebrow">NEXT ACTIONS</p>
              <h2>Can Take Next</h2>
            </div>
            <Button variant="ghost" onClick={() => navigate('planner')}>
              Plan <ArrowUpRight />
            </Button>
          </div>
          {stats.eligible.length ? (
            <div className="eligible-list">
              {stats.eligible.slice(0, 4).map((s) => (
                <button
                  className="list-row"
                  key={s.code}
                  onClick={() => select(s)}
                >
                  <div>
                    <CourseCode code={s.code} />
                    <p>{s.name}</p>
                  </div>
                  <span>{s.units} units</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="section-empty">
              {stats.remaining
                ? 'No subjects eligible yet.'
                : 'Curriculum complete.'}
            </p>
          )}
          {stats.eligible.length > 4 && (
            <Button variant="ghost" onClick={() => navigate('map')}>
              View all {stats.eligible.length}
            </Button>
          )}
        </section>
        {blockers.length > 0 && (
          <section className="soft-panel blockers-surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">PATH CHECKPOINTS</p>
                <h2>Blockers</h2>
              </div>
              <Button variant="ghost" onClick={() => navigate('map')}>
                Course Map
              </Button>
            </div>
            {blockers.map(({ s, downstream }) => (
              <article className="blocker" key={s.code}>
                <button className="subject-link" onClick={() => select(s)}>
                  <strong>
                    {s.code} &middot; {s.name}
                  </strong>
                </button>
                <p className="muted">
                  {statusOf(data.statuses, s.code) === 'current'
                    ? 'Current'
                    : statusOf(data.statuses, s.code) === 'failed'
                      ? 'Failed'
                      : 'Remaining'}{' '}
                  &middot; blocks {downstream.length}{' '}
                  {downstream.length === 1 ? 'subject' : 'subjects'}
                </p>
                <ul className="blocker-targets">
                  {data.curriculum.subjects
                    .filter(
                      (target) =>
                        target.prerequisites.includes(s.code) &&
                        statusOf(data.statuses, target.code) !== 'completed',
                    )
                    .map((target) => (
                      <li key={target.code}>{target.name}</li>
                    ))}
                </ul>
              </article>
            ))}
          </section>
        )}
      </div>
      <div className="semester-timeline">
        <p className="eyebrow">YOUR TIMELINE</p>
        <div className="two-columns semester-grid">
          <section className="timeline-stop">
            <div className="timeline-marker">
              <span aria-hidden="true" />
              NOW
            </div>
            <div className="section-surface">
              <div className="section-heading">
                <h2>Current Semester</h2>
                <Button variant="ghost" onClick={() => navigate('review')}>
                  Update Statuses
                </Button>
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
                <p className="section-empty">No current subjects marked.</p>
              )}
            </div>
          </section>
          <section className="timeline-stop">
            <div className="timeline-marker next-marker">
              <span aria-hidden="true" />
              NEXT
              <ArrowRight size={14} aria-hidden="true" />
            </div>
            <div className="section-surface">
              <div className="section-heading">
                <h2>Next Semester</h2>
                <Button variant="ghost" onClick={() => navigate('planner')}>
                  {next ? 'Edit Plan' : 'Add Subjects'}
                </Button>
              </div>
              {next ? (
                <>
                  <h3>{termLabel(data.settings, next.term)}</h3>
                  {next.codes.map((code) => {
                    const s = data.curriculum.subjects.find(
                      (s) => s.code === code,
                    )!;
                    return (
                      <button
                        className="list-row"
                        key={code}
                        onClick={() => select(s)}
                      >
                        <div>
                          <CourseCode code={s.code} />
                          <p>{s.name}</p>
                        </div>
                        <span>{s.units} units</span>
                      </button>
                    );
                  })}
                  <p className="term-total">
                    {next.codes.reduce(
                      (n, code) =>
                        n +
                        (data.curriculum.subjects.find((s) => s.code === code)
                          ?.units ?? 0),
                      0,
                    )}{' '}
                    units total
                  </p>
                </>
              ) : (
                <p className="section-empty">No semester planned yet.</p>
              )}
            </div>
          </section>
        </div>
      </div>
      <p className="muted estimate-note">
        Estimates assume future passes and your planner settings.
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
      <div className="map-toolbar">
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
                  <h2>
                    <span className="year-number" aria-hidden="true">
                      {String(year).padStart(2, '0')}
                    </span>
                    Year {year}
                  </h2>
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
    </div>
  );
}

'use client';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
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
  matchesSubject,
  prerequisiteChain,
  type RecordData,
  type Subject,
} from '@/lib/academic';
import {
  SubjectCard,
  CourseRow,
  CourseCode,
  DependencyTree,
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
    .slice(0, 2);
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
          <h2 className="eyebrow" id="progress-heading">
            YOUR ACADEMIC JOURNEY
          </h2>
          <span className="journey-context">
            {stats.completed.length} / {data.curriculum.subjects.length}{' '}
            subjects completed
          </span>
        </div>
        <div className="progress-summary">
          <div className="journey-value">
            <strong className="progress-percentage">
              {stats.progress}% <span>complete</span>
            </strong>
            <p className="journey-units">
              <strong>{stats.completedUnits}</strong> / {stats.totalUnits} units
            </p>
          </div>
          <div className="journey-track">
            <Progress value={stats.progress} aria-label="Academic progress" />
            <span
              aria-hidden="true"
              className={
                'journey-marker' +
                (stats.progress < 15
                  ? ' at-start'
                  : stats.progress > 85
                    ? ' at-end'
                    : '')
              }
              style={{
                left: `clamp(7px, ${stats.progress}%, calc(100% - 7px))`,
              }}
            >
              <span>You are here</span>
            </span>
          </div>
          <div className="journey-endpoints" aria-hidden="true">
            <span>Start</span>
            <span>Graduation</span>
          </div>
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
          <div className="graduation-metric">
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
              {stats.eligible.slice(0, 5).map((s) => (
                <CourseRow
                  key={s.code}
                  subject={s}
                  onSelect={select}
                  detail={
                    s.prerequisites.length || s.corequisites.length
                      ? 'Requirements complete'
                      : undefined
                  }
                />
              ))}
            </div>
          ) : (
            <Blank
              title={
                stats.remaining
                  ? 'No subjects eligible yet'
                  : 'Curriculum complete'
              }
              action={
                stats.remaining ? (
                  <Button variant="outline" onClick={() => navigate('map')}>
                    Review requirements
                  </Button>
                ) : undefined
              }
            >
              {stats.remaining
                ? 'Follow your prerequisite path to see your next options.'
                : 'All curriculum units are completed.'}
            </Blank>
          )}
          {stats.eligible.length > 5 && (
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
                <h2>Blocking Your Path</h2>
              </div>
              <Button variant="ghost" onClick={() => navigate('map')}>
                Course Map
              </Button>
            </div>
            {blockers.map(({ s, downstream }) => (
              <article
                className={
                  'blocker' +
                  (statusOf(data.statuses, s.code) === 'failed'
                    ? ' failed'
                    : '')
                }
                key={s.code}
              >
                <button className="blocker-heading" onClick={() => select(s)}>
                  <CourseCode code={s.code} />
                  <strong>{s.name}</strong>
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
                <DependencyTree
                  onSelect={select}
                  subjects={data.curriculum.subjects.filter(
                    (target) =>
                      target.prerequisites.includes(s.code) &&
                      statusOf(data.statuses, target.code) !== 'completed',
                  )}
                />
              </article>
            ))}
          </section>
        )}
      </div>
      <div className="semester-timeline">
        <p className="eyebrow">YOUR NEXT STEPS</p>
        <div className="two-columns semester-grid">
          <section className="timeline-stop">
            <div className="timeline-marker">
              <span aria-hidden="true" />
              CURRENT
            </div>
            <div className="section-surface">
              <div className="section-heading">
                <h2>Current Semester</h2>
                <Button variant="ghost" onClick={() => navigate('review')}>
                  Update Statuses
                </Button>
              </div>
              <p className="semester-summary">
                <strong>
                  {stats.current.reduce((n, s) => n + s.units, 0)}
                </strong>{' '}
                units <span>· {stats.current.length} subjects</span>
              </p>
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
                <Blank
                  title="No current subjects marked"
                  action={
                    <Button
                      variant="outline"
                      onClick={() => navigate('review')}
                    >
                      Update statuses
                    </Button>
                  }
                >
                  Mark the subjects you are taking this semester.
                </Blank>
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
                  <p className="semester-summary">
                    <strong>
                      {next.codes.reduce(
                        (n, code) =>
                          n +
                          (data.curriculum.subjects.find((s) => s.code === code)
                            ?.units ?? 0),
                        0,
                      )}
                    </strong>{' '}
                    units <span>· {next.codes.length} subjects</span>
                  </p>
                  <h3>{termLabel(data.settings, next.term)}</h3>
                  {next.codes.map((code) => {
                    const s = data.curriculum.subjects.find(
                      (s) => s.code === code,
                    )!;
                    return (
                      <CourseRow key={code} subject={s} onSelect={select} />
                    );
                  })}
                </>
              ) : (
                <Blank
                  title="No semester planned yet"
                  action={
                    <Button
                      variant="outline"
                      onClick={() => navigate('planner')}
                    >
                      Plan Semester
                    </Button>
                  }
                >
                  Choose eligible subjects to build your next semester.
                </Blank>
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
    () =>
      focus
        ? [
            ...prerequisiteChain(data.curriculum.subjects, focus),
            ...descendants(data.curriculum.subjects, focus),
          ]
        : [],
    [data.curriculum.subjects, focus],
  );
  const traceEdges = focus
    ? data.curriculum.subjects.flatMap((s) =>
        s.prerequisites
          .filter(
            (p) =>
              (s.code === focus || related.includes(s.code)) &&
              (p === focus || related.includes(p)),
          )
          .map((p) => ({ from: p, to: s.code })),
      )
    : [];
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
          <strong>{focus}</strong> ·{' '}
          {prerequisiteChain(data.curriculum.subjects, focus).length}{' '}
          prerequisites · {descendants(data.curriculum.subjects, focus).length}{' '}
          downstream subjects.{' '}
          <button className="text-button" onClick={() => setFocus('')}>
            Clear trace
          </button>
          <div className="edge-list">
            {traceEdges.map((e) => (
              <p key={e.from + e.to}>
                <CourseCode code={e.from} />
                <ArrowRight size={14} aria-hidden="true" />
                <CourseCode code={e.to} />
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
                              muted={
                                !!focus &&
                                s.code !== focus &&
                                !related.includes(s.code)
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

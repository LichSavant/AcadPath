import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  eligibility,
  summary,
  forecast,
  simulate,
  planWarnings,
  descendants,
  prerequisiteChain,
  evaluatePlan,
  projectPath,
  candidateEligibility,
  movePlannedSubject,
  matchesSubject,
  type RecordData,
} from '../lib/academic.ts';
import {
  validateCurriculum,
  importCurriculum,
  validateRecord,
} from '../lib/import.ts';
import { sampleCurriculum } from '../lib/sample.ts';
const curriculum = () =>
  validateCurriculum({
    name: 'Test degree',
    subjects: [
      {
        code: 'A',
        name: 'Foundation',
        units: 3,
        year: 1,
        semester: 1,
        offered: [1, 2],
      },
      {
        code: 'B',
        name: 'Programming',
        units: 4,
        year: 1,
        semester: 2,
        prerequisites: ['A'],
        offered: [1, 2],
      },
      {
        code: 'C',
        name: 'Math',
        units: 3,
        year: 1,
        semester: 1,
        offered: [1, 2],
      },
      {
        code: 'D',
        name: 'Capstone',
        units: 6,
        year: 2,
        semester: 1,
        prerequisites: ['B', 'C'],
        offered: [1, 2],
      },
    ],
  });
const record = (): RecordData => ({
  curriculum: curriculum(),
  statuses: {},
  plan: [],
  settings: {
    startYear: 2026,
    startSemester: 1,
    maxUnits: 9,
    assumeCurrentPass: true,
  },
});
void test('No prerequisites is eligible; missing prerequisites block', () => {
  const s = curriculum().subjects;
  assert.equal(eligibility(s[0], new Set()).eligible, true);
  assert.deepEqual(eligibility(s[1], new Set()).prerequisites, ['A']);
});
void test('Completed prerequisite unlocks dependent; multiple prerequisites require all', () => {
  const s = curriculum().subjects;
  assert.equal(eligibility(s[1], new Set(['A'])).eligible, true);
  assert.equal(eligibility(s[3], new Set(['B'])).eligible, false);
  assert.equal(eligibility(s[3], new Set(['B', 'C'])).eligible, true);
});
void test('Progress and remaining units use student statuses', () => {
  const r = record();
  r.statuses = { A: 'completed', B: 'current', C: 'failed' };
  const s = summary(r);
  assert.equal(s.totalUnits, 16);
  assert.equal(s.completedUnits, 3);
  assert.equal(s.progress, 19);
  assert.equal(s.remainingUnits, 13);
  assert.equal(s.completed.length, 1);
  assert.equal(s.current.length, 1);
  assert.equal(s.remaining, 3);
});
void test('Failed prerequisites do not unlock subjects', () => {
  const r = record();
  r.statuses = { A: 'failed' };
  assert.ok(summary(r).blocked.some((s) => s.code === 'B'));
});
void test('Transitive descendants and prerequisite chains follow actual data', () => {
  assert.deepEqual(descendants(curriculum().subjects, 'A'), ['B', 'D']);
  assert.deepEqual(
    new Set(prerequisiteChain(curriculum().subjects, 'D')),
    new Set(['A', 'B', 'C']),
  );
});
void test('Forecast keeps prerequisites in earlier terms and respects unit limits', () => {
  const r = record(),
    f = forecast(r);
  assert.equal(f.graduation, 2);
  assert.deepEqual(planWarnings(r, f.plan), []);
  assert.ok(f.plan[0].codes.includes('A'));
  assert.ok(f.plan[1].codes.includes('B'));
  assert.ok(f.plan[2].codes.includes('D'));
});
void test('Plan catches same-term, duplicate and overloaded subjects', () => {
  const r = record();
  r.plan = [
    { term: 0, codes: ['A', 'B', 'D'] },
    { term: 1, codes: ['A'] },
  ];
  const warnings = planWarnings(r);
  assert.ok(warnings.some((w) => w.includes('Missing prerequisite: A')));
  assert.ok(warnings.some((w) => w.includes('exceeds')));
  assert.ok(warnings.some((w) => w.includes('more than once')));
});
void test('Completed and assumed current subjects cannot be planned twice', () => {
  const r = record();
  r.statuses = { A: 'completed', C: 'current' };
  assert.equal(
    planWarnings(r, [{ term: 0, codes: ['A', 'C'] }]).filter((w) =>
      w.includes('already'),
    ).length,
    2,
  );
});
void test('Current subjects count only with the explicit future-pass assumption', () => {
  const r = record();
  r.statuses = { A: 'current' };
  assert.ok(forecast(r).plan[0].codes.includes('B'));
  r.settings.assumeCurrentPass = false;
  assert.ok(forecast(r).unresolved.includes('A'));
  assert.ok(summary(r).blocked.some((s) => s.code === 'B'));
});
void test('Offerings can leave an empty term without abandoning later subjects', () => {
  const r = record();
  r.curriculum.subjects[0].offered = [2];
  const f = forecast(r);
  assert.ok(!f.plan[0].codes.includes('A'));
  assert.ok(f.plan[1].codes.includes('A'));
  assert.equal(planWarnings(r, [{ term: 0, codes: ['A'] }]).length, 1);
});
void test('Corequisites can be completed or concurrent; generator bundles them', () => {
  const r = record();
  r.curriculum.subjects[0].corequisites = ['C'];
  assert.equal(
    eligibility(r.curriculum.subjects[0], new Set()).eligible,
    false,
  );
  assert.equal(
    eligibility(r.curriculum.subjects[0], new Set(), new Set(['C'])).eligible,
    true,
  );
  const f = forecast(r);
  assert.ok(f.plan[0].codes.includes('A') && f.plan[0].codes.includes('C'));
  assert.deepEqual(planWarnings(r, f.plan), []);
});
void test('Unschedulable unit and corequisite constraints report unresolved', () => {
  const r = record();
  r.settings.maxUnits = 2;
  assert.equal(forecast(r).graduation, null);
  assert.equal(forecast(r).unresolved.length, 4);
});
void test('Simulation fail/pass/delay/move never mutates real data', () => {
  const r = record();
  r.statuses = { A: 'current' };
  const before = JSON.stringify(r);
  for (const action of ['fail', 'pass', 'delay', 'move'] as const) {
    simulate(r, { code: 'A', action, term: 2 });
    assert.equal(JSON.stringify(r), before);
  }
  assert.ok(
    simulate(r, { code: 'A', action: 'fail', term: 0 }).summary.blocked.some(
      (s) => s.code === 'B',
    ),
  );
  assert.ok(
    simulate(r, { code: 'A', action: 'pass', term: 0 }).summary.eligible.some(
      (s) => s.code === 'B',
    ),
  );
});
void test('Delay shifts downstream graduation; impossible exact move stays unresolved', () => {
  const r = record();
  assert.equal(
    simulate(r, { code: 'A', action: 'delay', term: 2 }).forecast.graduation,
    4,
  );
  assert.ok(
    simulate(r, {
      code: 'D',
      action: 'move',
      term: 0,
    }).forecast.unresolved.includes('D'),
  );
});
void test('Malformed, duplicate, missing, cyclic curriculum requirements rejected', () => {
  for (const mutate of [
    (r: RecordData) => {
      r.curriculum.subjects[1].code = 'A';
    },
    (r: RecordData) => {
      r.curriculum.subjects[0].prerequisites = ['MISSING'];
    },
    (r: RecordData) => {
      r.curriculum.subjects[0].prerequisites = ['B'];
    },
  ]) {
    const r = record();
    mutate(r);
    assert.throws(() => validateCurriculum(r.curriculum));
  }
});
void test('CSV handles BOM, CRLF, quoted commas, escaped quotes, semicolon lists', () => {
  const c = importCurriculum(
    '\uFEFFcode,name,units,year,semester,prerequisites\r\nA,"A, \\""quoted\\""",3,1,1,\r\nB,Next,3,1,2,A\r\n'.replaceAll(
      '\\"',
      '"',
    ),
    'sample.csv',
  );
  assert.equal(c.subjects.length, 2);
  assert.equal(c.subjects[0].name, 'A, "quoted"');
  assert.deepEqual(c.subjects[1].prerequisites, ['A']);
  assert.equal(c.source, 'imported');
});
void test('CSV malformed quotes, missing headers, unsupported files rejected', () => {
  assert.throws(() => importCurriculum('code,name\nA,test', 'x.csv'));
  assert.throws(() =>
    importCurriculum('code,name,units,year,semester\nA,"Bad,3,1,1', 'x.csv'),
  );
  assert.throws(() => importCurriculum('text', 'x.pdf'));
});
void test('JSON normalizes codes and rejects invalid units', () => {
  const r = record();
  r.curriculum.subjects[0].units = -1;
  assert.throws(() => importCurriculum(JSON.stringify(r.curriculum), 'x.json'));
  const c = curriculum();
  c.subjects[0].code = 'a';
  assert.equal(validateCurriculum(c).subjects[0].code, 'A');
});
void test('Record validates unknown statuses, terms and bounds', () => {
  const r = record();
  r.statuses.UNKNOWN = 'completed';
  assert.throws(() => validateRecord(r));
  delete r.statuses.UNKNOWN;
  r.settings.maxUnits = 0;
  assert.throws(() => validateRecord(r));
  r.settings.maxUnits = 9;
  r.plan = [
    { term: 0, codes: ['A'] },
    { term: 0, codes: ['B'] },
  ];
  assert.throws(() => validateRecord(r));
});
void test('Labeled sample curriculum schedules without conflicts', () => {
  const r = record();
  r.curriculum = sampleCurriculum;
  r.settings.maxUnits = 21;
  const f = forecast(r);
  assert.equal(sampleCurriculum.source, 'sample');
  assert.equal(sampleCurriculum.subjects.length, 30);
  assert.deepEqual(f.unresolved, []);
  assert.deepEqual(planWarnings(r, f.plan), []);
});

void test('Invalid concurrent subjects cannot unlock a corequisite or later chain', () => {
  const r = record();
  r.curriculum.subjects[0].corequisites = ['C'];
  r.curriculum.subjects[2].offered = [2];
  r.plan = [
    { term: 0, codes: ['A', 'C'] },
    { term: 1, codes: ['B'] },
  ];
  const result = evaluatePlan(r);
  assert.ok(result.terms.every((t) => t.entries.every((e) => !e.eligible)));
  assert.equal(result.terms[1].completedUnits, 0);
  assert.equal(result.graduation, null);
});

void test('Unit overload never contributes projected completions', () => {
  const r = record();
  r.settings.maxUnits = 5;
  r.plan = [
    { term: 0, codes: ['A', 'C'] },
    { term: 1, codes: ['B'] },
  ];
  assert.equal(evaluatePlan(r).terms[1].progress, 0);
  assert.ok(planWarnings(r).some((w) => w.includes('Missing prerequisite')));
});

void test('Candidates use earlier planned passes; moving a prerequisite exposes conflicts', () => {
  const r = record();
  r.plan = [{ term: 0, codes: ['A', 'C'] }];
  assert.equal(candidateEligibility(r, 'B', 0).eligible, false);
  assert.equal(candidateEligibility(r, 'B', 1).eligible, true);
  r.plan = movePlannedSubject(r.plan, 'B', 1);
  assert.equal(evaluatePlan(r).terms[1].completedUnits, 10);
  r.plan = movePlannedSubject(r.plan, 'A', 2);
  assert.ok(
    planWarnings(r).some((w) => w.startsWith('B: Missing prerequisite')),
  );
  assert.equal(
    r.plan.flatMap((t) => t.codes).filter((c) => c === 'A').length,
    1,
  );
});

void test('Dashboard projection retains saved future placements', () => {
  const r = record();
  r.plan = [{ term: 4, codes: ['D'] }];
  assert.equal(projectPath(r).graduation, null); // saved D has no earlier planned prerequisites
  r.plan = [
    { term: 0, codes: ['A', 'C'] },
    { term: 1, codes: ['B'] },
    { term: 4, codes: ['D'] },
  ];
  assert.equal(projectPath(r).graduation, 4);
});

void test('Simulation add/remove and failed future attempts reschedule without modifying data', () => {
  const r = record();
  const original = structuredClone(r);
  const added = simulate(r, { code: 'A', action: 'add', term: 2 });
  assert.equal(added.forecast.plan.find((t) => t.codes.includes('A'))?.term, 2);
  const removed = simulate(r, { code: 'A', action: 'remove', term: 0 });
  assert.equal(
    removed.forecast.plan.find((t) => t.codes.includes('A'))?.term,
    1,
  );
  const failed = simulate(r, { code: 'A', action: 'fail', term: 0 });
  assert.equal(
    failed.forecast.plan.find((t) => t.codes.includes('A'))?.term,
    1,
  );
  assert.equal(failed.forecast.graduation, 3);
  assert.deepEqual(r, original);
  for (const scenario of [added, removed, failed])
    assert.deepEqual(planWarnings(scenario.data), []);
});

void test('Current subjects only unlock today when actually passed, and filters stay consistent', () => {
  const r = record();
  r.statuses.A = 'current';
  const b = r.curriculum.subjects[1];
  assert.equal(matchesSubject(b, r.statuses, 'Programming', 'blocked'), true);
  assert.equal(matchesSubject(b, r.statuses, ' b ', 'eligible'), false);
  const passed = simulate(r, { code: 'A', action: 'pass', term: 0 });
  assert.equal(matchesSubject(b, passed.data.statuses, '', 'eligible'), true);
  assert.equal(summary(r).completedUnits, 0);
});

void test('Profile and curriculum context round-trip; invalid numbers and scenarios are rejected', () => {
  const r = record();
  r.profile = { name: 'Student' };
  r.curriculum.program = 'BS Computer Science';
  r.curriculum.curriculumYear = 2024;
  assert.deepEqual(validateRecord(r), r);
  for (const invalid of [[], {}, ' ', null, true]) {
    assert.throws(() =>
      validateRecord({ ...r, settings: { ...r.settings, maxUnits: invalid } }),
    );
  }
  assert.throws(() => simulate(r, { code: 'A', action: 'pass', term: 0 }));
  assert.throws(() => simulate(r, { code: 'A', action: 'move', term: 24 }));
  r.statuses.A = 'completed';
  assert.throws(() => simulate(r, { code: 'A', action: 'fail', term: 0 }));
});

void test('Zero-unit curricula use subject completion without NaN progress', () => {
  const r = record();
  r.curriculum.subjects.forEach((s) => {
    s.units = 0;
  });
  r.statuses.A = 'completed';
  assert.equal(summary(r).progress, 25);
  assert.equal(
    summary({ ...r, curriculum: { ...r.curriculum, subjects: [] } }).progress,
    0,
  );
});

export const STATUSES = [
  'remaining',
  'current',
  'completed',
  'failed',
] as const;
export type Status = (typeof STATUSES)[number];
export type Subject = {
  code: string;
  name: string;
  units: number;
  year: number;
  semester: number;
  prerequisites: string[];
  corequisites: string[];
  offered: number[];
};
export type Curriculum = {
  name: string;
  source: 'imported' | 'sample';
  subjects: Subject[];
};
export type Settings = {
  startYear: number;
  startSemester: number;
  maxUnits: number;
  assumeCurrentPass: boolean;
};
export type Plan = { term: number; codes: string[] }[];
export type RecordData = {
  curriculum: Curriculum;
  statuses: Record<string, Status>;
  plan: Plan;
  settings: Settings;
};
export const defaultSettings = (): Settings => ({
  startYear: new Date().getFullYear(),
  startSemester: 2,
  maxUnits: 21,
  assumeCurrentPass: true,
});
export function statusOf(
  statuses: Record<string, Status>,
  code: string,
): Status {
  return statuses[code] ?? 'remaining';
}
export function eligibility(
  subject: Subject,
  completed: Set<string>,
  concurrent = new Set<string>(),
) {
  const prerequisites = subject.prerequisites.filter(
    (code) => !completed.has(code),
  );
  const corequisites = subject.corequisites.filter(
    (code) => !completed.has(code) && !concurrent.has(code),
  );
  return {
    eligible: prerequisites.length === 0 && corequisites.length === 0,
    prerequisites,
    corequisites,
  };
}
export function completedCodes(statuses: Record<string, Status>) {
  return new Set(
    Object.keys(statuses).filter((code) => statuses[code] === 'completed'),
  );
}
export function academicState(
  subject: Subject,
  statuses: Record<string, Status>,
) {
  const status = statusOf(statuses, subject.code);
  if (status === 'completed' || status === 'current') return status;
  return eligibility(subject, completedCodes(statuses)).eligible
    ? 'eligible'
    : 'blocked';
}
export function summary(data: RecordData) {
  const subjects = data.curriculum.subjects;
  const completed = subjects.filter(
    (s) => statusOf(data.statuses, s.code) === 'completed',
  );
  const current = subjects.filter(
    (s) => statusOf(data.statuses, s.code) === 'current',
  );
  const eligible = subjects.filter(
    (s) => academicState(s, data.statuses) === 'eligible',
  );
  const blocked = subjects.filter(
    (s) => academicState(s, data.statuses) === 'blocked',
  );
  const totalUnits = subjects.reduce((n, s) => n + s.units, 0);
  const completedUnits = completed.reduce((n, s) => n + s.units, 0);
  return {
    completed,
    current,
    eligible,
    blocked,
    totalUnits,
    completedUnits,
    remaining: subjects.length - completed.length,
    remainingUnits: totalUnits - completedUnits,
    progress: totalUnits
      ? Math.round((completedUnits / totalUnits) * 100)
      : Math.round((completed.length / subjects.length) * 100),
  };
}
export function descendants(subjects: Subject[], code: string): string[] {
  const found = new Set<string>();
  const visit = (parent: string) => {
    for (const s of subjects)
      if (s.prerequisites.includes(parent) && !found.has(s.code)) {
        found.add(s.code);
        visit(s.code);
      }
  };
  visit(code);
  return [...found].filter((c) => c !== code);
}
export function prerequisiteChain(subjects: Subject[], code: string): string[] {
  const found = new Set<string>();
  const visit = (c: string) => {
    for (const p of subjects.find((s) => s.code === c)?.prerequisites ?? [])
      if (!found.has(p)) {
        found.add(p);
        visit(p);
      }
  };
  visit(code);
  return [...found];
}
export function termInfo(settings: Settings, offset: number) {
  const index = settings.startSemester - 1 + offset;
  return {
    year: settings.startYear + Math.floor(index / 2),
    semester: (index % 2) + 1,
  };
}
export function termLabel(settings: Settings, offset: number) {
  const t = termInfo(settings, offset);
  return `AY ${t.year}–${t.year + 1} · Semester ${t.semester}`;
}
export function planWarnings(data: RecordData, plan = data.plan): string[] {
  const errors: string[] = [];
  const completed = completedCodes(data.statuses);
  const used = new Set<string>();
  if (data.settings.assumeCurrentPass)
    for (const [c, s] of Object.entries(data.statuses))
      if (s === 'current') completed.add(c);
  for (const term of [...plan].sort((a, b) => a.term - b.term)) {
    const concurrent = new Set(term.codes);
    let units = 0;
    for (const code of term.codes) {
      const s = data.curriculum.subjects.find((s) => s.code === code);
      if (!s) {
        errors.push(`Unknown subject ${code}.`);
        continue;
      }
      units += s.units;
      if (used.has(code)) errors.push(`${code} is planned more than once.`);
      if (completed.has(code) && !used.has(code))
        errors.push(`${code} is already completed or assumed passed.`);
      if (
        statusOf(data.statuses, code) === 'current' &&
        !data.settings.assumeCurrentPass
      )
        errors.push(
          `${code} is currently taking; resolve its outcome before planning a retake.`,
        );
      const e = eligibility(s, completed, concurrent);
      if (e.prerequisites.length)
        errors.push(
          `${code}: complete ${e.prerequisites.join(', ')} before term ${term.term + 1}.`,
        );
      if (e.corequisites.length)
        errors.push(
          `${code}: take ${e.corequisites.join(', ')} together or earlier.`,
        );
      if (!s.offered.includes(termInfo(data.settings, term.term).semester))
        errors.push(`${code} is not offered in term ${term.term + 1}.`);
      used.add(code);
    }
    if (units > data.settings.maxUnits)
      errors.push(
        `Term ${term.term + 1} exceeds ${data.settings.maxUnits} units (${units}).`,
      );
    // Invalid subjects never unlock later prerequisites.
    const valid = term.codes.filter((code) => {
      const s = data.curriculum.subjects.find((s) => s.code === code);
      return (
        s &&
        eligibility(s, completed, concurrent).eligible &&
        s.offered.includes(termInfo(data.settings, term.term).semester)
      );
    });
    for (const code of valid) completed.add(code);
  }
  return errors;
}
export function forecast(
  data: RecordData,
  notBefore: Record<string, number> = {},
  pinned: Record<string, number> = {},
) {
  const subjects = data.curriculum.subjects;
  const completed = completedCodes(data.statuses);
  if (data.settings.assumeCurrentPass)
    for (const [c, s] of Object.entries(data.statuses))
      if (s === 'current') completed.add(c);
  const plan: Plan = [];
  const byCode = new Map(subjects.map((s) => [s.code, s]));
  const impact = new Map(
    subjects.map((s) => [s.code, descendants(subjects, s.code).length]),
  );
  const ordered = [...subjects].sort(
    (a, b) =>
      impact.get(b.code)! - impact.get(a.code)! ||
      a.year - b.year ||
      a.semester - b.semester ||
      a.code.localeCompare(b.code),
  );
  for (let term = 0; term < 24 && completed.size < subjects.length; term++) {
    const chosen = new Set<string>();
    let units = 0;
    const semester = termInfo(data.settings, term).semester;
    const candidates = [...ordered].sort(
      (a, b) =>
        Number(pinned[b.code] === term) - Number(pinned[a.code] === term),
    );
    for (const s of candidates) {
      if (completed.has(s.code) || chosen.has(s.code)) continue;
      const bundle = new Set<string>();
      let invalid = false;
      const collect = (c: string) => {
        if (completed.has(c) || chosen.has(c) || bundle.has(c)) return;
        const sub = byCode.get(c);
        if (!sub) {
          invalid = true;
          return;
        }
        bundle.add(c);
        for (const co of sub.corequisites) collect(co);
      };
      collect(s.code);
      const bundleSubjects = [...bundle].map((c) => byCode.get(c)!);
      const cost = bundleSubjects.reduce((n, s) => n + s.units, 0);
      if (invalid || units + cost > data.settings.maxUnits) continue;
      if (
        bundleSubjects.some(
          (s) =>
            statusOf(data.statuses, s.code) === 'current' ||
            (notBefore[s.code] ?? 0) > term ||
            (pinned[s.code] !== undefined && pinned[s.code] !== term) ||
            !s.offered.includes(semester) ||
            !s.prerequisites.every((p) => completed.has(p)),
        )
      )
        continue;
      for (const c of bundle) chosen.add(c);
      units += cost;
    }
    plan.push({ term, codes: [...chosen] });
    for (const c of chosen) completed.add(c);
  }
  while (plan.length && !plan.at(-1)!.codes.length) plan.pop();
  const unresolved = subjects
    .filter((s) => !completed.has(s.code))
    .map((s) => s.code);
  return {
    plan,
    unresolved,
    graduation: unresolved.length ? null : plan.length ? plan.at(-1)!.term : -1,
  };
}
export type Scenario = {
  code: string;
  action: 'fail' | 'pass' | 'delay' | 'move';
  term: number;
};
export function simulate(data: RecordData, scenario: Scenario) {
  const copy: RecordData = structuredClone(data);
  const delays: Record<string, number> = {};
  const pinned: Record<string, number> = {};
  const subject = copy.curriculum.subjects.find(
    (s) => s.code === scenario.code,
  );
  if (!subject) throw new Error('Choose a subject.');
  if (scenario.action === 'pass') copy.statuses[scenario.code] = 'completed';
  else if (scenario.action === 'fail') copy.statuses[scenario.code] = 'failed';
  else {
    copy.statuses[scenario.code] = 'remaining';
    if (scenario.action === 'delay') delays[scenario.code] = scenario.term;
    else pinned[scenario.code] = scenario.term;
  }
  return {
    data: copy,
    summary: summary(copy),
    forecast: forecast(copy, delays, pinned),
    affected: descendants(copy.curriculum.subjects, scenario.code),
  };
}

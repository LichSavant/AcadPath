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
  program?: string;
  curriculumYear?: number;
  prospectus?: { filename: string; method: 'pdf-text' | 'ocr' | 'mixed' };
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
  setupComplete?: boolean;
  profile?: { name: string };
  curriculum: Curriculum;
  statuses: Record<string, Status>;
  plan: Plan;
  settings: Settings;
};
export function isSetupComplete(data: RecordData | null): boolean {
  return !!data && data.setupComplete !== false;
}
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
      : subjects.length
        ? Math.round((completed.length / subjects.length) * 100)
        : 0,
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
  return `${t.semester === 1 ? '1st' : '2nd'} Semester ${t.year}–${t.year + 1}`;
}
export type PlanEntry = { code: string; reasons: string[]; eligible: boolean };
export type TermEvaluation = {
  term: number;
  units: number;
  entries: PlanEntry[];
  completedCodes: string[];
  completedUnits: number;
  remainingUnits: number;
  progress: number;
};
export function futureCompleted(data: RecordData) {
  const completed = completedCodes(data.statuses);
  if (data.settings.assumeCurrentPass)
    for (const [code, status] of Object.entries(data.statuses))
      if (status === 'current') completed.add(code);
  return completed;
}
export function subjectLabel(subjects: Subject[], code: string) {
  const subject = subjects.find((s) => s.code === code);
  return subject ? `${code} – ${subject.name}` : code;
}
export function evaluatePlan(data: RecordData, plan = data.plan) {
  const completed = futureCompleted(data),
    used = new Set<string>();
  const subjects = data.curriculum.subjects,
    byCode = new Map(subjects.map((s) => [s.code, s]));
  const totalUnits = subjects.reduce((n, s) => n + s.units, 0);
  const terms: TermEvaluation[] = [];
  const warnings: string[] = [];
  for (const term of [...plan].sort((a, b) => a.term - b.term)) {
    const units = term.codes.reduce(
      (n, c) => n + (byCode.get(c)?.units ?? 0),
      0,
    );
    const overLimit = units > data.settings.maxUnits;
    const entries: PlanEntry[] = term.codes.map((code) => {
      const s = byCode.get(code),
        reasons: string[] = [];
      if (!s) reasons.push('Unknown subject.');
      else {
        if (used.has(code)) reasons.push('Subject is planned more than once.');
        if (completed.has(code) && !used.has(code))
          reasons.push('Subject is already completed or assumed passed.');
        if (
          statusOf(data.statuses, code) === 'current' &&
          !data.settings.assumeCurrentPass
        )
          reasons.push(
            'Resolve the current subject outcome before planning a retake.',
          );
        const missing = s.prerequisites.filter((p) => !completed.has(p));
        if (missing.length)
          reasons.push(`Missing prerequisite: ${missing.join(', ')}`);
        if (!s.offered.includes(termInfo(data.settings, term.term).semester))
          reasons.push('Not offered in this semester.');
        if (overLimit)
          reasons.push(
            `Term ${term.term + 1} exceeds ${data.settings.maxUnits} units (${units}).`,
          );
      }
      used.add(code);
      return { code, reasons, eligible: reasons.length === 0 };
    });
    // Eliminate invalid concurrent subjects to a fixed point: an unavailable
    // corequisite must never unlock its partner or later prerequisite chains.
    let changed = true;
    while (changed) {
      changed = false;
      const concurrent = new Set(
        entries.filter((e) => e.eligible).map((e) => e.code),
      );
      for (const entry of entries)
        if (entry.eligible) {
          const missing = byCode
            .get(entry.code)!
            .corequisites.filter(
              (c) => !completed.has(c) && !concurrent.has(c),
            );
          if (missing.length) {
            entry.reasons.push(`Corequisite needed: ${missing.join(', ')}`);
            entry.eligible = false;
            changed = true;
          }
        }
    }
    for (const entry of entries) {
      if (entry.eligible) completed.add(entry.code);
      for (const reason of entry.reasons)
        warnings.push(`${entry.code}: ${reason}`);
    }
    const completedUnits = subjects
      .filter((s) => completed.has(s.code))
      .reduce((n, s) => n + s.units, 0);
    terms.push({
      term: term.term,
      units,
      entries,
      completedCodes: [...completed],
      completedUnits,
      remainingUnits: totalUnits - completedUnits,
      progress: totalUnits
        ? Math.round((completedUnits / totalUnits) * 100)
        : Math.round((completed.size / subjects.length) * 100),
    });
  }
  const unresolved = subjects
    .filter((s) => !completed.has(s.code))
    .map((s) => s.code);
  return {
    terms,
    warnings,
    unresolved,
    graduation:
      warnings.length || unresolved.length
        ? null
        : terms.length
          ? terms.at(-1)!.term
          : -1,
  };
}
export function planWarnings(data: RecordData, plan = data.plan) {
  return evaluatePlan(data, plan).warnings;
}
export function movePlannedSubject(
  plan: Plan,
  code: string,
  term: number | null,
): Plan {
  const result = plan.map((t) => ({
    ...t,
    codes: t.codes.filter((c) => c !== code),
  }));
  if (term !== null) {
    const target = result.find((t) => t.term === term);
    if (target) target.codes.push(code);
    else result.push({ term, codes: [code] });
  }
  return result.filter((t) => t.codes.length).sort((a, b) => a.term - b.term);
}
export function candidateEligibility(
  data: RecordData,
  code: string,
  term: number,
) {
  const trial = movePlannedSubject(data.plan, code, term);
  return (
    evaluatePlan(data, trial)
      .terms.find((t) => t.term === term)
      ?.entries.find((e) => e.code === code) ?? {
      code,
      eligible: false,
      reasons: ['Choose a valid subject and term.'],
    }
  );
}
export function matchesSubject(
  subject: Subject,
  statuses: Record<string, Status>,
  search: string,
  filter: string,
) {
  return (
    (subject.code + ' ' + subject.name)
      .toLowerCase()
      .includes(search.trim().toLowerCase()) &&
    (filter === 'all' ||
      (filter === 'remaining'
        ? statusOf(statuses, subject.code) !== 'completed'
        : academicState(subject, statuses) === filter))
  );
}
export function prerequisiteEdges(subjects: Subject[], root: string) {
  const chain = new Set([root, ...descendants(subjects, root)]);
  return subjects.flatMap((s) =>
    s.prerequisites
      .filter((p) => chain.has(p) && chain.has(s.code))
      .map((p) => ({ from: p, to: s.code })),
  );
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
export function projectPath(data: RecordData) {
  const pinned = Object.fromEntries(
    data.plan.flatMap((t) => t.codes.map((c) => [c, t.term])),
  );
  const result = forecast(data, {}, pinned);
  const warnings = planWarnings(data);
  return {
    ...result,
    warnings,
    graduation: warnings.length ? null : result.graduation,
  };
}
export function graduationLabel(data: RecordData, graduation: number | null) {
  if (graduation === null) return 'Unresolved';
  if (graduation === -1)
    return summary(data).remaining === 0
      ? 'Curriculum complete'
      : 'After current subjects pass';
  return termLabel(data.settings, graduation);
}
export type Scenario = {
  code: string;
  action: 'fail' | 'pass' | 'delay' | 'move' | 'add' | 'remove';
  term: number;
};
export function simulate(data: RecordData, scenario: Scenario) {
  if (
    !Number.isInteger(scenario.term) ||
    scenario.term < 0 ||
    scenario.term > 23
  )
    throw new Error('Choose a future term from 1 to 24.');
  const copy: RecordData = structuredClone(data);
  const subject = copy.curriculum.subjects.find(
    (s) => s.code === scenario.code,
  );
  if (!subject) throw new Error('Choose a subject.');
  if (
    !['fail', 'pass', 'delay', 'move', 'add', 'remove'].includes(
      scenario.action,
    )
  )
    throw new Error('Choose a supported scenario.');
  if (statusOf(copy.statuses, scenario.code) === 'completed')
    throw new Error('Choose an unfinished subject.');
  if (
    scenario.action === 'pass' &&
    statusOf(copy.statuses, scenario.code) !== 'current'
  )
    throw new Error(
      'Only a current subject can be marked passed in this scenario.',
    );
  if (
    scenario.action === 'add' &&
    (statusOf(copy.statuses, scenario.code) === 'current' ||
      copy.plan.some((t) => t.codes.includes(scenario.code)))
  )
    throw new Error('Choose an unplanned subject.');
  const affected = descendants(copy.curriculum.subjects, scenario.code);
  if (scenario.action === 'pass') copy.statuses[scenario.code] = 'completed';
  else if (scenario.action === 'fail') copy.statuses[scenario.code] = 'failed';
  else if (scenario.action === 'delay' || scenario.action === 'move')
    copy.statuses[scenario.code] = 'remaining';
  const delays: Record<string, number> = {},
    pinned: Record<string, number> = {};
  if (
    scenario.action === 'fail' &&
    statusOf(data.statuses, scenario.code) !== 'current'
  ) {
    const attempt = projectPath(data).plan.find((t) =>
      t.codes.includes(scenario.code),
    )?.term;
    if (attempt !== undefined) delays[scenario.code] = attempt + 1;
  }
  // Keep unaffected saved placements. Recompute the changed chain rather than
  // retaining impossible downstream dates after a failed/delayed prerequisite.
  for (const t of copy.plan)
    for (const c of t.codes)
      if (
        c !== scenario.code &&
        !affected.includes(c) &&
        !futureCompleted(copy).has(c)
      )
        pinned[c] = t.term;
  if (scenario.action === 'delay') delays[scenario.code] = scenario.term;
  if (scenario.action === 'move' || scenario.action === 'add')
    pinned[scenario.code] = scenario.term;
  if (scenario.action === 'remove') {
    const original =
      data.plan.find((t) => t.codes.includes(scenario.code))?.term ??
      projectPath(data).plan.find((t) => t.codes.includes(scenario.code))?.term;
    if (original === undefined)
      throw new Error('Choose a subject in the current path.');
    // Removing a requirement from a semester does not waive it. Find its next
    // feasible offering strictly after the removed placement.
    delays[scenario.code] = original + 1;
  }
  const result = forecast(copy, delays, pinned);
  copy.plan = result.plan;
  return { data: copy, summary: summary(copy), forecast: result, affected };
}

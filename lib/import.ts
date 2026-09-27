import {
  STATUSES,
  type Curriculum,
  type RecordData,
  type Subject,
} from './academic.ts';

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a JSON object.');
  return value as Record<string, unknown>;
}
function string(value: unknown, label: string, max = 180) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
    throw new Error(`${label} must be 1â€“${max} characters.`);
  return value.trim();
}
function number(
  value: unknown,
  label: string,
  min: number,
  max: number,
  integer = false,
) {
  if (value === '' || value === null || typeof value === 'boolean')
    throw new Error(`${label} is required.`);
  const n = Number(value);
  if (
    !Number.isFinite(n) ||
    n < min ||
    n > max ||
    (integer && !Number.isInteger(n))
  )
    throw new Error(
      `${label} must be ${integer ? 'a whole number ' : ''}between ${min} and ${max}.`,
    );
  return n;
}
function code(value: unknown) {
  const s = string(value, 'Subject code', 30).toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9 _.-]*$/.test(s))
    throw new Error(`Invalid subject code: ${s}`);
  return s;
}
function list(value: unknown) {
  const a =
    typeof value === 'string'
      ? value
          .split(';')
          .map((x) => x.trim())
          .filter(Boolean)
      : (value ?? []);
  if (!Array.isArray(a))
    throw new Error(
      'Prerequisites/corequisites must be arrays or semicolon-separated codes.',
    );
  return [...new Set(a.filter((v) => v !== '').map(code))];
}
export function validateCurriculum(value: unknown): Curriculum {
  const c = object(value);
  const name = string(c.name, 'Curriculum name');
  if (
    !Array.isArray(c.subjects) ||
    !c.subjects.length ||
    c.subjects.length > 300
  )
    throw new Error('A curriculum needs 1â€“300 subjects.');
  const subjects: Subject[] = c.subjects.map((raw, i) => {
    const s = object(raw);
    const semester = number(s.semester, `Row ${i + 1} semester`, 1, 2, true);
    const offered =
      s.offered === undefined || s.offered === ''
        ? [semester]
        : typeof s.offered === 'string'
          ? s.offered.split(';')
          : s.offered;
    if (!Array.isArray(offered) || !offered.length)
      throw new Error('Offered semesters must contain 1 and/or 2.');
    return {
      code: code(s.code),
      name: string(s.name, `Row ${i + 1} subject name`),
      units: number(s.units, `Row ${i + 1} units`, 0, 30),
      year: number(s.year, `Row ${i + 1} year`, 1, 8, true),
      semester,
      prerequisites: list(s.prerequisites),
      corequisites: list(s.corequisites),
      offered: [
        ...new Set(
          offered.map((v) => number(v, 'Offered semester', 1, 2, true)),
        ),
      ],
    };
  });
  const codes = new Set(subjects.map((s) => s.code));
  if (codes.size !== subjects.length)
    throw new Error('Subject codes must be unique (case-insensitive).');
  for (const s of subjects)
    for (const p of [...s.prerequisites, ...s.corequisites]) {
      if (p === s.code) throw new Error(`${s.code} cannot require itself.`);
      if (!codes.has(p))
        throw new Error(
          `${s.code} references missing subject ${p}. Include it in the curriculum.`,
        );
    }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const byCode = new Map(subjects.map((s) => [s.code, s]));
  const visit = (c: string) => {
    if (visiting.has(c))
      throw new Error(`Prerequisite cycle detected at ${c}.`);
    if (visited.has(c)) return;
    visiting.add(c);
    for (const p of byCode.get(c)!.prerequisites) visit(p);
    visiting.delete(c);
    visited.add(c);
  };
  subjects.forEach((s) => visit(s.code));
  return {
    name,
    source: c.source === 'sample' ? 'sample' : 'imported',
    subjects,
  };
}
export function parseCSV(text: string) {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (quoted) {
      if (c === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        closed = true;
      } else field += c;
    } else if (c === '"') {
      if (field || closed) throw new Error('Malformed CSV quote.');
      quoted = true;
    } else if (c === ',' || c === '\n' || c === '\r') {
      row.push(field);
      field = '';
      closed = false;
      if (c !== ',') {
        if (row.some((v) => v.trim())) rows.push(row);
        row = [];
        if (c === '\r' && source[i + 1] === '\n') i++;
      }
    } else {
      if (closed && !/\s/.test(c))
        throw new Error('Unexpected text after a CSV quote.');
      if (!closed) field += c;
    }
  }
  if (quoted) throw new Error('Unclosed CSV quote.');
  row.push(field);
  if (row.some((v) => v.trim())) rows.push(row);
  const headers = rows.shift()?.map((h) => h.trim().toLowerCase());
  if (!headers) throw new Error('CSV is empty.');
  for (const key of ['code', 'name', 'units', 'year', 'semester'])
    if (!headers.includes(key)) throw new Error(`CSV header missing: ${key}.`);
  if (new Set(headers).size !== headers.length)
    throw new Error('CSV headers must be unique.');
  return rows.map((r, i) => {
    if (r.length !== headers.length)
      throw new Error(
        `CSV row ${i + 2} has ${r.length} fields; expected ${headers.length}.`,
      );
    return Object.fromEntries(headers.map((h, j) => [h, r[j]]));
  });
}
export function importCurriculum(text: string, fileName: string): Curriculum {
  if (new TextEncoder().encode(text).length > 1_000_000)
    throw new Error('Files must be smaller than 1 MB.');
  if (fileName.toLowerCase().endsWith('.json'))
    return validateCurriculum({
      ...object(JSON.parse(text.replace(/^\uFEFF/, ''))),
      source: 'imported',
    });
  if (fileName.toLowerCase().endsWith('.csv'))
    return validateCurriculum({
      name: fileName.replace(/\.csv$/i, ''),
      source: 'imported',
      subjects: parseCSV(text),
    });
  throw new Error(
    'Upload CSV or JSON. PDF/image OCR is not supported; use the CSV template to transcribe your prospectus.',
  );
}
export function validateRecord(value: unknown): RecordData {
  const r = object(value),
    curriculum = validateCurriculum(r.curriculum),
    statuses = object(r.statuses),
    settings = object(r.settings);
  const codes = new Set(curriculum.subjects.map((s) => s.code));
  for (const [c, s] of Object.entries(statuses))
    if (!codes.has(c) || !STATUSES.includes(s as never))
      throw new Error(`Invalid status for ${c}.`);
  if (!Array.isArray(r.plan) || r.plan.length > 24)
    throw new Error('Plan must have at most 24 terms.');
  const terms = new Set<number>();
  const plan = r.plan.map((raw) => {
    const t = object(raw);
    const term = number(t.term, 'Plan term', 0, 23, true);
    if (terms.has(term)) throw new Error('Duplicate plan term.');
    terms.add(term);
    if (
      !Array.isArray(t.codes) ||
      t.codes.length > 300 ||
      t.codes.some((c) => typeof c !== 'string' || !codes.has(c))
    )
      throw new Error('Plan contains unknown subjects.');
    return { term, codes: t.codes as string[] };
  });
  if (typeof settings.assumeCurrentPass !== 'boolean')
    throw new Error('Select the current-subject assumption.');
  return {
    curriculum,
    statuses: statuses as RecordData['statuses'],
    plan,
    settings: {
      startYear: number(settings.startYear, 'Start year', 2000, 2100, true),
      startSemester: number(
        settings.startSemester,
        'Start semester',
        1,
        2,
        true,
      ),
      maxUnits: number(settings.maxUnits, 'Maximum units', 1, 40),
      assumeCurrentPass: settings.assumeCurrentPass,
    },
  };
}

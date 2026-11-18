import { validateCurriculum } from './import.ts';
import type { Curriculum } from './academic.ts';

export type DraftRow = {
  id: string;
  code: string;
  name: string;
  units: string;
  prerequisites: string;
  corequisites: string;
  year: string;
  semester: string;
  evidence: string;
};
export type ProspectusDraft = {
  name: string;
  filename: string;
  method: 'pdf-text' | 'ocr' | 'mixed';
  text: string;
  rows: DraftRow[];
};
export type TextToken = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

// Geometric line reconstruction preserves wide table gaps instead of flattening
// columns into a sentence. Unknown fields are deliberately left blank for review.
export function layoutText(tokens: TextToken[]) {
  const lines: { y: number; height: number; tokens: TextToken[] }[] = [];
  for (const token of [...tokens]
    .filter((t) => t.text.trim())
    .sort((a, b) => a.y - b.y || a.x - b.x)) {
    let line = lines.find(
      (l) =>
        Math.abs(l.y - token.y) <=
        Math.max(2, Math.min(l.height, token.height) * 0.45),
    );
    if (!line) {
      line = { y: token.y, height: token.height, tokens: [] };
      lines.push(line);
    }
    line.tokens.push(token);
  }
  return lines
    .sort((a, b) => a.y - b.y)
    .map((line) => {
      let previous: TextToken | undefined;
      return line.tokens
        .sort((a, b) => a.x - b.x)
        .map((t) => {
          const gap = previous ? t.x - (previous.x + previous.width) : 0;
          const separator = !previous
            ? ''
            : gap > Math.max(12, t.height * 1.1)
              ? '\t'
              : ' ';
          previous = t;
          return separator + t.text.trim();
        })
        .join('');
    })
    .join('\n');
}
const ordinal: Record<string, string> = {
  first: '1',
  second: '2',
  third: '3',
  fourth: '4',
  fifth: '5',
  sixth: '6',
  seventh: '7',
  eighth: '8',
  '1st': '1',
  '2nd': '2',
  '3rd': '3',
  '4th': '4',
  '5th': '5',
  '6th': '6',
  '7th': '7',
  '8th': '8',
};
const valueOf = (s: string) => ordinal[s.toLowerCase()] ?? s;
// Requisite cells mix labels, codes, and non-course rules such as
// "2ND YEAR STANDING". Keep real course codes only and route labeled
// corequisites to their own field.
function splitRequirements(
  value: string,
  fallback: 'prerequisites' | 'corequisites',
) {
  const result: { prerequisites: string[]; corequisites: string[] } = {
    prerequisites: [],
    corequisites: [],
  };
  for (const raw of value.split(/;|,|\+|&|\band\b/i)) {
    const segment = raw
      .replace(/\b(?:pre|co)?-?req(?:uisite)?s?\b[:\-]?\s*/gi, '')
      .replace(
        /\b(?:[1-8](?:st|nd|rd|th)?|first|second|third|fourth|fifth)\s+year\s+standing\b/gi,
        '',
      )
      .replace(/\b(?:senior|junior|sophomore|freshman)\s+standing\b/gi, '')
      .trim();
    if (
      !segment ||
      /^(?:none|n\/?a|nil|[-\u2013\u2014]+)$/i.test(segment) ||
      !isCodeCell(segment) ||
      /\bor\b/i.test(segment)
    )
      continue;
    const type = /co.?req|corequisite/i.test(raw)
      ? 'corequisites'
      : fallback;
    result[type].push(segment.toUpperCase().replace(/\s+/g, ' '));
  }
  return result;
}
const courseCode =
  /^([A-Z]{2,12}(?:\s*[.-]?\s*\d{1,4}[A-Z]*)(?:\s+[A-Z])?)\s+(.+)$/i;
const hyphenCourseCode = /^([A-Z]{2,12}(?:-[A-Z0-9]{1,16})+)\s+(.+)$/i;
const notCode =
  /^(?:total|subtotal|page|course|description|subject|title|units?|requisite|semester|year|summer|academic|bachelor|master|doctor|elective|references?)\b/i;
// Codes may be alphanumeric (CIS 1101), hyphenated (GE-MMW), or word-based
// (CS ELEC). Reject prose so headings and footers never become subjects.
function isCodeCell(value: string) {
  const s = value.trim();
  const words = s.split(/\s+/);
  // A bare word is a wrapped title, not a code. Word codes look like
  // "CS ELEC"; everything else needs a digit or a hyphen.
  const wordCode =
    words.length > 1 &&
    words.length <= 3 &&
    /^[A-Z]{2,4}$/i.test(words[0]) &&
    words.slice(1).every((w) => /^[A-Z]{2,6}$/i.test(w));
  return (
    /^[A-Z0-9][A-Z0-9 .&_/-]{1,29}$/i.test(s) &&
    (/\d/.test(s) || s.includes('-') || wordCode) &&
    !notCode.test(s) &&
    !/\b(?:and|of|the|in|for|with|to)\b/i.test(s)
  );
}
function splitCells(line: string) {
  const cells = (
    line.includes('\t') ? line.split(/\t+/) : line.split(/\s*\|\s*| {2,}/)
  ).map((c) => c.trim());
  while (cells.length && !cells.at(-1)) cells.pop();
  return cells;
}
function headerKey(c: string) {
  return /description|subject|title/i.test(c)
    ? 'name'
    : /co.?req/i.test(c)
      ? 'corequisites'
      : /pre.?req|requisite/i.test(c)
        ? 'prerequisites'
        : /units?/i.test(c)
          ? 'units'
          : /semester|^sem$/i.test(c)
            ? 'semester'
            : /year/i.test(c)
              ? 'year'
              : /code|course/i.test(c)
                ? 'code'
                : '';
}
// Without column headers, split a single description cell. A requirement
// starts at an explicit label, "None", or a course code after the units.
function parseRest(text: string) {
  const tokens = text.split(/\s+/).filter(Boolean);
  let requirement = tokens.length;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (
      /^(?:none|n\/?a|nil|[-\u2013\u2014])$/i.test(token) ||
      /^(?:pre|co)?-?req(?:uisite)?s?$/i.test(token)
    ) {
      requirement = i;
      break;
    }
    if (
      /^[A-Z]{2,6}$/i.test(token) &&
      /^\d{1,4}[A-Z]?$/i.test(tokens[i + 1] ?? '') &&
      (i === 0 ||
        /^\d+(?:\.\d+)?$/.test(tokens[i - 1]) ||
        tokens[i - 1] === ';')
    ) {
      requirement = i;
      break;
    }
  }
  const head = tokens.slice(0, requirement);
  const numbers = head.flatMap((t, i) =>
    /^\d+(?:\.\d+)?$/.test(t) ? [i] : [],
  );
  // Multiple numeric columns (lecture/lab/total) are ambiguous without a header.
  return numbers.length === 1
    ? {
        name: head.filter((_, i) => i !== numbers[0]).join(' '),
        units: head[numbers[0]],
        prerequisites: tokens.slice(requirement).join(' '),
      }
    : {
        name: head.join(' '),
        units: '',
        prerequisites: tokens.slice(requirement).join(' '),
      };
}
function parseCells(parts: string[]) {
  const numbers = parts.flatMap((c, i) =>
    /^\d+(?:\.\d+)?$/.test(c) ? [i] : [],
  );
  return numbers.length === 1
    ? {
        name: parts.slice(0, numbers[0]).join(' ').trim(),
        units: parts[numbers[0]],
        prerequisites: parts.slice(numbers[0] + 1).join(' ').trim(),
      }
    : { name: parts.join(' ').trim(), units: '', prerequisites: '' };
}
export function parseProspectusText(
  text: string,
  filename: string,
  method: ProspectusDraft['method'],
): ProspectusDraft {
  let year = '',
    semester = '';
  let headers: string[] = [];
  const rows: DraftRow[] = [];
  for (const original of text.split(/\r?\n/)) {
    const line = original.trim();
    if (!line) continue;
    if (
      /^elective equivalents\b/i.test(line) ||
      /^references\b/i.test(line) ||
      /^\[E\d\]/i.test(line)
    )
      break;
    const cells = splitCells(line);
    const dataLine =
      (cells.length > 1 && isCodeCell(cells[0])) ||
      courseCode.test(line) ||
      hyphenCourseCode.test(line);
    const yearMatch =
      line.match(
        /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|[1-8](?:st|nd|rd|th)?)\s+year\b/i,
      ) ?? line.match(/\byear\s*(?:level)?\s*[:\-]?\s*([1-8])\b/i);
    const semMatch = line.match(
      /\b(first|second|1st|2nd|[12])\s+sem(?:ester)?\b|\bsem(?:ester)?\s+([12])\b/i,
    );
    if (yearMatch && !dataLine) {
      year = valueOf(yearMatch[1] ?? yearMatch[2]);
      semester = '';
    }
    if (semMatch && !dataLine) semester = valueOf(semMatch[1] ?? semMatch[2]);
    if ((yearMatch || semMatch) && !dataLine) continue;
    if (
      /^(?:total|subtotal|page|academic year)\b/i.test(line) ||
      /^(?:bachelor|master|doctor)\b/i.test(line) ||
      /^in\s+[A-Z]/i.test(line) ||
      /^bs computer science\b/i.test(line) ||
      /^summer\b/i.test(line) ||
      /^\d{1,2}$/.test(line)
    )
      continue;
    if (
      /\bunits?\b/i.test(line) &&
      /\b(?:description|subject|title)\b/i.test(line) &&
      /\b(?:course|code)\b/i.test(line)
    ) {
      headers = cells.map(headerKey);
      continue;
    }
    const fromCells = cells.length > 1 && isCodeCell(cells[0]);
    let code = '';
    let name = '',
      units = '',
      prerequisites = '',
      corequisites = '';
    if (fromCells) {
      code = cells[0];
      if (headers.includes('name') && cells.length <= headers.length) {
        const unitsIndex = headers.indexOf('units');
        const unitsPresent = unitsIndex >= 0 && unitsIndex < cells.length;
        for (let i = 0; i < cells.length; i++) {
          const key = headers[i],
            value = cells[i];
          if (!key || !value) continue;
          if (key === 'name') {
            // A description and its units sometimes share one wide cell.
            const trailing = unitsPresent
              ? null
              : value.match(/^(.*?)\s+(\d+(?:\.\d+)?)\s*(?:units?)?$/i);
            if (trailing) {
              name = trailing[1].trim();
              units = trailing[2];
            } else name = value;
          } else if (key === 'units') units = value;
          else if (key === 'prerequisites') prerequisites = value;
          else if (key === 'corequisites') corequisites = value;
          else if (key === 'year') year = value;
          else if (key === 'semester') semester = value;
        }
      } else ({ name, units, prerequisites } = parseCells(cells.slice(1)));
    } else {
      const match = line.match(courseCode) ?? line.match(hyphenCourseCode);
      if (!match) {
        // A wrapped cell belongs to the previous subject: code fragments go
        // to the requisite column, words continue the description.
        const previous = rows.at(-1);
        if (!previous) continue;
        for (const part of cells.length > 1 ? cells : [line]) {
          if (
            /^(?:pre|co)?-?req(?:uisite)?s?\b/i.test(part) ||
            /^\d{1,4}[A-Z]?(?:\s*;|$)/i.test(part)
          )
            previous.prerequisites =
              `${previous.prerequisites} ${part}`.trim();
          else previous.name = `${previous.name} ${part}`.trim();
        }
        previous.evidence = `${previous.evidence} ${line}`.trim();
        continue;
      }
      code = match[1];
      ({ name, units, prerequisites } = parseRest(match[2]));
    }
    const row: DraftRow = {
      id: String(rows.length + 1),
      code: code.toUpperCase().replace(/\s+/g, ' '),
      name,
      units,
      prerequisites,
      corequisites,
      year,
      semester,
      evidence: line,
    };
    rows.push(row);
    if (rows.length > 300)
      throw new Error(
        'This prospectus exceeds 300 subjects. Split it into one curriculum.',
      );
  }
  for (const row of rows) {
    const required = splitRequirements(row.prerequisites, 'prerequisites');
    const concurrent = splitRequirements(row.corequisites, 'corequisites');
    row.prerequisites = [
      ...required.prerequisites,
      ...concurrent.prerequisites,
    ].join(';');
    row.corequisites = [
      ...required.corequisites,
      ...concurrent.corequisites,
    ].join(';');
  }
  return {
    name: filename.replace(/\.[^.]+$/, ''),
    filename,
    method,
    text,
    rows,
  };
}
export function confirmProspectus(draft: ProspectusDraft): Curriculum {
  return validateCurriculum({
    name: draft.name,
    source: 'imported',
    prospectus: { filename: draft.filename, method: draft.method },
    subjects: draft.rows.map((r) => ({
      code: r.code,
      name: r.name,
      units: r.units,
      year: r.year,
      semester: r.semester,
      prerequisites: r.prerequisites,
      corequisites: r.corequisites,
    })),
  });
}
export function validateProspectusFile(file: {
  name: string;
  size: number;
  type: string;
}) {
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (!['pdf', 'png', 'jpg', 'jpeg'].includes(extension ?? ''))
    throw new Error('Choose a PDF, PNG, or JPG file.');
  if (file.size === 0 || file.size > 20 * 1024 * 1024)
    throw new Error('Choose a file between 1 byte and 20 MB.');
  const expected =
    extension === 'pdf'
      ? 'application/pdf'
      : extension === 'png'
        ? 'image/png'
        : 'image/jpeg';
  if (file.type && file.type !== expected)
    throw new Error('The file type does not match its extension.');
  return expected;
}

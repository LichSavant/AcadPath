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
const emptyRequirement = (s: string) =>
  /^(?:none|n\/?a|nil|[-\u2013\u2014]+)$/i.test(s.trim())
    ? ''
    : s.trim().replace(/\s*(?:,|\+|&|\band\b)\s*/gi, ';');
const courseCode =
  /^([A-Z]{2,12}(?:\s*[.-]?\s*\d{1,4}[A-Z]*)(?:\s+[A-Z])?)\s+(.+)$/i;
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
    const yearMatch = line.match(
      /\b(first|second|third|fourth|fifth|sixth|seventh|eighth|[1-8](?:st|nd|rd|th)?)\s+year\b|\byear\s+([1-8])\b/i,
    );
    const semMatch = line.match(
      /\b(first|second|1st|2nd|[12])\s+sem(?:ester)?\b|\bsem(?:ester)?\s+([12])\b/i,
    );
    if (yearMatch && !courseCode.test(line)) {
      year = valueOf(yearMatch[1] ?? yearMatch[2]);
      semester = '';
    }
    if (semMatch && !courseCode.test(line))
      semester = valueOf(semMatch[1] ?? semMatch[2]);
    if ((yearMatch || semMatch) && !courseCode.test(line)) continue;
    const cells = line.split(/\t+|\s*\|\s*| {2,}/).map((c) => c.trim());
    if (
      /\b(code|course no\.?|subject no\.?)\b/i.test(line) &&
      /\b(subject|description|title)\b/i.test(line) &&
      /units?/i.test(line)
    ) {
      headers = cells.map((c) =>
        /pre.?req/i.test(c)
          ? 'prerequisites'
          : /co.?req/i.test(c)
            ? 'corequisites'
            : /code|course no|subject no/i.test(c)
              ? 'code'
              : /units?/i.test(c)
                ? 'units'
                : /semester|^sem$/i.test(c)
                  ? 'semester'
                  : /year/i.test(c)
                    ? 'year'
                    : /subject|description|title/i.test(c)
                      ? 'name'
                      : '',
      );
      continue;
    }
    if (/^(?:total|subtotal|page|academic year)\b/i.test(line)) continue;
    const match = line.match(courseCode);
    if (!match) continue;
    let row: DraftRow = {
      id: String(rows.length + 1),
      code: match[1].toUpperCase().replace(/\s+/g, ' '),
      name: '',
      units: '',
      prerequisites: '',
      corequisites: '',
      year,
      semester,
      evidence: line,
    };
    if (
      headers.includes('name') &&
      headers.length === cells.length &&
      cells.length > 2
    ) {
      for (let i = 0; i < headers.length; i++) {
        const key = headers[i] as keyof Omit<DraftRow, 'id' | 'evidence'>;
        if (key) row[key] = cells[i];
      }
    } else {
      const rest = match[2];
      const unit = rest.match(
        /^(.*?)\s+(\d+(?:\.\d+)?)\s*(?:units?|u\.)?(?:\s+(.*))?$/i,
      );
      if (unit) {
        row.name = unit[1].trim();
        // Multiple numeric columns (lecture/lab/total) are ambiguous without a header.
        if (!/^\d+(?:\.\d+)?(?:\s|$)/.test(unit[3] ?? '')) {
          row.units = unit[2];
          row.prerequisites = unit[3] ?? '';
        }
      } else row.name = rest.trim();
    }
    row = {
      ...row,
      code: row.code.toUpperCase(),
      prerequisites: emptyRequirement(row.prerequisites),
      corequisites: emptyRequirement(row.corequisites),
    };
    rows.push(row);
    if (rows.length > 300)
      throw new Error(
        'This prospectus exceeds 300 subjects. Split it into one curriculum.',
      );
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

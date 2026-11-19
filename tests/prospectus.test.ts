import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseProspectusText,
  confirmProspectus,
  layoutText,
  validateProspectusFile,
} from '../lib/prospectus.ts';
import { validateRecord } from '../lib/import.ts';
import { isSetupComplete } from '../lib/academic.ts';
const source =
  'FIRST YEAR\nFIRST SEMESTER\nCode\tSubject\tUnits\tPrerequisite\nTEST 101\tFoundation\t3\tNone\nTEST 102\tCommunication\t2\tNone\nSECOND SEMESTER\nTEST 201\tApplications\t4\tTEST 101 and TEST 102';
const draft = () =>
  parseProspectusText(source, 'Test curriculum.pdf', 'pdf-text');
void test('extracts only source rows with year, semester and multiple prerequisites', () => {
  const d = draft();
  assert.equal(d.rows.length, 3);
  const c = confirmProspectus(d);
  assert.deepEqual(c.subjects[2].prerequisites, ['TEST 101', 'TEST 102']);
  assert.equal(c.subjects[2].semester, 2);
  assert.equal(c.subjects[2].units, 4);
  assert.equal(c.prospectus?.filename, 'Test curriculum.pdf');
});
void test('unrecognized text creates no invented curriculum', () => {
  const d = parseProspectusText(
    'University heading\nPlease contact the registrar',
    'scan.jpg',
    'ocr',
  );
  assert.deepEqual(d.rows, []);
  assert.throws(() => confirmProspectus(d));
});
void test('missing year, semester or ambiguous units require correction', () => {
  const d = parseProspectusText('TEST 101 Foundation 3 1 4', 'scan.png', 'ocr');
  assert.equal(d.rows[0].units, '');
  assert.equal(d.rows[0].year, '');
  assert.throws(() => confirmProspectus(d));
  Object.assign(d.rows[0], { year: '1', semester: '1', units: '4' });
  assert.equal(confirmProspectus(d).subjects[0].units, 4);
});
void test('subject titles containing year headings remain subjects', () => {
  const d = parseProspectusText(
    'FIRST YEAR\nFIRST SEMESTER\nTEST 101 First Year Experience 3 None',
    'file.pdf',
    'pdf-text',
  );
  assert.equal(d.rows[0].name, 'First Year Experience');
});
void test('geometric text groups rows and preserves table columns', () => {
  assert.equal(
    layoutText([
      { text: 'TEST', x: 0, y: 10, width: 25, height: 10 },
      { text: '101', x: 30, y: 10, width: 20, height: 10 },
      { text: 'Foundation', x: 120, y: 11, width: 60, height: 10 },
      { text: 'Next', x: 0, y: 30, width: 20, height: 10 },
    ]),
    'TEST 101\tFoundation\nNext',
  );
});
void test('rejects duplicate rows, absent prerequisite references and cycles at confirmation', () => {
  const d = draft();
  d.rows.push({ ...d.rows[0], id: '4' });
  assert.throws(() => confirmProspectus(d), /unique/i);
  const missing = draft();
  missing.rows[0].prerequisites = 'TEST 999';
  assert.throws(() => confirmProspectus(missing));
  const cycle = draft();
  cycle.rows[0].prerequisites = 'TEST 201';
  assert.throws(() => confirmProspectus(cycle), /cycle/i);
});
void test('recognizes Year Level headings, hyphenated/word codes, and numeric titles', () => {
  const d = parseProspectusText(
    [
      'BACHELOR OF SCIENCE',
      'IN COMPUTER SCIENCE',
      'Effective Year: 2023 | Year Level 2',
      '1ST Semester',
      'Course\tCourse Description\tUnits\tRequisite',
      'GE-MMW\tMATHEMATICS IN THE MODERN WORLD\t3.0',
      'CS ELEC\tCS ELECTIVE [E4]\t3.0',
      'NSTP 1\tNATIONAL SERVICE TRAINING PROGRAM 1\t3.0',
      'TPE 1101\tPATH-FIT 1 - MOVEMENT ENHANCEMENT\t2.0',
      'CS 3201N\tCS THESIS 1\t3.0\tPREREQUISITE CIS 1101',
    ].join('\n'),
    'BSCS 2023.pdf',
    'pdf-text',
  );
  assert.deepEqual(
    d.rows.map((r) => [r.code, r.year, r.semester, r.units, r.name]),
    [
      ['GE-MMW', '2', '1', '3.0', 'MATHEMATICS IN THE MODERN WORLD'],
      ['CS ELEC', '2', '1', '3.0', 'CS ELECTIVE [E4]'],
      ['NSTP 1', '2', '1', '3.0', 'NATIONAL SERVICE TRAINING PROGRAM 1'],
      ['TPE 1101', '2', '1', '2.0', 'PATH-FIT 1 - MOVEMENT ENHANCEMENT'],
      ['CS 3201N', '2', '1', '3.0', 'CS THESIS 1'],
    ],
  );
  assert.equal(d.rows.at(-1)!.prerequisites, 'CIS 1101');
});
void test('merges wrapped description/requisite lines and drops standing rules', () => {
  const d = parseProspectusText(
    [
      'Year Level 1',
      '1ST Semester',
      'Course\tCourse Description\tUnits\tRequisite',
      'CIS 2202\tDIGITAL LOGIC DESIGN AND DIGITAL COMPUTER\t3.0\tPREREQUISITE CIS 1102N',
      'CIRCUITS',
      'CIS 2203N\tMOBILE DEVELOPMENT\t3.0\tPREREQUISITE CIS 1201; PREREQUISITE CIS',
      '1202',
      'CIS 2205\tDESIGN PROJECT\t3.0\t2ND YEAR STANDING',
    ].join('\n'),
    'BSCS 2023.pdf',
    'pdf-text',
  );
  assert.equal(d.rows.length, 3);
  assert.equal(
    d.rows[0].name,
    'DIGITAL LOGIC DESIGN AND DIGITAL COMPUTER CIRCUITS',
  );
  assert.equal(d.rows[1].prerequisites, 'CIS 1201;CIS 1202');
  assert.equal(d.rows[2].prerequisites, '');
});
void test('file constraints accept PDF PNG JPG JPEG and reject misleading files', () => {
  for (const [name, type] of [
    ['a.PDF', 'application/pdf'],
    ['a.png', 'image/png'],
    ['a.jpg', 'image/jpeg'],
    ['a.jpeg', ''],
  ])
    assert.doesNotThrow(() =>
      validateProspectusFile({ name, type, size: 100 }),
    );
  for (const f of [
    { name: 'a.csv', type: '', size: 10 },
    { name: 'a.pdf', type: 'image/png', size: 10 },
    { name: 'a.pdf', type: '', size: 0 },
    { name: 'a.jpg', type: '', size: 21 * 1024 * 1024 },
  ])
    assert.throws(() => validateProspectusFile(f));
});
void test('confirmed curriculum persists as incomplete until every status is reviewed', () => {
  const record = {
    curriculum: confirmProspectus(draft()),
    statuses: {},
    plan: [],
    settings: {
      startYear: 2027,
      startSemester: 1,
      maxUnits: 18,
      assumeCurrentPass: false,
    },
    setupComplete: false,
  };
  const confirmed = validateRecord(record);
  assert.equal(isSetupComplete(confirmed), false);
  assert.equal(isSetupComplete(null), false);
  assert.throws(
    () => validateRecord({ ...record, setupComplete: true }),
    /every subject/,
  );
  assert.throws(
    () => validateRecord({ ...record, statuses: { 'TEST 101': 'completed' } }),
    /Finish curriculum setup/,
  );
  const complete = validateRecord({
    ...record,
    setupComplete: true,
    statuses: {
      'TEST 101': 'completed',
      'TEST 102': 'current',
      'TEST 201': 'remaining',
    },
  });
  assert.equal(isSetupComplete(complete), true);
  assert.deepEqual(
    validateRecord(JSON.parse(JSON.stringify(complete))),
    complete,
  );
  const { setupComplete: _setupComplete, ...legacy } = complete;
  assert.equal(isSetupComplete(validateRecord(legacy)), true);
});

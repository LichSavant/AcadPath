'use client';
import { useState, useEffect, type ChangeEvent } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  ArrowRight,
  Save,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  importCurriculum,
  validateCurriculum,
  validateRecord,
} from '@/lib/import';
import { sampleCurriculum } from '@/lib/sample';
import {
  defaultSettings,
  matchesSubject,
  academicState,
  STATUSES,
  statusOf,
  completedCodes,
  eligibility,
  type Curriculum,
  type RecordData,
  type Subject,
  type Status,
} from '@/lib/academic';
import { Choice, Notice, Pill, statusLabels, filterOptions } from './shared';
export function UploadView({
  hasRecord,
  stage,
}: {
  hasRecord: boolean;
  stage: (c: Curriculum) => void;
}) {
  const [error, setError] = useState(''),
    [reading, setReading] = useState(false);
  async function read(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setReading(true);
    try {
      if (file.size > 1_000_000)
        throw new Error('Files must be smaller than 1 MB.');
      stage(importCurriculum(await file.text(), file.name));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not read the file.');
    } finally {
      setReading(false);
      event.target.value = '';
    }
  }
  return (
    <div className="stack">
      {hasRecord && (
        <Notice tone="warning">
          Importing creates a review draft. Saving that draft replaces your
          current curriculum, statuses, and semester plan. Your saved record
          stays unchanged until then.
        </Notice>
      )}
      <div className="upload-grid">
        <section className="panel upload-panel">
          <div className="upload-icon">
            <UploadCloud size={34} />
          </div>
          <h2>Bring your curriculum into focus</h2>
          <p>
            Upload a structured prospectus, then review subjects and mark your
            progress.
          </p>
          <label className="upload-zone">
            <FileSpreadsheet size={28} />
            <strong>
              {reading ? 'Reading curriculum…' : 'Choose a CSV or JSON file'}
            </strong>
            <span>Up to 1 MB · 300 subjects</span>
            <input
              aria-label="Upload curriculum file"
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={read}
              disabled={reading}
            />
          </label>
          {error && <Notice tone="warning">{error}</Notice>}
          <p className="muted">
            CSV and JSON are parsed and validated. PDF scans, photos, and Word
            documents are not parsed. Transcribe them using the template below.
          </p>
          <a className="text-link" href="/curriculum-template.csv" download>
            <Download size={17} />
            Download CSV template
          </a>
        </section>
        <aside className="stack">
          <section className="panel">
            <p className="eyebrow">JUST EXPLORING?</p>
            <h2>Try a sample roadmap</h2>
            <p className="muted">
              A fictional 4-year Computer Science curriculum (not an official
              USC prospectus) with 30 subjects, prerequisite chains, and a
              corequisite pair. All subjects begin as not taken.
            </p>
            <Button
              variant="outline"
              onClick={() => stage(structuredClone(sampleCurriculum))}
            >
              Review sample curriculum <ArrowRight />
            </Button>
          </section>
          <section className="panel">
            <h2>What to include</h2>
            <ul className="help-list">
              <li>Code, name, units, year, and semester</li>
              <li>
                Prerequisites and corequisites as codes separated by semicolons
              </li>
              <li>Optional offered semesters: 1, 2, or 1;2</li>
            </ul>
            <p className="muted">
              If offerings are omitted, a subject is offered only in its listed
              semester. Correct these assumptions during review.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
export function ReviewView({
  data,
  pending,
  save,
  busy,
  onDone,
  cancel,
}: {
  data: RecordData | null;
  pending: Curriculum | null;
  save: (d: RecordData) => Promise<boolean>;
  busy: boolean;
  onDone: () => void;
  cancel: () => void;
}) {
  const [curriculum, setCurriculum] = useState<Curriculum>(() =>
    structuredClone(pending ?? data!.curriculum),
  );
  const [statuses, setStatuses] = useState<Record<string, Status>>(() =>
    pending ? {} : { ...data!.statuses },
  );
  const [error, setError] = useState(''),
    [dirty, setDirty] = useState(!!pending),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all');
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);
  function update(code: string, key: keyof Subject, value: unknown) {
    setDirty(true);
    setCurriculum((c) => ({
      ...c,
      subjects: c.subjects.map((s) =>
        s.code === code ? { ...s, [key]: value } : s,
      ),
    }));
  }
  async function commit() {
    setError('');
    try {
      const valid = validateCurriculum(curriculum);
      const next: RecordData = {
        ...(data?.profile ? { profile: data.profile } : {}),
        curriculum: valid,
        statuses,
        plan: pending ? [] : data!.plan,
        settings: pending ? defaultSettings() : data!.settings,
      };
      if (await save(next)) {
        setDirty(false);
        onDone();
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Review the curriculum fields.',
      );
    }
  }
  const completed = completedCodes(statuses);
  const current = new Set(
    Object.entries(statuses)
      .filter(([, s]) => s === 'current')
      .map(([c]) => c),
  );
  const inconsistencies = curriculum.subjects.filter(
    (s) =>
      statuses[s.code] === 'current' &&
      !eligibility(s, completed, current).eligible,
  );
  const filtered = curriculum.subjects.filter((s) =>
    matchesSubject(s, statuses, search, filter),
  );
  return (
    <div className="stack">
      {pending && (
        <Notice>
          {pending.source === 'sample'
            ? 'SAMPLE DATA: fictional curriculum for exploration.'
            : 'Your file has been parsed successfully.'}{' '}
          Review {curriculum.subjects.length} subjects before saving.
        </Notice>
      )}
      {error && <Notice tone="warning">{error}</Notice>}
      <section className="panel review-controls">
        <div>
          <label htmlFor="curriculum-name">Curriculum name</label>
          <Input
            id="curriculum-name"
            value={curriculum.name}
            maxLength={180}
            onChange={(e) => {
              setDirty(true);
              setCurriculum((c) => ({ ...c, name: e.target.value }));
            }}
          />
        </div>
        <Input
          aria-label="Search review subjects"
          placeholder="Find a subject…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="row">
          <Button variant="outline" onClick={cancel} disabled={busy}>
            Cancel review
          </Button>
          <Button onClick={() => void commit()} disabled={busy}>
            <Save />
            {busy
              ? 'Saving…'
              : pending
                ? 'Save curriculum & statuses'
                : 'Save changes'}
          </Button>
        </div>
      </section>
      <section className="panel curriculum-context">
        <label htmlFor="program-name">
          Academic program
          <Input
            id="program-name"
            value={curriculum.program ?? ''}
            maxLength={120}
            onChange={(e) => {
              setDirty(true);
              setCurriculum((c) => ({ ...c, program: e.target.value }));
            }}
            placeholder="Program on your prospectus"
          />
        </label>
        <label htmlFor="curriculum-year">
          Curriculum year
          <Input
            id="curriculum-year"
            type="number"
            min="1950"
            max="2100"
            value={curriculum.curriculumYear ?? ''}
            onChange={(e) => {
              setDirty(true);
              setCurriculum((c) => ({
                ...c,
                curriculumYear:
                  e.target.value === '' ? undefined : Number(e.target.value),
              }));
            }}
            placeholder="Curriculum edition year"
          />
        </label>
      </section>
      <p className="muted">
        Edit names, units, sequence, and requirements directly. Separate
        requirement codes with semicolons. Changes remain a draft until saved.
      </p>
      {inconsistencies.length > 0 && (
        <Notice tone="warning">
          Current enrollment conflicts:{' '}
          {inconsistencies.map((s) => s.code).join(', ')} have unmet
          requirements. You may record your actual enrollment, but these
          subjects will not count as completed.
        </Notice>
      )}
      <div className="row">
        <Choice
          label="Filter academic record"
          value={filter}
          onChange={setFilter}
          options={filterOptions}
        />
        <span className="muted">
          {filtered.length} of {curriculum.subjects.length} subjects
        </span>
      </div>
      <section className="panel table-panel">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code / subject name</TableHead>
              <TableHead>Units</TableHead>
              <TableHead>Year / semester</TableHead>
              <TableHead>Prerequisites / corequisites</TableHead>
              <TableHead>Offered semesters</TableHead>
              <TableHead>Academic status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((s) => (
              <TableRow key={s.code}>
                <TableCell className="subject-edit">
                  <strong>{s.code}</strong>{' '}
                  <Pill status={academicState(s, statuses)} />
                  <Input
                    aria-label={s.code + ' name'}
                    value={s.name}
                    onChange={(e) => update(s.code, 'name', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    className="number-field"
                    type="number"
                    min="0"
                    max="30"
                    step=".5"
                    aria-label={s.code + ' units'}
                    value={s.units}
                    onChange={(e) => update(s.code, 'units', e.target.value)}
                  />
                </TableCell>
                <TableCell>
                  <div className="field-pair">
                    <Input
                      className="number-field"
                      type="number"
                      min="1"
                      max="8"
                      aria-label={s.code + ' year'}
                      value={s.year}
                      onChange={(e) => update(s.code, 'year', e.target.value)}
                    />
                    <Choice
                      label={s.code + ' semester'}
                      value={String(s.semester)}
                      onChange={(v) => update(s.code, 'semester', Number(v))}
                      options={[
                        { value: '1', label: 'Sem 1' },
                        { value: '2', label: 'Sem 2' },
                      ]}
                    />
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    aria-label={s.code + ' prerequisites'}
                    placeholder="Prerequisites"
                    value={s.prerequisites.join(';')}
                    onChange={(e) =>
                      update(s.code, 'prerequisites', e.target.value.split(';'))
                    }
                  />
                  <Input
                    aria-label={s.code + ' corequisites'}
                    placeholder="Corequisites"
                    value={s.corequisites.join(';')}
                    onChange={(e) =>
                      update(s.code, 'corequisites', e.target.value.split(';'))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Choice
                    label={s.code + ' offerings'}
                    value={s.offered.join(';')}
                    onChange={(v) =>
                      update(s.code, 'offered', v.split(';').map(Number))
                    }
                    options={[
                      { value: '1', label: 'Semester 1' },
                      { value: '2', label: 'Semester 2' },
                      { value: '1;2', label: 'Both semesters' },
                    ]}
                  />
                </TableCell>
                <TableCell>
                  <Choice
                    label={s.code + ' status'}
                    value={statusOf(statuses, s.code)}
                    onChange={(v) => {
                      setDirty(true);
                      setStatuses((old) => ({ ...old, [s.code]: v as Status }));
                    }}
                    options={STATUSES.map((v) => ({
                      value: v,
                      label: statusLabels[v],
                    }))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!filtered.length && (
          <p className="panel">No subjects match your search.</p>
        )}
      </section>
      <Notice>
        {Object.values(statuses).filter((s) => s === 'completed').length}{' '}
        completed ·{' '}
        {Object.values(statuses).filter((s) => s === 'current').length}{' '}
        currently taking · {dirty ? 'Unsaved review draft' : 'No changes yet'}
      </Notice>
    </div>
  );
}

export function ProfileSettings({
  data,
  name,
  save,
  busy,
}: {
  data: RecordData;
  name: string;
  save: (d: RecordData) => Promise<boolean>;
  busy: boolean;
}) {
  const [studentName, setStudentName] = useState(data.profile?.name ?? name),
    [program, setProgram] = useState(data.curriculum.program ?? ''),
    [year, setYear] = useState(
      data.curriculum.curriculumYear?.toString() ?? '',
    ),
    [error, setError] = useState('');
  async function commit() {
    setError('');
    try {
      const next = validateRecord({
        ...data,
        profile: { name: studentName },
        curriculum: {
          ...data.curriculum,
          program: program.trim() || undefined,
          curriculumYear: year === '' ? undefined : Number(year),
        },
      });
      await save(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Check your profile fields.');
    }
  }
  return (
    <section className="panel profile-settings">
      <h2>Student profile</h2>
      <p className="muted">
        Your preferred name and curriculum context appear throughout your
        academic workspace.
      </p>
      {error && <Notice tone="warning">{error}</Notice>}
      <label htmlFor="student-name">
        Student name
        <Input
          id="student-name"
          value={studentName}
          maxLength={100}
          onChange={(e) => setStudentName(e.target.value)}
        />
      </label>
      <label htmlFor="profile-program">
        Academic program
        <Input
          id="profile-program"
          value={program}
          maxLength={120}
          placeholder="Enter the program on your prospectus"
          onChange={(e) => setProgram(e.target.value)}
        />
      </label>
      <label htmlFor="profile-year">
        Curriculum year
        <Input
          id="profile-year"
          type="number"
          min="1950"
          max="2100"
          value={year}
          placeholder="Year of your curriculum edition"
          onChange={(e) => setYear(e.target.value)}
        />
      </label>
      <p className="muted">
        Program and curriculum year are entered from your own prospectus. They
        do not change subject requirements. Planning assumptions are available
        in Semester Planner.
      </p>
      <Button disabled={busy} onClick={() => void commit()}>
        <Save />
        {busy ? 'Saving…' : 'Save profile'}
      </Button>
    </section>
  );
}

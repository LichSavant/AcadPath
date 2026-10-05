'use client';
import { useState, useEffect, useRef, type ChangeEvent } from 'react';
import {
  Upload,
  FileText,
  X,
  Plus,
  Trash2,
  Save,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { validateRecord } from '@/lib/import';
import { extractProspectus } from '@/lib/extract-prospectus';
import {
  confirmProspectus,
  validateProspectusFile,
  type ProspectusDraft,
  type DraftRow,
} from '@/lib/prospectus';
import {
  defaultSettings,
  matchesSubject,
  STATUSES,
  statusOf,
  eligibility,
  completedCodes,
  type RecordData,
  type Status,
} from '@/lib/academic';
import { Choice, Notice, statusLabels, filterOptions } from './shared';

export function UploadView({
  hasRecord,
  stage,
}: {
  hasRecord: boolean;
  stage: (draft: ProspectusDraft, file: File) => void;
}) {
  const [file, setFile] = useState<File | null>(null),
    [error, setError] = useState(''),
    [reading, setReading] = useState(false),
    [status, setStatus] = useState(''),
    [progress, setProgress] = useState(0);
  const controller = useRef<AbortController | null>(null),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function remove() {
    controller.current?.abort();
    controller.current = null;
    setFile(null);
    setReading(false);
    setError('');
    setStatus('');
    setProgress(0);
    if (input.current) input.current.value = '';
  }
  function choose(e: ChangeEvent<HTMLInputElement>) {
    const next = e.target.files?.[0];
    remove();
    if (!next) return;
    try {
      validateProspectusFile(next);
      setFile(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Choose a PDF or image.');
    }
  }
  async function read() {
    if (!file) return;
    const job = new AbortController();
    controller.current = job;
    setReading(true);
    setError('');
    try {
      const draft = await extractProspectus(
        file,
        (message, value) => {
          setStatus(message);
          setProgress(value);
        },
        job.signal,
      );
      if (!job.signal.aborted) stage(draft, file);
    } catch (err) {
      if (!job.signal.aborted)
        setError(
          err instanceof Error ? err.message : 'Could not read the file.',
        );
    } finally {
      if (controller.current === job) setReading(false);
    }
  }
  return (
    <section className="panel upload-panel">
      <h2>Upload Prospectus</h2>
      <p className="muted">Upload your USC curriculum to get started.</p>
      {hasRecord && (
        <Notice tone="warning">
          Your current record stays unchanged until you confirm a replacement.
        </Notice>
      )}
      <input
        ref={input}
        className="sr-only"
        id="prospectus-file"
        aria-label="Choose prospectus file"
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
        onChange={choose}
      />
      {!file ? (
        <div className="upload-zone">
          <FileText size={24} />
          <Button variant="outline" onClick={() => input.current?.click()}>
            Choose File
          </Button>
          <span>PDF or image &middot; up to 20 MB</span>
        </div>
      ) : (
        <div className="file-selection">
          <FileText size={22} />
          <div>
            <strong>{file.name}</strong>
            <small>{(file.size / 1024 / 1024).toFixed(2)} MB</small>
          </div>
          <Button variant="outline" onClick={() => input.current?.click()}>
            Replace
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Remove prospectus"
            onClick={remove}
          >
            <X />
          </Button>
        </div>
      )}
      {reading && (
        <output className="extraction-progress">
          <p>{status}</p>
          <Progress
            value={progress}
            aria-label="Prospectus extraction progress"
          />
          <Button variant="ghost" onClick={remove}>
            Cancel
          </Button>
        </output>
      )}
      {error && <Notice tone="warning">{error}</Notice>}
      {file && !reading && (
        <Button onClick={() => void read()}>
          <Upload size={16} />
          Read Prospectus
        </Button>
      )}
      <p className="muted">
        Read locally in your browser. Review before saving.
      </p>
    </section>
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
  pending: (ProspectusDraft & { url: string }) | null;
  save: (d: RecordData) => Promise<boolean>;
  busy: boolean;
  onDone: (confirmed: boolean) => void;
  cancel: () => void;
}) {
  const [draft, setDraft] = useState<ProspectusDraft | null>(() =>
    pending ? structuredClone({ ...pending, url: undefined }) : null,
  );
  const [statuses, setStatuses] = useState<Record<string, Status>>(() => ({
      ...data?.statuses,
    })),
    [error, setError] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [reviewed, setReviewed] = useState(false),
    [replaceOpen, setReplaceOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function update(id: string, key: keyof DraftRow, value: string) {
    setDirty(true);
    setReviewed(false);
    setDraft((old) =>
      old
        ? {
            ...old,
            rows: old.rows.map((r) =>
              r.id === id ? { ...r, [key]: value } : r,
            ),
          }
        : old,
    );
  }
  async function confirm() {
    if (!draft) return;
    setError('');
    try {
      const curriculum = confirmProspectus(draft);
      if (
        await save({
          ...(data?.profile ? { profile: data.profile } : {}),
          curriculum,
          statuses: {},
          plan: [],
          settings: defaultSettings(),
          setupComplete: false,
        })
      ) {
        setDirty(false);
        onDone(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Review the highlighted fields.',
      );
    } finally {
      setReplaceOpen(false);
    }
  }
  async function mark() {
    if (!data) return;
    setError('');
    try {
      const completeStatuses = Object.fromEntries(
        data.curriculum.subjects.map((s) => [
          s.code,
          statusOf(statuses, s.code),
        ]),
      );
      if (
        await save(
          validateRecord({
            ...data,
            statuses: completeStatuses,
            setupComplete: true,
          }),
        )
      ) {
        setDirty(false);
        onDone(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save statuses.');
    }
  }
  if (draft && pending)
    return (
      <div className="stack">
        <div className="action-bar">
          <div>
            <h2>Review Curriculum</h2>
            <p className="muted">Check every row against your prospectus.</p>
          </div>
          <div className="row">
            <a
              className="text-link"
              href={pending.url}
              target="_blank"
              rel="noreferrer"
            >
              Open prospectus
            </a>
            <Button variant="outline" onClick={cancel} disabled={busy}>
              Cancel
            </Button>
          </div>
        </div>
        {error && <Notice tone="warning">{error}</Notice>}
        {!draft.rows.length && (
          <Notice tone="warning">
            No subject rows were recognized. Add rows from the prospectus or
            upload a clearer copy.
          </Notice>
        )}
        <div className="panel review-controls">
          <label htmlFor="curriculum-name">
            Curriculum name
            <Input
              id="curriculum-name"
              value={draft.name}
              maxLength={180}
              onChange={(e) => {
                setDirty(true);
                setDraft({ ...draft, name: e.target.value });
              }}
            />
          </label>
          <span className="muted">
            {draft.rows.length} rows &middot; {draft.filename}
          </span>
        </div>
        <section className="panel table-panel extraction-table">
          <Table>
            <TableHeader>
              <TableRow>
                {[
                  'Code',
                  'Subject',
                  'Units',
                  'Prerequisite',
                  'Year',
                  'Semester',
                  '',
                ].map((h, i) => (
                  <TableHead key={i}>{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft.rows.map((r, index) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Input
                      aria-label={'Row ' + (index + 1) + ' code'}
                      value={r.code}
                      onChange={(e) => update(r.id, 'code', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={'Row ' + (index + 1) + ' subject'}
                      value={r.name}
                      onChange={(e) => update(r.id, 'name', e.target.value)}
                    />
                    <details className="row-evidence">
                      <summary>Source / corequisite</summary>
                      <p>{r.evidence || 'Manually entered from prospectus'}</p>
                      <label htmlFor={'coreq-' + r.id}>
                        Corequisite
                        <Input
                          id={'coreq-' + r.id}
                          value={r.corequisites}
                          onChange={(e) =>
                            update(r.id, 'corequisites', e.target.value)
                          }
                          aria-label={'Row ' + (index + 1) + ' corequisite'}
                        />
                      </label>
                    </details>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="0"
                      max="30"
                      step=".5"
                      aria-label={'Row ' + (index + 1) + ' units'}
                      value={r.units}
                      onChange={(e) => update(r.id, 'units', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      aria-label={'Row ' + (index + 1) + ' prerequisite'}
                      value={r.prerequisites}
                      placeholder="None"
                      onChange={(e) =>
                        update(r.id, 'prerequisites', e.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      max="8"
                      aria-label={'Row ' + (index + 1) + ' year'}
                      value={r.year}
                      onChange={(e) => update(r.id, 'year', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <Choice
                      label={'Row ' + (index + 1) + ' semester'}
                      value={r.semester}
                      onChange={(v) => update(r.id, 'semester', v)}
                      options={[
                        { value: '', label: 'Select' },
                        { value: '1', label: '1st' },
                        { value: '2', label: '2nd' },
                      ]}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={'Remove row ' + (index + 1)}
                      onClick={() => {
                        setDirty(true);
                        setReviewed(false);
                        setDraft({
                          ...draft,
                          rows: draft.rows.filter((row) => row.id !== r.id),
                        });
                      }}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
        <div className="action-bar">
          <Button
            variant="outline"
            disabled={draft.rows.length >= 300}
            onClick={() => {
              setDirty(true);
              setReviewed(false);
              setDraft({
                ...draft,
                rows: [
                  ...draft.rows,
                  {
                    id: crypto.randomUUID(),
                    code: '',
                    name: '',
                    units: '',
                    prerequisites: '',
                    corequisites: '',
                    year: '',
                    semester: '',
                    evidence: '',
                  },
                ],
              });
            }}
          >
            <Plus />
            Add Row
          </Button>
          <p className="muted">
            Separate prerequisites with semicolons. Offerings follow the listed
            semester.
          </p>
        </div>
        <details className="panel extracted-text">
          <summary>Extracted text</summary>
          <pre>{draft.text || 'No readable text found.'}</pre>
        </details>
        <div className="panel confirmation-bar">
          <label className="checkbox-label" htmlFor="review-checked">
            <Checkbox
              id="review-checked"
              checked={reviewed}
              onCheckedChange={(v) => setReviewed(!!v)}
            />
            I checked all subjects and requirements against my prospectus.
          </label>
          <Button
            disabled={busy || !reviewed || !draft.rows.length}
            onClick={() => (data ? setReplaceOpen(true) : void confirm())}
          >
            {busy ? 'Saving...' : 'Confirm Curriculum'}
            <ArrowRight />
          </Button>
        </div>
        <AlertDialog open={replaceOpen} onOpenChange={setReplaceOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Replace curriculum?</AlertDialogTitle>
              <AlertDialogDescription>
                This replaces your saved curriculum, subject statuses, and
                semester plan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction disabled={busy} onClick={() => void confirm()}>
                Confirm replacement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  if (!data) return null;
  const shown = data.curriculum.subjects.filter((s) =>
    matchesSubject(s, statuses, search, filter),
  );
  const concurrent = new Set(
    Object.keys(statuses).filter((c) => statuses[c] === 'current'),
  );
  const conflicts = data.curriculum.subjects.filter(
    (s) =>
      statuses[s.code] === 'current' &&
      !eligibility(s, completedCodes(statuses), concurrent).eligible,
  );
  return (
    <div className="stack">
      <div className="action-bar">
        <div>
          <h2>Mark Subject Status</h2>
          <p className="muted">
            Update each subject, then save your academic record.
          </p>
        </div>
        <Button onClick={() => void mark()} disabled={busy}>
          <Save />
          {busy
            ? 'Saving...'
            : data.setupComplete === false
              ? 'Save & Open Dashboard'
              : 'Save Statuses'}
        </Button>
      </div>
      {error && <Notice tone="warning">{error}</Notice>}
      {conflicts.length > 0 && (
        <Notice tone="warning">
          Unmet requirements for current subjects:{' '}
          {conflicts.map((s) => s.code).join(', ')}.
        </Notice>
      )}
      <div className="record-toolbar">
        <Input
          aria-label="Search review subjects"
          placeholder="Search code or subject"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Choice
          label="Filter academic record"
          value={filter}
          onChange={setFilter}
          options={
            data.setupComplete === false
              ? filterOptions.filter(
                  (o) => !['eligible', 'blocked'].includes(o.value),
                )
              : filterOptions
          }
        />
        <span className="muted">{shown.length} subjects</span>
      </div>
      <section className="panel table-panel status-table">
        <Table>
          <TableHeader>
            <TableRow>
              {[
                'Code',
                'Subject',
                'Units',
                'Prerequisite',
                'Year / Semester',
                'Status',
              ].map((h) => (
                <TableHead key={h}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((s) => (
              <TableRow key={s.code}>
                <TableCell>
                  <strong>{s.code}</strong>
                </TableCell>
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.units}</TableCell>
                <TableCell>
                  {s.prerequisites.join(', ') || 'None'}
                  {s.corequisites.length > 0 && (
                    <small className="muted">
                      Co: {s.corequisites.join(', ')}
                    </small>
                  )}
                </TableCell>
                <TableCell>
                  {s.year} / {s.semester}
                </TableCell>
                <TableCell>
                  <Choice
                    label={s.code + ' status'}
                    value={statusOf(statuses, s.code)}
                    onChange={(v) => {
                      setDirty(true);
                      setStatuses((old) => ({ ...old, [s.code]: v as Status }));
                    }}
                    options={STATUSES.map((value) => ({
                      value,
                      label: statusLabels[value],
                    }))}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!shown.length && <p className="table-empty">No matching subjects.</p>}
      </section>
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
      <p className="muted">Your name and academic program.</p>
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
      <p className="muted">Planning assumptions are in Semester Planner.</p>
      <Button disabled={busy} onClick={() => void commit()}>
        <Save />
        {busy ? 'Saving…' : 'Save profile'}
      </Button>
    </section>
  );
}

'use client';
/* eslint-disable next/no-html-link-for-pages -- Sites sign-out must be a top-level navigation. */
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  Upload,
  ListChecks,
  GitBranch,
  CalendarDays,
  FlaskConical,
  LogOut,
  ArrowUpRight,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  type RecordData,
  type Curriculum,
  type Subject,
  academicState,
  eligibility,
  completedCodes,
  descendants,
  prerequisiteChain,
  summary,
} from '@/lib/academic';
import { Dashboard, CurriculumMap } from './overview';
import { UploadView, ReviewView } from './import-review';
import { Planner, Simulator } from './planning';
import { Pill, Notice, Blank } from './shared';

const pages = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['upload', 'Upload prospectus', Upload],
  ['review', 'Review & mark', ListChecks],
  ['map', 'Curriculum map', GitBranch],
  ['planner', 'Semester planner', CalendarDays],
  ['simulator', 'What-if simulator', FlaskConical],
] as const;
type Page = (typeof pages)[number][0];
export default function AcadPath({
  name,
  local,
}: {
  name: string;
  local: boolean;
}) {
  const [data, setData] = useState<RecordData | null>(null),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [page, setPage] = useState<Page>('upload'),
    [pending, setPending] = useState<Curriculum | null>(null),
    [selected, setSelected] = useState<Subject | null>(null);
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/record', { signal });
      const result = (await res.json()) as {
        data: RecordData | null;
        revision: number;
        error?: string;
      };
      if (!res.ok) throw new Error(result.error);
      setError('');
      setData(result.data);
      setRevision(result.revision);
      const hash = location.hash.slice(1);
      setPage(
        pages.some((p) => p[0] === hash)
          ? (hash as Page)
          : result.data
            ? 'dashboard'
            : 'upload',
      );
    } catch (e) {
      if (!signal?.aborted)
        setError(e instanceof Error ? e.message : 'Could not load record.');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);
  // eslint-disable-next-line react/react-compiler -- Synchronize the record from the remote API; state updates follow the awaited response.
  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react/react-compiler -- Fetch external state; completion updates the UI.
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  const navigate = (next: Page) => {
    setPage(next);
    setMessage('');
    history.replaceState(null, '', '#' + next);
  };
  async function save(next: RecordData) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/record', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: next, revision }),
      });
      const result = (await response.json()) as {
        data: RecordData;
        revision: number;
        error?: string;
      };
      if (!response.ok) throw new Error(result.error);
      setError('');
      setData(result.data);
      setRevision(result.revision);
      setPending(null);
      setMessage('Your academic record has been saved.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  const stage = (c: Curriculum) => {
    setPending(c);
    navigate('review');
  };
  const stats = useMemo(() => (data ? summary(data) : null), [data]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: { signal: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'read_academic_progress',
          description:
            'Read saved academic progress and prerequisite eligibility. Does not change records.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input: unknown) => {
            if (
              !input ||
              typeof input !== 'object' ||
              Array.isArray(input) ||
              Object.keys(input).length
            )
              throw new Error('Expected an empty object.');
            return data
              ? {
                  curriculum: data.curriculum.name,
                  source: data.curriculum.source,
                  ...summary(data),
                }
              : { curriculum: null };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [data]);
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="nav-brand">
          <div className="brand">
            <GraduationCap />
            AcadPath<span>YOUR ACADEMIC ROADMAP</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="nav-content">
          <p className="nav-label">WORKSPACE</p>
          <SidebarMenu>
            {pages.map(([id, label, Icon]) => (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton
                  isActive={page === id}
                  onClick={() => navigate(id)}
                  disabled={busy}
                  className="nav-button"
                >
                  <Icon />
                  <span>{label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <div className="nav-note">
            <GitBranch size={24} />
            <strong>Every subject connects.</strong>
            <p>Understand what unlocks your next step.</p>
          </div>
        </SidebarContent>
        <SidebarFooter className="nav-footer">
          <div className="row">
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{name}</strong>
              <small>
                {local ? 'Local development profile' : 'Student workspace'}
              </small>
            </div>
          </div>
          <a href="/signout-with-chatgpt?return_to=/" target="_top">
            <LogOut size={16} />
            Sign out
          </a>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <div className="row">
            <SidebarTrigger />
            <span>Academic workspace</span>
            <span className="muted">/</span>
            <strong>{pages.find((p) => p[0] === page)?.[1]}</strong>
          </div>
          <span className="save-state">
            {busy ? 'Saving…' : data ? 'Saved record' : 'Get started'}
          </span>
        </header>
        <div className="page-content">
          <div className="page-title">
            <div>
              <p className="eyebrow">
                {page === 'dashboard'
                  ? 'YOUR PROGRESS, AT A GLANCE'
                  : 'BUILD YOUR ACADEMIC PATH'}
              </p>
              <h1>{pages.find((p) => p[0] === page)?.[1]}</h1>
              <p className="muted">
                {data?.curriculum.name ??
                  'Start with your curriculum. Plan with confidence.'}
              </p>
            </div>
            {data && (
              <span className={'source-badge ' + data.curriculum.source}>
                {data.curriculum.source === 'sample'
                  ? 'SAMPLE DATA'
                  : 'IMPORTED CURRICULUM'}
              </span>
            )}
          </div>
          {error && (
            <Notice tone="warning">
              {error}
              {!data && (
                <Button variant="outline" onClick={() => void load()}>
                  Retry loading
                </Button>
              )}
            </Notice>
          )}
          {message && <Notice tone="success">{message}</Notice>}
          {loading ? (
            <div className="stats-grid">
              {[1, 2, 3, 4].map((n) => (
                <Skeleton key={n} className="h-32" />
              ))}
            </div>
          ) : error && !data ? (
            <Blank title="Your workspace is unavailable">
              Retry loading before importing or editing records.
            </Blank>
          ) : (
            <>
              {page === 'upload' && (
                <UploadView hasRecord={!!data} stage={stage} />
              )}
              {page === 'review' && (pending || data) ? (
                <ReviewView
                  key={pending?.name ?? revision}
                  data={data}
                  pending={pending}
                  save={save}
                  busy={busy}
                  onDone={() => navigate('dashboard')}
                  cancel={() => {
                    setPending(null);
                    navigate(data ? 'dashboard' : 'upload');
                  }}
                />
              ) : page === 'review' ? (
                <Blank title="No curriculum to review">
                  Import a curriculum first.
                </Blank>
              ) : null}
              {data && page === 'dashboard' && (
                <Dashboard
                  data={data}
                  stats={stats!}
                  select={setSelected}
                  navigate={navigate}
                />
              )}
              {data && page === 'map' && (
                <CurriculumMap data={data} select={setSelected} />
              )}
              {data && page === 'planner' && (
                <Planner key={revision} data={data} save={save} busy={busy} />
              )}
              {data && page === 'simulator' && <Simulator data={data} />}
              {!data && !['upload', 'review'].includes(page) && (
                <Blank title="Your roadmap starts here">
                  <p>
                    Import your prospectus or explore the labeled sample
                    curriculum.
                  </p>
                  <Button onClick={() => navigate('upload')}>
                    Upload prospectus <ArrowUpRight />
                  </Button>
                </Blank>
              )}
            </>
          )}
          <footer className="page-footer">
            AcadPath{' '}
            <span>
              Plan thoughtfully. Confirm your final enrollment with your
              adviser.
            </span>
          </footer>
        </div>
      </main>
      <Sheet
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="subject-sheet">
          {selected && data && (
            <>
              <SheetHeader>
                <p className="eyebrow">
                  {selected.code} · {selected.units} UNITS
                </p>
                <SheetTitle>{selected.name}</SheetTitle>
                <SheetDescription>
                  Year {selected.year} · Semester {selected.semester}
                </SheetDescription>
              </SheetHeader>
              <div className="sheet-body">
                <Pill status={academicState(selected, data.statuses)} />
                <h3>Eligibility right now</h3>
                <p>
                  {academicState(selected, data.statuses) === 'completed'
                    ? 'This subject is completed.'
                    : academicState(selected, data.statuses) === 'current'
                      ? 'You are currently taking this subject. It unlocks dependents only after passing.'
                      : eligibility(selected, completedCodes(data.statuses))
                            .eligible
                        ? 'All requirements are satisfied. Check term offerings before enrolling.'
                        : 'Complete the prerequisites below. Corequisites may be taken in the same term.'}
                </p>
                <h3>Direct prerequisites</h3>
                <RequirementList codes={selected.prerequisites} data={data} />
                <h3>Corequisites</h3>
                <RequirementList codes={selected.corequisites} data={data} />
                <h3>Full prerequisite chain</h3>
                <p>
                  {prerequisiteChain(
                    data.curriculum.subjects,
                    selected.code,
                  ).join(', ') || 'No earlier requirements.'}
                </p>
                <h3>Directly unlocks</h3>
                <p>
                  {data.curriculum.subjects
                    .filter((s) => s.prerequisites.includes(selected.code))
                    .map((s) => s.code)
                    .join(', ') || 'No direct dependents.'}
                </p>
                <h3>Downstream subjects</h3>
                <p>
                  {descendants(data.curriculum.subjects, selected.code).join(
                    ', ',
                  ) || 'None'}
                </p>
                <h3>Offered in</h3>
                <p>
                  {selected.offered.map((s) => 'Semester ' + s).join(' and ')}
                </p>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
function RequirementList({
  codes,
  data,
}: {
  codes: string[];
  data: RecordData;
}) {
  return codes.length ? (
    <ul className="requirements">
      {codes.map((c) => (
        <li key={c}>
          <strong>{c}</strong>
          <Pill status={data.statuses[c] ?? 'remaining'} />
        </li>
      ))}
    </ul>
  ) : (
    <p className="muted">None required.</p>
  );
}

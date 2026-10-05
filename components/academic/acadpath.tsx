'use client';
/* eslint-disable next/no-html-link-for-pages -- Sites sign-out must be a top-level navigation. */
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  GraduationCap,
  LayoutDashboard,
  ListChecks,
  GitBranch,
  CalendarDays,
  FlaskConical,
  LogOut,
  Settings,
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
  useSidebar,
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
  type Subject,
  academicState,
  eligibility,
  completedCodes,
  summary,
  isSetupComplete,
} from '@/lib/academic';
import type { ProspectusDraft } from '@/lib/prospectus';
import { Dashboard, CurriculumMap } from './overview';
import { UploadView, ReviewView, ProfileSettings } from './import-review';
import { Planner, Simulator } from './planning';
import { Pill, Notice, Blank } from './shared';

const pages = [
  ['dashboard', 'Dashboard', LayoutDashboard],
  ['review', 'Curriculum', ListChecks],
  ['map', 'Curriculum Map', GitBranch],
  ['planner', 'Semester Planner', CalendarDays],
  ['simulator', 'What-If Simulator', FlaskConical],
  ['settings', 'Settings', Settings],
] as const;
type Page = (typeof pages)[number][0] | 'upload';
export default function AcadPath(props: { name: string; local: boolean }) {
  return (
    <SidebarProvider
      style={{ '--sidebar-width': '15rem' } as React.CSSProperties}
    >
      <AcademicWorkspace {...props} />
    </SidebarProvider>
  );
}
function AcademicWorkspace({ name, local }: { name: string; local: boolean }) {
  const { setOpenMobile } = useSidebar();
  const [data, setData] = useState<RecordData | null>(null),
    [revision, setRevision] = useState(0),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const [page, setPage] = useState<Page>('dashboard'),
    [pending, setPending] = useState<
      (ProspectusDraft & { url: string }) | null
    >(null),
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
        result.data?.setupComplete === false
          ? 'review'
          : !result.data
            ? 'dashboard'
            : hash === 'upload' || pages.some((p) => p[0] === hash)
              ? (hash as Page)
              : 'dashboard',
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
    setOpenMobile(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
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
  const stage = (draft: ProspectusDraft, file: File) => {
    setPending({ ...draft, url: URL.createObjectURL(file) });
    navigate('review');
  };
  useEffect(
    () => () => {
      if (pending) URL.revokeObjectURL(pending.url);
    },
    [pending],
  );
  const ready = isSetupComplete(data);
  const stats = useMemo(
    () => (data && isSetupComplete(data) ? summary(data) : null),
    [data],
  );
  const studentName = data?.profile?.name ?? name;
  const pageLabel =
    page === 'upload'
      ? 'Upload Prospectus'
      : pages.find((p) => p[0] === page)?.[1];
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
            return data && isSetupComplete(data)
              ? {
                  curriculum: data.curriculum.name,
                  source: data.curriculum.source,
                  ...summary(data),
                }
              : {
                  curriculum: data?.curriculum.name ?? null,
                  setupRequired: true,
                };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [data]);
  return (
    <>
      <Sidebar collapsible="none" className="desktop-sidebar">
        <SidebarHeader className="nav-brand">
          <div className="brand">
            <GraduationCap />
            AcadPath<span>University of San Carlos</span>
          </div>
        </SidebarHeader>
        <SidebarContent className="nav-content">
          <p className="nav-label">WORKSPACE</p>
          <SidebarMenu>
            {pages
              .filter((p) => p[0] !== 'settings')
              .map(([id, label, Icon]) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={
                      page === id || (id === 'review' && page === 'upload')
                    }
                    onClick={() => navigate(id)}
                    disabled={
                      busy ||
                      (!ready && !['dashboard', 'review'].includes(id)) ||
                      (!data && id === 'review')
                    }
                    className="nav-button"
                  >
                    <Icon />
                    <span>{label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="nav-footer">
          <SidebarMenuButton
            className="nav-button"
            isActive={page === 'settings'}
            onClick={() => navigate('settings')}
            disabled={busy || !data}
          >
            <Settings />
            <span>Settings</span>
          </SidebarMenuButton>
          <div className="row profile-summary">
            <span className="avatar">
              {studentName.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong>{studentName}</strong>
              <small>
                {local ? 'Local development profile' : 'Student workspace'}
              </small>
            </div>
          </div>
          <a href="/signout-with-chatgpt?return_to=/" target="_top">
            <LogOut size={16} />
            Logout
          </a>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace">
        <header className="topbar">
          <div className="row">
            <strong>{pageLabel}</strong>
          </div>
          <span className="topbar-context">
            {data?.curriculum.program ?? 'USC Cebu · Student workspace'}
            {data?.curriculum.curriculumYear
              ? ` · Curriculum ${data.curriculum.curriculumYear}`
              : ''}
          </span>
          <span className="save-state">
            {busy ? 'Saving...' : ready ? 'Saved record' : 'Curriculum setup'}
          </span>
        </header>
        <div className="page-content">
          <div className="page-title">
            <div>
              <h1>
                {page === 'dashboard'
                  ? ready
                    ? `Good day, ${studentName}`
                    : 'Welcome to AcadPath'
                  : pageLabel}
              </h1>
              {page === 'dashboard' && (
                <p className="muted">
                  {ready
                    ? 'Your academic pathway.'
                    : 'Plan your USC academic journey.'}
                </p>
              )}
            </div>
            {ready && data && (
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
              {page === 'review' && data && !pending && (
                <div className="curriculum-actions">
                  <span className="muted">{data.curriculum.name}</span>
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => navigate('upload')}
                  >
                    Replace Prospectus
                  </Button>
                </div>
              )}
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
                  onDone={(confirmed) => {
                    navigate(confirmed ? 'review' : 'dashboard');
                    setMessage(
                      confirmed
                        ? 'Curriculum confirmed. Mark your subjects next.'
                        : 'Academic record saved.',
                    );
                  }}
                  cancel={() => {
                    setPending(null);
                    navigate(data ? 'dashboard' : 'upload');
                  }}
                />
              ) : page === 'review' ? (
                <Blank title="No curriculum to review">
                  Upload your prospectus to get started.
                </Blank>
              ) : null}
              {ready && data && page === 'dashboard' && (
                <Dashboard
                  data={data}
                  stats={stats!}
                  select={setSelected}
                  navigate={navigate}
                />
              )}
              {ready && data && page === 'map' && (
                <CurriculumMap data={data} select={setSelected} />
              )}
              {ready && data && page === 'planner' && (
                <Planner key={revision} data={data} save={save} busy={busy} />
              )}
              {ready && data && page === 'simulator' && (
                <Simulator data={data} />
              )}
              {data && page === 'settings' && (
                <ProfileSettings
                  key={revision}
                  data={data}
                  name={name}
                  save={save}
                  busy={busy}
                />
              )}
              {!ready && !['upload', 'review', 'settings'].includes(page) && (
                <section className="panel setup-card">
                  <h2>
                    {data ? 'Mark your subjects' : 'Set up your curriculum'}
                  </h2>
                  <p className="muted">
                    {data
                      ? 'Save your subject statuses to open your pathway.'
                      : 'Upload your USC prospectus to get started.'}
                  </p>
                  <Button onClick={() => navigate(data ? 'review' : 'upload')}>
                    {data ? 'Mark Subject Status' : 'Upload Prospectus'}
                  </Button>
                  {!data && <small className="muted">PDF or image</small>}
                </section>
              )}
            </>
          )}
          <footer className="page-footer">
            AcadPath <span>Confirm enrollment with your adviser.</span>
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
                      ? 'Currently taking. Pass to unlock dependent subjects.'
                      : eligibility(selected, completedCodes(data.statuses))
                            .eligible
                        ? 'Requirements satisfied. Check semester offerings.'
                        : 'Missing requirements below. Corequisites can be taken together.'}
                </p>
                <h3>Direct prerequisites</h3>
                <RequirementList codes={selected.prerequisites} data={data} />
                <h3>Corequisites</h3>
                <RequirementList codes={selected.corequisites} data={data} />
                <h3>Unlocks</h3>
                <p>
                  {data.curriculum.subjects
                    .filter((s) => s.prerequisites.includes(selected.code))
                    .map((s) => s.code)
                    .join(', ') || 'No direct dependents.'}
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
    </>
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

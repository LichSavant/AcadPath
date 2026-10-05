'use client';
import type { ReactNode } from 'react';
import { ArrowRight, BookOpen, Check, Circle } from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import {
  academicState,
  statusOf,
  type Subject,
  type RecordData,
} from '@/lib/academic';
export const statusLabels: Record<string, string> = {
  completed: 'Completed',
  current: 'Currently taking',
  remaining: 'Remaining',
  failed: 'Failed',
  eligible: 'Can take next',
  blocked: 'Blocked',
};
export const filterOptions = [
  'all',
  'completed',
  'current',
  'eligible',
  'blocked',
  'remaining',
].map((value) => ({
  value,
  label: value === 'all' ? 'All subjects' : statusLabels[value],
}));
export function Choice({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (s: string) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v !== null) onChange(String(v));
      }}
      items={options}
    >
      <SelectTrigger aria-label={label} className="choice">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function Pill({ status }: { status: string }) {
  return (
    <span className={'pill ' + status}>{statusLabels[status] ?? status}</span>
  );
}
export function Blank({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Empty className="empty-state">
      <EmptyHeader>
        <BookOpen className="empty-icon" aria-hidden="true" />
        <EmptyTitle>{title}</EmptyTitle>
        {children && <EmptyDescription>{children}</EmptyDescription>}
      </EmptyHeader>
      {action}
    </Empty>
  );
}
export function CourseCode({ code }: { code: string }) {
  return <strong className="course-code">{code}</strong>;
}
export function ComparisonMetric({
  value,
  label,
  baseline,
}: {
  value: number;
  label: string;
  baseline?: number;
}) {
  const delta = baseline === undefined ? 0 : value - baseline;
  return (
    <span>
      <strong className={delta ? 'changed-value' : undefined}>
        {value}
        {delta !== 0 && (
          <small
            aria-label={`${Math.abs(delta)} ${delta > 0 ? 'more' : 'fewer'} than current path`}
          >
            {delta > 0 ? '+' : ''}
            {delta}
          </small>
        )}
      </strong>
      {label}
    </span>
  );
}
export function CourseRow({
  subject,
  onSelect,
  detail,
}: {
  subject: Subject;
  onSelect: (s: Subject) => void;
  detail?: string;
}) {
  return (
    <button className="list-row course-row" onClick={() => onSelect(subject)}>
      <CourseCode code={subject.code} />
      <span className="course-row-title">
        <span>{subject.name}</span>
        {detail && <small>{detail}</small>}
      </span>
      <span className="course-row-end">
        {subject.units} units
        <ArrowRight aria-hidden="true" />
      </span>
    </button>
  );
}
export function DependencyTree({
  subjects,
  onSelect,
}: {
  subjects: Subject[];
  onSelect: (s: Subject) => void;
}) {
  return (
    <ul className="dependency-tree">
      {subjects.map((s) => (
        <li key={s.code}>
          <button className="dependency-link" onClick={() => onSelect(s)}>
            <span>{s.name}</span>
            <small>{s.code}</small>
          </button>
        </li>
      ))}
    </ul>
  );
}
export function RequirementIndicator({ satisfied }: { satisfied: boolean }) {
  return satisfied ? (
    <Check
      className="requirement-indicator satisfied"
      aria-label="Requirement satisfied"
    />
  ) : (
    <Circle
      className="requirement-indicator"
      aria-label="Requirement not yet satisfied"
    />
  );
}
export function SubjectCard({
  subject,
  data,
  onSelect,
  highlight = false,
  muted = false,
}: {
  subject: Subject;
  data: RecordData;
  onSelect: (s: Subject) => void;
  highlight?: boolean;
  muted?: boolean;
}) {
  const state = academicState(subject, data.statuses);
  return (
    <button
      className={
        'subject-card ' +
        state +
        (statusOf(data.statuses, subject.code) === 'failed' ? ' failed' : '') +
        (highlight ? ' related' : '') +
        (muted ? ' trace-muted' : '')
      }
      onClick={() => onSelect(subject)}
    >
      <div className="card-code-row">
        <CourseCode code={subject.code} />
        {state === 'completed' && <Check aria-hidden="true" />}
      </div>
      <p>{subject.name}</p>
      <span className="muted">{subject.units} units</span>
      <div className="row">
        <Pill status={state} />
        {statusOf(data.statuses, subject.code) === 'failed' && (
          <span className="failed-text">Failed · retake</span>
        )}
      </div>
    </button>
  );
}
export function Notice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning' | 'success';
}) {
  return (
    <div
      className={'notice ' + tone}
      role={tone === 'warning' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}

'use client';
import type { ReactNode } from 'react';
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
  remaining: 'Not taken',
  failed: 'Failed',
  eligible: 'Eligible',
  blocked: 'Blocked',
};
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
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Empty className="panel">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
export function SubjectCard({
  subject,
  data,
  onSelect,
  highlight = false,
}: {
  subject: Subject;
  data: RecordData;
  onSelect: (s: Subject) => void;
  highlight?: boolean;
}) {
  const state = academicState(subject, data.statuses);
  return (
    <button
      className={'subject-card ' + state + (highlight ? ' related' : '')}
      onClick={() => onSelect(subject)}
    >
      <div className="row">
        <strong>{subject.code}</strong>
        <span className="muted">{subject.units} units</span>
      </div>
      <p>{subject.name}</p>
      <div className="row">
        <Pill status={state} />
        {statusOf(data.statuses, subject.code) === 'failed' && (
          <span className="failed-text">Retake</span>
        )}
      </div>
      <small>
        {subject.prerequisites.length
          ? 'Requires ' + subject.prerequisites.join(' + ')
          : 'No prerequisites'}
        {subject.corequisites.length
          ? ' · Co: ' + subject.corequisites.join(', ')
          : ''}
      </small>
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

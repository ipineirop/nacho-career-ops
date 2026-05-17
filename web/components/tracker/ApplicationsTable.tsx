'use client';

import { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './StatusBadge';
import type { Application } from '@/lib/types';
import { CANONICAL_STATUSES } from '@/lib/types';
import { scoreColor, scoreBg } from '@/lib/score-color';
import Link from 'next/link';
import { Check, Pencil, X } from 'lucide-react';

interface Props { initialApplications: Application[] }

export function ApplicationsTable({ initialApplications }: Props) {
  const [applications, setApplications] = useState(initialApplications);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [updating, setUpdating] = useState<number | null>(null);
  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState('');

  const filtered = applications.filter((a) => {
    if (filterStatus !== 'all' && a.status !== filterStatus && !(filterStatus === 'Evaluated' && a.status === 'Evaluada')) return false;
    if (a.scoreNum < minScore) return false;
    return true;
  });

  async function patchApp(id: number, body: Record<string, unknown>) {
    setUpdating(id);
    try {
      const res = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...body }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
    } catch {
      alert('Failed to update. Please try again.');
    } finally {
      setUpdating(null);
    }
  }

  function startEditNotes(app: Application) {
    setEditingNotes(app.id);
    setNotesValue(app.notes);
  }

  async function saveNotes(id: number) {
    await patchApp(id, { notes: notesValue });
    setEditingNotes(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? 'all')}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {CANONICAL_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(minScore)} onValueChange={(v) => setMinScore(Number(v ?? 0))}>
          <SelectTrigger className="w-36 h-8 text-sm">
            <SelectValue placeholder="Min score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Any score</SelectItem>
            <SelectItem value="3">3+ / 5</SelectItem>
            <SelectItem value="3.5">3.5+ / 5</SelectItem>
            <SelectItem value="4">4+ / 5</SelectItem>
            <SelectItem value="4.5">4.5+ / 5</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground">{filtered.length} results</span>
      </div>

      <div className="rounded-lg border border-border/60 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-10 text-xs">#</TableHead>
              <TableHead className="text-xs">Company</TableHead>
              <TableHead className="text-xs">Role</TableHead>
              <TableHead className="w-16 text-xs">Score</TableHead>
              <TableHead className="w-36 text-xs">Status</TableHead>
              <TableHead className="w-12 text-xs text-center">PDF</TableHead>
              <TableHead className="text-xs">Notes</TableHead>
              <TableHead className="w-20 text-xs">Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((app) => (
              <TableRow key={app.id} className="hover:bg-muted/20">
                <TableCell className="text-xs text-muted-foreground tabular-nums">{app.id}</TableCell>
                <TableCell className="font-medium text-sm">{app.company}</TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{app.role}</TableCell>
                <TableCell>
                  <span className={`rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${scoreBg(app.scoreNum)}`}>
                    {app.score}
                  </span>
                </TableCell>
                <TableCell>
                  <Select
                    value={app.status}
                    onValueChange={(v) => v && patchApp(app.id, { status: v })}
                    disabled={updating === app.id}
                  >
                    <SelectTrigger className="h-7 w-32 border-0 p-0 shadow-none focus:ring-0 bg-transparent">
                      <StatusBadge status={app.status} />
                    </SelectTrigger>
                    <SelectContent>
                      {CANONICAL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-center text-sm">{app.hasPdf ? '✅' : '❌'}</TableCell>
                <TableCell className="max-w-[200px]">
                  {editingNotes === app.id ? (
                    <div className="flex items-center gap-1">
                      <input
                        className="flex-1 min-w-0 rounded border border-border px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        value={notesValue}
                        onChange={(e) => setNotesValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveNotes(app.id);
                          if (e.key === 'Escape') setEditingNotes(null);
                        }}
                        autoFocus
                      />
                      <button onClick={() => saveNotes(app.id)} className="text-emerald-600 hover:text-emerald-700 shrink-0">
                        <Check size={13} />
                      </button>
                      <button onClick={() => setEditingNotes(null)} className="text-muted-foreground hover:text-foreground shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <div className="group flex items-start gap-1">
                      <p className="truncate text-xs text-muted-foreground flex-1">{app.notes || '—'}</p>
                      <button
                        onClick={() => startEditNotes(app)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground shrink-0 transition-opacity"
                      >
                        <Pencil size={11} />
                      </button>
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    {app.reportId && (
                      <Link
                        href={`/reports/${app.reportId}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        #{app.reportId}
                      </Link>
                    )}
                    {(app.status === 'Evaluated' || app.status === 'Evaluada') && (
                      <button
                        onClick={() => patchApp(app.id, { status: 'Applied' })}
                        disabled={updating === app.id}
                        className="text-[10px] font-medium rounded px-1.5 py-0.5 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors disabled:opacity-40"
                        title="Mark as Applied"
                      >
                        Apply
                      </button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

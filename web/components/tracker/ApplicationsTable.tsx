'use client';

import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './StatusBadge';
import type { Application } from '@/lib/types';
import { CANONICAL_STATUSES } from '@/lib/types';
import Link from 'next/link';

interface Props {
  initialApplications: Application[];
}

export function ApplicationsTable({ initialApplications }: Props) {
  const [applications, setApplications] = useState(initialApplications);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [minScore, setMinScore] = useState<number>(0);
  const [updating, setUpdating] = useState<number | null>(null);

  const filtered = applications.filter((a) => {
    if (filterStatus !== 'all' && a.status !== filterStatus) return false;
    if (a.scoreNum < minScore) return false;
    return true;
  });

  async function handleStatusChange(id: number, newStatus: string) {
    setUpdating(id);
    try {
      const res = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a)),
      );
    } catch {
      alert('Failed to update status. Please try again.');
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? 'all')}>
          <SelectTrigger className="w-40">
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
          <SelectTrigger className="w-36">
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="w-20">Score</TableHead>
              <TableHead className="w-36">Status</TableHead>
              <TableHead className="w-16">PDF</TableHead>
              <TableHead className="w-20">Report</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((app) => (
              <TableRow key={app.id}>
                <TableCell className="text-muted-foreground">{app.id}</TableCell>
                <TableCell className="font-medium">{app.company}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                  {app.role}
                </TableCell>
                <TableCell className="font-semibold">{app.score}</TableCell>
                <TableCell>
                  <Select
                    value={app.status}
                    onValueChange={(v) => v && handleStatusChange(app.id, v)}
                    disabled={updating === app.id}
                  >
                    <SelectTrigger className="h-7 w-32 border-0 p-0 shadow-none focus:ring-0">
                      <StatusBadge status={app.status} />
                    </SelectTrigger>
                    <SelectContent>
                      {CANONICAL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{app.hasPdf ? '✅' : '❌'}</TableCell>
                <TableCell>
                  {app.reportId ? (
                    <Link
                      href={`/reports/${app.reportId}`}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      #{app.reportId}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

import { Card, CardContent } from '@/components/ui/card';
import type { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  sub?: string;
  accent?: string;
  icon: LucideIcon;
  iconColor?: string;
}

export function StatsCard({ title, value, sub, accent, icon: Icon, iconColor }: StatsCardProps) {
  return (
    <Card className="border-0 shadow-sm bg-card">
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-start justify-between mb-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{title}</p>
          <div className={`rounded-lg p-1.5 ${iconColor ?? 'bg-primary/10'}`}>
            <Icon size={14} className={accent ?? 'text-primary'} />
          </div>
        </div>
        <p className={`text-4xl font-bold tracking-tight ${accent ?? 'text-foreground'}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

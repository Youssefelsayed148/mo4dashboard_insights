'use client';
import { useId } from 'react';
import { ArrowDownRight, ArrowUpRight, Layers3 } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { compact, percent, type Kpi } from '@/lib/analytics';

export const text = (v: any) => (typeof v === 'string' ? v : Array.isArray(v) ? v.join(', ') : v == null ? '' : String(v));
export const fmtDate = (v: any) => (v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' }) : '—');
export const tooltipStyle = { background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 10, color: 'var(--ink)', fontSize: 12, boxShadow: '0 8px 30px rgba(0,0,0,.12)' };

export function Badge({ value }: { value: any }) {
  const s = text(value) || 'Not set';
  const tone = /Published|Current|Connected|Approved|Succeeded|Scheduled/.test(s) ? 'good' : /Failed|Reauthorization/.test(s) ? 'bad' : /Pending|Review|Partial|Reconciliation|Retry|Unavailable/.test(s) ? 'warn' : '';
  return <span className={'badge ' + tone}>{s}</span>;
}

export function Empty({ title, body }: { title: string; body: string }) {
  return <div className="empty"><div className="empty-icon"><Layers3 size={26} /></div><h3>{title}</h3><p>{body}</p></div>;
}

export function Delta({ value }: { value?: number }) {
  if (value === undefined) return <span className="delta flat">no prior data</span>;
  const up = value >= 0;
  return <span className={'delta ' + (up ? 'up' : 'down')}>{up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(value * 100).toFixed(0)}%</span>;
}

export function KpiCard({ k }: { k: Kpi }) {
  const gid = useId().replace(/:/g, '');
  const empty = k.value === undefined;
  return (
    <div className="kpi" style={{ ['--c' as any]: k.color }}>
      <div className="kpi-top"><span className="kpi-dot" />{k.label}</div>
      <div className="kpi-value">{k.pct ? percent(k.value) : compact(k.value)}</div>
      <div className="kpi-foot"><Delta value={k.delta} /><span>vs previous period</span></div>
      {!empty && (
        <div className="kpi-spark">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={k.spark} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={k.color} stopOpacity={0.45} /><stop offset="100%" stopColor={k.color} stopOpacity={0} /></linearGradient></defs>
              <Area type="monotone" dataKey="v" stroke={k.color} strokeWidth={2} fill={`url(#${gid})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

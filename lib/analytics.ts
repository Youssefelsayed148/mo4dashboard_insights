export type Row = { id: string; fields: Record<string, any> };
export type Data = { state: string; accounts: Row[]; posts: Row[]; history: Row[]; activity: Row[]; fetchedAt?: string; errors?: Record<string, string>; truncated?: string[] };

export const METRICS = [
  { key: 'IG Reach', label: 'Reach', color: '#7c5cff' },
  { key: 'IG Views', label: 'Views', color: '#06b6d4' },
  { key: 'IG Likes', label: 'Likes', color: '#ff4d8d' },
  { key: 'IG Comments', label: 'Comments', color: '#f5a524' },
  { key: 'IG Saves', label: 'Saves', color: '#10b981' },
  { key: 'IG Shares', label: 'Shares', color: '#3b82f6' },
] as const;
export const ER_COLOR = '#f97316';
export const FORMATS = ['Image', 'Carousel', 'Reel', 'Story', 'Video'];
export const FORMAT_COLORS: Record<string, string> = { Image: '#7c5cff', Carousel: '#06b6d4', Reel: '#ff4d8d', Story: '#f5a524', Video: '#10b981' };
const TZ = 'Africa/Cairo';
const DAY = 86400000;

export const num = (v: any): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
export const postDate = (p: Row): string | undefined => p.fields['Published At'] || p.fields['Scheduled At'];
export const isPublished = (p: Row) => p.fields['Publishing Status'] === 'Published';
export const hasContent = (p: Row) => !!(p.fields['Post Title'] || p.fields['Instagram Media ID']);

export function interactions(p: Row): number | undefined {
  const f = p.fields;
  const parts = [num(f['IG Likes']), num(f['IG Comments']), num(f['IG Shares']), num(f['IG Saves'])];
  if (parts.every(x => x === undefined)) return num(f['IG Total Interactions']);
  return parts.reduce<number>((a, b) => a + (b ?? 0), 0);
}
export function engagement(p: Row): number | undefined {
  const reach = num(p.fields['IG Reach']);
  const inter = interactions(p);
  return reach && reach > 0 && inter !== undefined ? inter / reach : undefined;
}
const sumOf = (rows: Row[], f: (p: Row) => number | undefined) => {
  const vals = rows.map(f).filter((v): v is number => v !== undefined);
  return vals.length ? vals.reduce((a, b) => a + b, 0) : undefined;
};
const avgOf = (vals: (number | undefined)[]) => {
  const v = vals.filter((x): x is number => x !== undefined);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : undefined;
};
const median = (vals: number[]) => {
  if (!vals.length) return undefined;
  const s = [...vals].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

export function inWindow(rows: Row[], from: number, to: number) {
  return rows.filter(p => { const d = postDate(p); if (!d) return false; const t = new Date(d).getTime(); return t > from && t <= to; });
}

export type Kpi = { key: string; label: string; color: string; value?: number; prev?: number; delta?: number; spark: { v: number }[]; pct?: boolean };
export function buildKpis(published: Row[], days: number, now = Date.now()): Kpi[] {
  const cur = inWindow(published, now - days * DAY, now);
  const prev = inWindow(published, now - 2 * DAY * days, now - days * DAY);
  const slices = 10, size = (days * DAY) / slices;
  const spark = (f: (p: Row) => number | undefined) => Array.from({ length: slices }, (_, i) => ({ v: sumOf(inWindow(cur, now - days * DAY + i * size, now - days * DAY + (i + 1) * size), f) ?? 0 }));
  const delta = (a?: number, b?: number) => (a !== undefined && b !== undefined && b > 0 ? (a - b) / b : undefined);
  const list: Kpi[] = METRICS.map(m => {
    const f = (p: Row) => num(p.fields[m.key]);
    const value = sumOf(cur, f), pv = sumOf(prev, f);
    return { key: m.key, label: m.label, color: m.color, value, prev: pv, delta: delta(value, pv), spark: spark(f) };
  });
  const rate = (rows: Row[]) => {
    const withBoth = rows.filter(p => num(p.fields['IG Reach']) && interactions(p) !== undefined);
    const r = sumOf(withBoth, p => num(p.fields['IG Reach'])), i = sumOf(withBoth, interactions);
    return r && i !== undefined ? i / r : undefined;
  };
  const er = rate(cur), erPrev = rate(prev);
  list.push({ key: 'ER', label: 'Engagement rate', color: ER_COLOR, value: er, prev: erPrev, delta: delta(er, erPrev), pct: true, spark: spark(p => { const e = engagement(p); return e === undefined ? undefined : e * 100; }) });
  return list;
}

export function buildTrend(published: Row[], metric: string, days: number, now = Date.now()) {
  const step = days <= 14 ? 1 : days <= 30 ? 2 : 7;
  const start = now - days * DAY;
  const out: { t: number; label: string; value: number; posts: number }[] = [];
  for (let s = start; s < now; s += step * DAY) {
    const rows = inWindow(published, s, Math.min(s + step * DAY, now));
    const value = metric === 'ER'
      ? (avgOf(rows.map(engagement)) ?? 0) * 100
      : sumOf(rows, p => num(p.fields[metric])) ?? 0;
    out.push({ t: s + step * DAY, label: new Date(s + step * DAY).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ }), value, posts: rows.length });
  }
  return out;
}

export function byFormat(published: Row[]) {
  return FORMATS.map(f => {
    const rows = published.filter(p => p.fields['Media Format'] === f);
    return { format: f, count: rows.length, reach: avgOf(rows.map(p => num(p.fields['IG Reach']))), views: avgOf(rows.map(p => num(p.fields['IG Views']))), saves: avgOf(rows.map(p => num(p.fields['IG Saves']))), er: avgOf(rows.map(engagement)) };
  }).filter(x => x.count);
}

export function interactionMix(published: Row[]) {
  return [
    { name: 'Likes', key: 'IG Likes', color: '#ff4d8d' },
    { name: 'Comments', key: 'IG Comments', color: '#f5a524' },
    { name: 'Saves', key: 'IG Saves', color: '#10b981' },
    { name: 'Shares', key: 'IG Shares', color: '#3b82f6' },
  ].map(m => ({ ...m, value: sumOf(published, p => num(p.fields[m.key])) ?? 0 })).filter(m => m.value > 0);
}

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const SLOTS = ['Night', 'Morning', 'Afternoon', 'Evening'];
function slotOf(iso: string) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', hour: 'numeric', hour12: false }).formatToParts(new Date(iso));
  const wd = parts.find(p => p.type === 'weekday')?.value ?? 'Mon';
  const hr = Number(parts.find(p => p.type === 'hour')?.value ?? 0) % 24;
  return { day: Math.max(0, WEEKDAYS.indexOf(wd)), slot: hr < 6 ? 0 : hr < 12 ? 1 : hr < 18 ? 2 : 3 };
}
export function buildHeatmap(published: Row[]) {
  const cells = Array.from({ length: 7 }, () => Array.from({ length: 4 }, () => ({ n: 0, sum: 0, count: 0 })));
  for (const p of published) {
    const d = p.fields['Published At']; const e = engagement(p);
    if (!d || e === undefined) continue;
    const { day, slot } = slotOf(d);
    cells[day][slot].sum += e; cells[day][slot].count++;
  }
  const grid = cells.map(r => r.map(c => ({ n: c.count, value: c.count ? c.sum / c.count : undefined as number | undefined })));
  const max = Math.max(0, ...grid.flat().map(c => c.value ?? 0));
  return { grid, max };
}

export type Rec = { key: string; tone: 'good' | 'warn' | 'info'; title: string; body: string };
const pct = (v: number, d = 1) => (v * 100).toFixed(d) + '%';
export function buildRecommendations(published: Row[], now = Date.now()): Rec[] {
  const recs: Rec[] = [];
  const withEr = published.filter(p => engagement(p) !== undefined);
  const missing = published.length - published.filter(p => num(p.fields['IG Reach']) !== undefined).length;

  if (withEr.length < 3) {
    recs.push({ key: 'data', tone: 'info', title: 'Not enough performance data yet', body: `Recommendations unlock once 3 or more posts have reach and interaction numbers (${withEr.length} so far). Insights are collected automatically after each post goes live.` });
  } else {
    const fm = byFormat(withEr).filter(x => x.er !== undefined);
    if (fm.length >= 2) {
      const sorted = [...fm].sort((a, b) => (b.er ?? 0) - (a.er ?? 0));
      const best = sorted[0], worst = sorted[sorted.length - 1];
      if ((worst.er ?? 0) > 0) recs.push({ key: 'format', tone: 'good', title: `${best.format}s are your strongest format`, body: `${best.format} posts earn ${pct(best.er!)} engagement against ${pct(worst.er!)} for ${worst.format.toLowerCase()}s (${(best.er! / worst.er!).toFixed(1)}×). Shift more of the calendar towards ${best.format.toLowerCase()}s.` });
    }
    const reachFm = byFormat(withEr).filter(x => x.reach !== undefined);
    if (reachFm.length >= 2) {
      const top = [...reachFm].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0))[0];
      const rest = avgOf(reachFm.filter(x => x !== top).map(x => x.reach));
      if (rest && top.reach! > rest * 1.25) recs.push({ key: 'reach', tone: 'info', title: `${top.format}s reach the widest audience`, body: `Average reach is ${Math.round(top.reach!).toLocaleString('en-GB')} per ${top.format.toLowerCase()}, ${Math.round((top.reach! / rest - 1) * 100)}% above your other formats. Use them for launches and offers.` });
    }
    const { grid } = buildHeatmap(withEr);
    let best = { day: -1, slot: -1, v: 0 };
    grid.forEach((r, d) => r.forEach((c, s) => { if (c.n >= 2 && (c.value ?? 0) > best.v) best = { day: d, slot: s, v: c.value ?? 0 }; }));
    if (best.day >= 0) recs.push({ key: 'time', tone: 'good', title: `Best slot: ${WEEKDAYS[best.day]} ${SLOTS[best.slot].toLowerCase()}`, body: `Posts published then average ${pct(best.v)} engagement (Cairo time). Schedule important posts there and test one new slot a week.` });

    const saveRate = (p: Row) => { const r = num(p.fields['IG Reach']), s = num(p.fields['IG Saves']); return r && s !== undefined ? s / r : undefined; };
    const topSave = [...withEr].filter(p => saveRate(p) !== undefined).sort((a, b) => saveRate(b)! - saveRate(a)!)[0];
    if (topSave && (saveRate(topSave) ?? 0) > 0.01) recs.push({ key: 'saves', tone: 'good', title: 'A post people want to keep', body: `"${String(topSave.fields['Post Title'] || 'Untitled').slice(0, 60)}" has a ${pct(saveRate(topSave)!)} save rate. Saves signal lasting value; make a follow-up on the same topic.` });

    const med = median(withEr.map(p => engagement(p)!));
    const lag = withEr.filter(p => med && engagement(p)! < med * 0.5);
    if (med && lag.length) recs.push({ key: 'lag', tone: 'warn', title: `${lag.length} post${lag.length > 1 ? 's' : ''} well below your typical engagement`, body: `They sit at under half your median (${pct(med)}). Review their hooks and first line, and avoid repeating the same angle.` });

    const long = withEr.filter(p => String(p.fields.Caption || '').length >= 150), short = withEr.filter(p => String(p.fields.Caption || '').length < 150);
    const le = avgOf(long.map(engagement)), se = avgOf(short.map(engagement));
    if (long.length >= 2 && short.length >= 2 && le !== undefined && se !== undefined && Math.max(le, se) > Math.min(le, se) * 1.2)
      recs.push({ key: 'caption', tone: 'info', title: le > se ? 'Longer captions perform better' : 'Short captions perform better', body: `Captions of 150+ characters average ${pct(le)} engagement, shorter ones ${pct(se)}.` });
  }
  const dates = published.map(p => postDate(p)).filter(Boolean).map(d => new Date(d!).getTime());
  if (dates.length) {
    const gap = Math.floor((now - Math.max(...dates)) / DAY);
    if (gap >= 7 && gap < 3650) recs.push({ key: 'gap', tone: 'warn', title: `No post for ${gap} days`, body: 'Consistency drives reach. Queue at least two posts for this week.' });
  }
  if (missing > 0 && published.length) recs.push({ key: 'missing', tone: 'info', title: `${missing} published post${missing > 1 ? 's' : ''} without metrics`, body: 'Instagram does not provide insights for posts made before the account became a business account, or for very new posts. They are excluded from the averages.' });
  return recs;
}

export function buildAttention(data: Data, now = Date.now()) {
  const hours = (v: any) => (v ? (now - new Date(v).getTime()) / 3600000 : Infinity);
  const posts = data.posts.filter(hasContent);
  const text = (v: any) => (typeof v === 'string' ? v : v == null ? '' : String(v));
  return [
    ...data.accounts.filter(a => /Reauthorization|Failed/.test(text(a.fields['Connection Status'])) || (a.fields['Consecutive Failures'] || 0) >= 3).map(a => ({ key: 'a' + a.id, tone: 'bad' as const, title: text(a.fields.Publication) + ': connection needs attention', body: text(a.fields['Last Error']) || text(a.fields['Connection Status']) })),
    ...posts.filter(p => p.fields['Publishing Status'] === 'Failed').map(p => ({ key: 'f' + p.id, tone: 'bad' as const, title: (p.fields['Post Title'] || 'Untitled') + ': publishing failed', body: text(p.fields['Last Error']) || 'See Activity for details.', post: p })),
    ...posts.filter(p => isPublished(p) && (p.fields['Insights Status'] === 'Failed' || (p.fields['Insights Status'] === 'Pending' && hours(p.fields['Next Insights Sync']) > 48))).map(p => ({ key: 'i' + p.id, tone: 'warn' as const, title: (p.fields['Post Title'] || 'Untitled') + ': insights overdue', body: text(p.fields['Last Error']) || 'Waiting for the next collector run.', post: p })),
    ...posts.filter(p => p.fields['Content Status'] === 'In Review').map(p => ({ key: 'r' + p.id, tone: 'warn' as const, title: (p.fields['Post Title'] || 'Untitled') + ': awaiting approval', body: 'Review in Airtable.', post: p })),
  ] as { key: string; tone: 'bad' | 'warn'; title: string; body: string; post?: Row }[];
}

export function compact(v?: number) {
  if (v === undefined) return '—';
  return Math.abs(v) >= 10000 ? new Intl.NumberFormat('en-GB', { notation: 'compact', maximumFractionDigits: 1 }).format(v) : Math.round(v).toLocaleString('en-GB');
}
export const percent = (v?: number, d = 1) => (v === undefined ? '—' : (v * 100).toFixed(d) + '%');

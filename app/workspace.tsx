'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, ArrowDownToLine, ArrowUpRight, BarChart3, CalendarDays, Check, Globe2, Layers3, LayoutDashboard, Lightbulb, Moon, RefreshCw, Search, Sun, X } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ER_COLOR, FORMATS, FORMAT_COLORS, METRICS, SLOTS, WEEKDAYS, buildAttention, buildHeatmap, buildKpis, buildRecommendations, buildTrend, byFormat, compact, engagement, hasContent, interactionMix, isPublished, num, percent, postDate, type Data, type Row } from '@/lib/analytics';
import { demoData } from '@/lib/demo';
import { Badge, Empty, KpiCard, fmtDate, text, tooltipStyle } from './ui';

const empty: Data = { state: 'loading', accounts: [], posts: [], history: [], activity: [] };
const base = 'https://airtable.com/app72eKOnd9oaiCyR';
const nav = [['Overview', LayoutDashboard], ['Performance', BarChart3], ['Content', Layers3], ['Accounts', Globe2], ['Activity', Activity]] as const;
const subtitles: Record<string, string> = {
  Overview: 'How your Instagram content is performing, and what to do next.',
  Performance: 'Compare formats, timing and individual posts.',
  Content: 'Library, approvals and the publishing calendar in one place.',
  Accounts: 'Connection health and collection status per publication.',
  Activity: 'Publishing attempts, insight refreshes and recoveries.',
};
const trendOptions = [...METRICS.map(m => ({ key: m.key, label: m.label, color: m.color })), { key: 'ER', label: 'Engagement rate', color: ER_COLOR }];

export default function Workspace() {
  const refreshing = useRef(false);
  const [page, setPage] = useState('Overview');
  const [data, setData] = useState<Data>(empty);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [demo, setDemo] = useState(false);
  const [dark, setDark] = useState(false);
  const [days, setDays] = useState(30);
  const [account, setAccount] = useState('all');
  const [metric, setMetric] = useState('IG Reach');
  const [tab, setTab] = useState<'Library' | 'Approvals' | 'Calendar'>('Library');
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState('all');
  const [promotion, setPromotion] = useState('all');
  const [sortKey, setSortKey] = useState('date');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selected, setSelected] = useState<Row | null>(null);
  const [showAll, setShowAll] = useState(false);

  async function refresh() {
    if (refreshing.current) return;
    refreshing.current = true; setBusy(true); setError('');
    try {
      const r = await fetch('/api/workspace', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = (await r.json()) as Data & { error?: string };
      if (!r.ok) throw new Error(d.error || 'Could not refresh the workspace');
      setData(previous => {
        const merged = { ...d };
        for (const key of Object.keys(d.errors || {})) if (['accounts', 'posts', 'history', 'activity'].includes(key)) { const k = key as 'accounts' | 'posts' | 'history' | 'activity'; merged[k] = previous[k]; }
        return merged;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Refresh failed');
      setData(d => (d.state === 'loading' ? { ...d, state: 'error' } : d));
    } finally { refreshing.current = false; setBusy(false); }
  }
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('demo') === '1') { setDemo(true); setData(demoData()); return; }
    refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible' && !refreshing.current) refresh(); }, 120000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; }, [dark]);

  const ready = data.state === 'connected';
  const accountNames = Object.fromEntries(data.accounts.map(a => [a.id, a.fields['Publication'] || a.fields['Account Name']]));
  const scoped = useMemo(() => data.posts.filter(hasContent).filter(p => account === 'all' || p.fields.Account?.includes(account)), [data.posts, account]);
  const published = useMemo(() => scoped.filter(isPublished), [scoped]);
  const kpis = useMemo(() => buildKpis(published, days), [published, days]);
  const trend = useMemo(() => buildTrend(published, metric, days), [published, metric, days]);
  const formats = useMemo(() => byFormat(published), [published]);
  const mix = useMemo(() => interactionMix(published), [published]);
  const heat = useMemo(() => buildHeatmap(published), [published]);
  const recs = useMemo(() => buildRecommendations(published), [published]);
  const attention = useMemo(() => buildAttention(data), [data]);
  const top = useMemo(() => [...published].filter(p => num(p.fields['IG Reach']) !== undefined).sort((a, b) => (num(b.fields['IG Reach']) ?? 0) - (num(a.fields['IG Reach']) ?? 0)).slice(0, 5), [published]);
  const withMetrics = published.filter(p => num(p.fields['IG Reach']) !== undefined).length;
  const trendMeta = trendOptions.find(t => t.key === metric) || trendOptions[0];
  const approvals = scoped.filter(p => p.fields['Content Status'] === 'In Review');

  const now = Date.now();
  const hoursSince = (v: any) => (v ? (now - new Date(v).getTime()) / 3600000 : Infinity);
  const lastSync = data.accounts.map(a => a.fields['Last Successful Sync']).filter(Boolean).sort().pop();
  const live = data.accounts.filter(a => a.fields['Connection Status'] === 'Connected' && (a.fields['Insights Enabled'] || a.fields['Publishing Enabled']));
  const health = !ready ? { cls: 'warn', label: 'Connecting to Airtable…', detail: 'Waiting for the first read.' }
    : !live.length ? { cls: 'bad', label: 'No active accounts', detail: 'Enable insights or publishing on a connected account.' }
    : hoursSince(lastSync) < 48 ? { cls: 'ok', label: `${live.length} account${live.length > 1 ? 's' : ''} live`, detail: 'Last sync ' + fmtDate(lastSync) }
    : { cls: 'warn', label: 'Sync is stale', detail: lastSync ? 'Last sync ' + fmtDate(lastSync) : 'No successful sync yet.' };

  function tableRows(rows: Row[]) {
    const val = (p: Row): any => {
      switch (sortKey) {
        case 'title': return text(p.fields['Post Title']).toLowerCase();
        case 'er': return engagement(p) ?? -1;
        case 'date': return postDate(p) ?? '';
        default: return num(p.fields[sortKey]) ?? -1;
      }
    };
    return [...rows].sort((a, b) => { const x = val(a), y = val(b); return (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
  }
  const sortBy = (k: string) => { if (k === sortKey) setSortDir(d => (d === 1 ? -1 : 1)); else { setSortKey(k); setSortDir(-1); } };
  const th = (k: string, label: string) => <th className={'sortable' + (sortKey === k ? ' on' : '')} onClick={() => sortBy(k)}>{label}{sortKey === k ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}</th>;
  function postTable(rows: Row[]) {
    if (!rows.length) return <Empty title={ready ? 'No matching content' : 'Your content will appear here'} body={ready ? 'Nothing matches the current filters.' : 'Waiting for the first read from Airtable.'} />;
    return (
      <div className="table-wrap"><table><thead><tr>{th('title', 'Content')}<th>Account</th>{th('date', rows.every(isPublished) ? 'Published' : rows.some(isPublished) ? 'Date' : 'Scheduled at')}{th('IG Reach', 'Reach')}{th('IG Views', 'Views')}{th('IG Likes', 'Likes')}{th('IG Comments', 'Comments')}{th('IG Saves', 'Saves')}{th('er', 'Eng.')}<th>Status</th></tr></thead>
        <tbody>{tableRows(rows).map(p => (
          <tr key={p.id}>
            <td><button className="post-title" onClick={() => setSelected(p)}>{p.fields['Post Title'] || 'Untitled post'}</button><small><i className="fmt-dot" style={{ background: FORMAT_COLORS[p.fields['Media Format']] || 'var(--muted)' }} />{p.fields['Media Format'] || 'Format not set'}</small></td>
            <td>{accountNames[p.fields.Account?.[0]] || '—'}</td>
            <td>{fmtDate(postDate(p))}{rows.some(isPublished) && !rows.every(isPublished) && <small>{isPublished(p) ? 'Published' : 'Scheduled'}</small>}</td>
            {['IG Reach', 'IG Views', 'IG Likes', 'IG Comments', 'IG Saves'].map(k => <td key={k} className="n">{compact(num(p.fields[k]))}</td>)}
            <td className="n">{percent(engagement(p))}</td>
            <td><Badge value={p.fields['Publishing Status'] === 'Published' ? p.fields['Insights Status'] || 'Published' : p.fields['Publishing Status']} /></td>
          </tr>))}</tbody></table></div>
    );
  }
  function download() {
    const columns = ['Post Title', 'Media Format', 'Publishing Status', 'Instagram Media ID', 'Published At', 'IG Reach', 'IG Views', 'IG Likes', 'IG Comments', 'IG Saves', 'IG Shares', 'Insights Status'];
    const csv = [columns, ...scoped.map(p => columns.map(c => text(p.fields[c])))].map(row => row.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'mo4-content-export.csv'; a.click(); URL.revokeObjectURL(url);
  }

  const libraryRows = scoped.filter(p => (format === 'all' || p.fields['Media Format'] === format) && (promotion === 'all' || p.fields['Promotion Status'] === promotion) && (!search || `${p.fields['Post Title']} ${p.fields.Caption}`.toLowerCase().includes(search.toLowerCase())));
  const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const;

  return (
    <div className="app">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('Overview'); }} aria-label="MO4 Network">
          <img src="/logo.jpg" alt="MO4 Network" />
        </a>
        <div className="workspace-label">CONTENT HUB</div>
        <nav>{nav.map(([name, Icon]) => (
          <button key={name} className={page === name ? 'active' : ''} onClick={() => setPage(name)}><Icon size={18} />{name}{name === 'Content' && approvals.length > 0 && <b>{approvals.length}</b>}</button>
        ))}</nav>
        <div className="sidebar-bottom">
          <div className="health"><span className={'dot ' + health.cls} /><div><b>{health.label}</b><small>{health.detail}</small></div></div>
          <div className="side-actions">
            <a href={base} target="_blank" rel="noreferrer">Airtable <ArrowUpRight size={13} /></a>
            <button onClick={() => setDark(d => !d)} aria-label="Toggle theme">{dark ? <Sun size={15} /> : <Moon size={15} />}</button>
          </div>
        </div>
      </aside>

      <main>
        <header className="topbar">
          <div className="crumbs"><span>MO4 Network</span><i>/</i><b>{page}</b></div>
          <div className="top-actions">
            {['Overview', 'Performance'].includes(page) && <div className="segmented" role="tablist" aria-label="Period">{[7, 30, 90].map(d => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{d}d</button>)}</div>}
            <select aria-label="Account" value={account} onChange={e => setAccount(e.target.value)}><option value="all">All accounts</option>{data.accounts.map(a => <option key={a.id} value={a.id}>{accountNames[a.id]}</option>)}</select>
            <button className="button dark" onClick={refresh} disabled={busy || demo}><RefreshCw size={14} className={busy ? 'spin' : ''} />{busy ? 'Refreshing' : 'Refresh'}</button>
          </div>
        </header>

        <div className="content">
          <div className="heading"><div><div className="eyebrow">INSTAGRAM</div><h1>{page === 'Overview' ? 'Performance overview' : page}</h1><p>{subtitles[page]}</p></div></div>
          {demo && <div className="notice info"><Lightbulb size={16} />Demo mode: you are looking at sample data so the layout can be reviewed. Remove <code>?demo=1</code> from the address to see your real data.</div>}
          {error && <div className="notice error" role="alert">{error}</div>}
          {data.state === 'setup_required' && <div className="notice"><AlertTriangle size={16} /><div><b>Data connection missing</b><p>The server has no Airtable read token configured. Set AIRTABLE_READ_TOKEN in the hosting settings and redeploy.</p></div></div>}
          {data.truncated?.length ? <div className="notice">Very large history: totals only include the most recent records loaded.</div> : null}
          {Object.entries(data.errors || {}).map(([k, v]) => <div className="notice error" key={k}>{k}: {v}. Previously loaded rows are kept and may be stale.</div>)}
          {ready && published.length > 0 && withMetrics === 0 && <div className="notice info"><Lightbulb size={16} /><div><b>No performance numbers yet</b><p>{published.length} published post{published.length > 1 ? 's are' : ' is'} tracked, but Instagram has not returned insights for {published.length > 1 ? 'them' : 'it'}. Posts from before the account became a business account never provide insights. New posts fill this page automatically.</p></div></div>}

          {page === 'Overview' && <>
            <section className="kpi-grid">{kpis.map(k => <KpiCard key={k.key} k={k} />)}</section>
            <div className="grid-main">
              <section className="card">
                <div className="card-head"><div><h2>Performance by publish date</h2><p>Totals of posts published in each period · last {days} days</p></div>
                  <div className="chips">{trendOptions.map(t => <button key={t.key} className={metric === t.key ? 'on' : ''} style={{ ['--c' as any]: t.color }} onClick={() => setMetric(t.key)}>{t.label}</button>)}</div></div>
                <div className="chart-box tall">{ready && trend.some(t => t.value > 0) ? (
                  <ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <defs><linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={trendMeta.color} stopOpacity={0.35} /><stop offset="100%" stopColor={trendMeta.color} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} /><XAxis dataKey="label" {...axis} minTickGap={24} /><YAxis {...axis} tickFormatter={v => (metric === 'ER' ? v.toFixed(0) + '%' : compact(v))} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [metric === 'ER' ? Number(v).toFixed(1) + '%' : Number(v).toLocaleString('en-GB'), trendMeta.label]} />
                    <Area type="monotone" dataKey="value" stroke={trendMeta.color} strokeWidth={2.5} fill="url(#trendFill)" activeDot={{ r: 5 }} />
                  </AreaChart></ResponsiveContainer>) : <Empty title="Nothing to chart yet" body="Charts appear as soon as published posts have performance numbers in this period." />}</div>
              </section>
              <section className="card recs">
                <div className="card-head"><div><h2>What to do next</h2><p>Computed from your own posts</p></div><Lightbulb size={18} /></div>
                <div className="rec-list">{recs.slice(0, 4).map(r => <div key={r.key} className={'rec ' + r.tone}><b>{r.title}</b><p>{r.body}</p></div>)}</div>
              </section>
            </div>
            <div className="grid-two">
              <section className="card"><div className="card-head"><div><h2>Top posts by reach</h2><p>All time, current account selection</p></div><BarChart3 size={18} /></div>
                {top.length ? <div className="top-list">{top.map((p, i) => { const max = num(top[0].fields['IG Reach']) || 1; const r = num(p.fields['IG Reach']) || 0; return (
                  <button key={p.id} onClick={() => setSelected(p)}><span className="rank">{i + 1}</span><span className="top-body"><b>{p.fields['Post Title'] || 'Untitled'}</b><small>{p.fields['Media Format']} · {fmtDate(postDate(p))}</small><span className="bar"><i style={{ width: (r / max) * 100 + '%', background: FORMAT_COLORS[p.fields['Media Format']] || '#7c5cff' }} /></span></span><span className="top-num"><b>{compact(r)}</b><small>{percent(engagement(p))} eng.</small></span></button>); })}</div>
                  : <Empty title="No ranked posts yet" body="Posts with reach numbers are ranked here." />}</section>
              <section className="card"><div className="card-head"><div><h2>Needs attention</h2><p>Failures, overdue insights and approvals</p></div><AlertTriangle size={18} /></div>
                {!ready ? <Empty title="Loading" body="Reading your Airtable base." /> : attention.length ? <div className="attention-list">{attention.slice(0, 7).map(a => <button key={a.key} onClick={() => a.post && setSelected(a.post)}><span className={'badge ' + a.tone}>{a.tone === 'bad' ? 'Action' : 'Watch'}</span><span><b>{a.title}</b><small>{a.body}</small></span></button>)}{attention.length > 7 && <p className="more">+{attention.length - 7} more</p>}</div>
                  : <div className="all-good"><Check size={16} />Everything is running normally.</div>}</section>
            </div>
          </>}

          {page === 'Performance' && <>
            <div className="grid-two">
              <section className="card"><div className="card-head"><div><h2>Engagement rate by format</h2><p>Interactions ÷ reach, average per post</p></div></div>
                <div className="chart-box">{formats.some(f => f.er !== undefined) ? (
                  <ResponsiveContainer width="100%" height="100%"><BarChart data={formats.map(f => ({ ...f, erPct: (f.er ?? 0) * 100 }))} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} /><XAxis dataKey="format" {...axis} /><YAxis {...axis} tickFormatter={v => v + '%'} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--hover)' }} formatter={(v: any) => [Number(v).toFixed(2) + '%', 'Engagement']} />
                    <Bar dataKey="erPct" radius={[8, 8, 0, 0]}>{formats.map(f => <Cell key={f.format} fill={FORMAT_COLORS[f.format]} />)}</Bar>
                  </BarChart></ResponsiveContainer>) : <Empty title="No format data yet" body="Needs published posts with reach and interactions." />}</div></section>
              <section className="card"><div className="card-head"><div><h2>Where engagement comes from</h2><p>Share of likes, comments, saves and shares</p></div></div>
                <div className="chart-box donut">{mix.length ? (<>
                  <ResponsiveContainer width="55%" height="100%"><PieChart><Pie data={mix} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="92%" paddingAngle={3} stroke="none">{mix.map(m => <Cell key={m.name} fill={m.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(v: any, n: any) => [Number(v).toLocaleString('en-GB'), n]} /></PieChart></ResponsiveContainer>
                  <ul className="legend">{mix.map(m => { const total = mix.reduce((a, b) => a + b.value, 0); return <li key={m.name}><i style={{ background: m.color }} />{m.name}<b>{Math.round((m.value / total) * 100)}%</b></li>; })}</ul></>) : <Empty title="No interactions yet" body="Appears once posts have like, comment, save or share counts." />}</div></section>
            </div>
            <section className="card"><div className="card-head"><div><h2>Best time to post</h2><p>Average engagement rate by weekday and time of day (Cairo time)</p></div></div>
              {heat.max > 0 ? <div className="heatmap"><div className="hm-corner" />{SLOTS.map(s => <div key={s} className="hm-head">{s}</div>)}{heat.grid.map((row, d) => [<div key={'l' + d} className="hm-label">{WEEKDAYS[d]}</div>, ...row.map((c, s) => <div key={d + '-' + s} className="hm-cell" title={c.n ? `${c.n} post${c.n > 1 ? 's' : ''}` : 'No posts'} style={{ background: c.value === undefined ? 'transparent' : `rgba(249,115,22,${0.12 + 0.88 * (c.value / heat.max)})`, color: c.value !== undefined && c.value / heat.max > 0.55 ? '#fff' : 'var(--ink)' }}>{c.value === undefined ? '' : percent(c.value)}</div>)])}</div>
                : <Empty title="Not enough timing data" body="Needs published posts with engagement numbers." />}</section>
            <section className="card"><div className="card-head"><div><h2>All recommendations</h2><p>Based on {withMetrics} post{withMetrics === 1 ? '' : 's'} with performance numbers</p></div></div>
              <div className="rec-list wide">{recs.map(r => <div key={r.key} className={'rec ' + r.tone}><b>{r.title}</b><p>{r.body}</p></div>)}</div></section>
            <section className="card"><div className="card-head"><div><h2>Post performance</h2><p>Click a column to sort</p></div><button className="button" onClick={download} disabled={!ready || !scoped.length}><ArrowDownToLine size={14} />Export CSV</button></div>{postTable(showAll ? published : tableRows(published).slice(0, 15))}{published.length > 15 && <div className="show-all"><button className="button" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : `Show all ${published.length} posts`}</button></div>}</section>
          </>}

          {page === 'Content' && <>
            <div className="toolbar"><div className="segmented big">{(['Library', 'Approvals', 'Calendar'] as const).map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}{t === 'Approvals' && approvals.length > 0 && <b>{approvals.length}</b>}</button>)}</div>
              {tab === 'Library' && <div className="filters"><label className="search"><Search size={15} /><input aria-label="Search content" placeholder="Search content…" value={search} onChange={e => setSearch(e.target.value)} /></label><select aria-label="Format" value={format} onChange={e => setFormat(e.target.value)}><option value="all">All formats</option>{FORMATS.map(f => <option key={f}>{f}</option>)}</select><select aria-label="Promotion" value={promotion} onChange={e => setPromotion(e.target.value)}><option value="all">All promotion states</option>{['Unknown', 'Not promoted', 'Boosted', 'Ad-linked'].map(f => <option key={f}>{f}</option>)}</select></div>}
              <a className="button" href={base + '/tblSDEJXTXmMhiuxw'} target="_blank" rel="noreferrer">Manage in Airtable <ArrowUpRight size={14} /></a></div>
            {tab === 'Approvals' && <div className="notice info"><Lightbulb size={16} />Approvals are done in Airtable. Approve the exact account, caption, media and schedule there. Any change requires re-approval.</div>}
            {tab !== 'Calendar' && <section className="card">{postTable(tab === 'Library' ? libraryRows : approvals)}</section>}
            {tab === 'Calendar' && <><div className="calendar-tools"><label>Month <input type="month" value={month} onChange={e => setMonth(e.target.value)} /></label></div>
              <section className="card">{ready ? <div className="calendar-grid">{Array.from({ length: new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate() }, (_, i) => {
                const day = month + '-' + String(i + 1).padStart(2, '0');
                const rows = scoped.filter(p => (p.fields['Scheduled At'] || p.fields['Published At'] || '').startsWith(day));
                return <div className="calendar-day" key={day}><b>{i + 1}</b>{rows.map(p => <button key={p.id} style={{ borderLeftColor: FORMAT_COLORS[p.fields['Media Format']] || 'var(--line)' }} onClick={() => setSelected(p)}>{p.fields['Post Title'] || 'Untitled'}<small>{accountNames[p.fields.Account?.[0]]}</small></button>)}</div>;
              })}</div> : <Empty title="Calendar" body="Scheduled posts appear here once the data is loaded." />}</section></>}
          </>}

          {page === 'Accounts' && <><div className="accounts-grid">{data.accounts.map(a => (
            <section className="card account-card" key={a.id}>
              <div className="account-top"><span className="publication-mark">{text(a.fields.Publication).slice(0, 2).toUpperCase()}</span><Badge value={a.fields['Connection Status']} /></div>
              <h2>{a.fields.Publication}</h2><p>{a.fields['Instagram Username'] ? '@' + a.fields['Instagram Username'] : 'Instagram account not mapped'}</p>
              <dl><dt>Publishing</dt><dd>{a.fields['Publishing Enabled'] ? 'Enabled' : 'Disabled'}</dd><dt>Insights</dt><dd>{a.fields['Insights Enabled'] ? 'Enabled' : 'Disabled'}</dd><dt>Timezone</dt><dd>{a.fields.Timezone || 'Not set'}</dd><dt>Last success</dt><dd>{fmtDate(a.fields['Last Successful Sync'])}</dd><dt>Last discovery</dt><dd>{fmtDate(a.fields['Last Discovery At'])}</dd><dt>Consecutive failures</dt><dd>{a.fields['Consecutive Failures'] ?? 0}</dd><dt>Tracking from</dt><dd>{a.fields['Tracking Start'] ? String(a.fields['Tracking Start']).slice(0, 10) : 'Not set'}</dd></dl>
              {a.fields['Last Error'] && <p className="acct-error">{text(a.fields['Last Error']).slice(0, 220)}</p>}
              <a className="text-button" href={base + '/tblInBXmP2Hj0At0B/' + a.id} target="_blank" rel="noreferrer">Review account <ArrowUpRight size={14} /></a>
            </section>))}</div>{!data.accounts.length && <section className="card"><Empty title="No accounts yet" body="Connect Airtable to review account mappings and collection health." /></section>}</>}

          {page === 'Activity' && <section className="card"><div className="card-head"><div><h2>Workspace activity</h2><p>Persistent outcomes from your automations</p></div><Activity size={18} /></div>
            {data.activity.length ? <div className="activity-list">{[...data.activity].sort((a, b) => text(b.fields['Started At']).localeCompare(text(a.fields['Started At']))).slice(0, 100).map(r => <div key={r.id}><span className="activity-icon"><Activity size={15} /></span><div><b>{r.fields.Operation || 'Event'}</b><p>{r.fields.Summary}</p><small>{fmtDate(r.fields['Started At'])}</small></div><Badge value={r.fields.Outcome} /></div>)}</div>
              : <Empty title="Nothing runs silently" body="Publishing attempts, insight refreshes and recoveries are logged here." />}</section>}

          <footer><span>MO4 Network · Content Hub</span><span>{data.fetchedAt ? 'Last read ' + fmtDate(data.fetchedAt) + ' · refreshes every 2 minutes' : 'Connecting to Airtable…'}</span></footer>
        </div>
      </main>

      {selected && <PostModal post={selected} history={data.history.filter(h => h.fields.Post?.includes(selected.id))} account={accountNames[selected.fields.Account?.[0]]} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PostModal({ post, history, account, onClose }: { post: Row; history: Row[]; account?: string; onClose: () => void }) {
  const f = post.fields;
  let meta: any = {}; try { meta = JSON.parse(f['Metric Metadata'] || '{}'); } catch {}
  const stateOf: Record<string, string> = { 'IG Views': 'views', 'IG Reach': 'reach', 'IG Likes': 'likes', 'IG Comments': 'comments', 'IG Shares': 'shares', 'IG Saves': 'saved' };
  const stale = (k: string) => { const s = meta.metrics?.[stateOf[k]]?.state; return typeof f[k] === 'number' && s && s !== 'available'; };
  const items: { k: string; label: string; color: string }[] = [
    ...METRICS.map(m => ({ k: m.key, label: m.label, color: m.color })),
    { k: 'IG Reposts', label: 'Reposts', color: '#8b5cf6' }, { k: 'IG Profile Visits', label: 'Profile visits', color: '#14b8a6' }, { k: 'IG Follows', label: 'Follows', color: '#ec4899' },
    { k: 'Combined Likes', label: 'Total likes*', color: '#ff4d8d' }, { k: 'Combined Comments', label: 'Total comments*', color: '#f5a524' }, { k: 'Combined Views', label: 'Total views*', color: '#06b6d4' },
    ...(f['Media Format'] === 'Reel' ? [{ k: 'Reel Avg Watch Time (ms)', label: 'Avg watch (ms)', color: '#ff4d8d' }, { k: 'Reel Total Watch Time (ms)', label: 'Total watch (ms)', color: '#ff4d8d' }, { k: 'Reel Skip Rate', label: 'Skip rate', color: '#f97316' }] : []),
    ...(f['Media Format'] === 'Story' ? ['Story Replies', 'Story Link Clicks', 'Story Taps Forward', 'Story Taps Back', 'Story Exits', 'Story Next Story'].map(k => ({ k, label: k.replace('Story ', ''), color: '#f5a524' })) : []),
  ].filter(i => typeof f[i.k] === 'number' || METRICS.some(m => m.key === i.k));
  const points = history.map(h => ({ time: new Date(h.fields['Collected At']).getTime(), reach: h.fields['IG Reach'] ?? null, views: h.fields['IG Views'] ?? null, likes: h.fields['IG Likes'] ?? null, saves: h.fields['IG Saves'] ?? null, shares: h.fields['IG Shares'] ?? null })).filter(h => Number.isFinite(h.time)).sort((a, b) => a.time - b.time);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="Post details" onClick={e => e.stopPropagation()}>
        <button className="close" aria-label="Close post details" onClick={onClose}><X size={20} /></button>
        <div className="eyebrow">{(f['Media Format'] || 'POST').toString().toUpperCase()} · {account || 'Unassigned'}</div>
        <h2>{f['Post Title'] || 'Untitled post'}</h2>
        <div className="modal-badges">{f['Content Status'] && <Badge value={f['Content Status']} />}<Badge value={f['Publishing Status']} /><Badge value={f['Insights Status']} />{f['Promotion Status'] && <Badge value={f['Promotion Status']} />}<span className="when">{fmtDate(postDate(post))}</span></div>
        <p className="caption">{f.Caption || 'No caption stored.'}</p>
        <div className="detail-metrics">{items.map(i => <div key={i.k} style={{ ['--c' as any]: i.color }}><small>{i.label}</small><strong>{compact(num(f[i.k]))}</strong>{stale(i.k) && <em title="The latest request did not return this metric; this is the previous value.">last available</em>}</div>)}
          <div style={{ ['--c' as any]: ER_COLOR }}><small>Engagement</small><strong>{percent(engagement(post))}</strong></div></div>
        {['Combined Likes', 'Combined Comments', 'Combined Views'].some(k => typeof f[k] === 'number') && <p className="fine">* Totals include promoted and cross-posted engagement; the other numbers are organic Instagram only.</p>}
        <h3>Performance history</h3>
        {points.length ? <div className="chart-box"><ResponsiveContainer width="100%" height="100%"><LineChart data={points} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
          <CartesianGrid stroke="var(--line)" strokeDasharray="3 6" vertical={false} /><XAxis dataKey="time" stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => new Date(v).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} /><YAxis stroke="var(--muted)" fontSize={11} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelFormatter={v => fmtDate(v)} />
          <Line dataKey="reach" name="Reach" stroke="#7c5cff" strokeWidth={2.5} dot={false} connectNulls={false} /><Line dataKey="views" name="Views" stroke="#06b6d4" strokeWidth={2.5} dot={false} connectNulls={false} /><Line dataKey="likes" name="Likes" stroke="#ff4d8d" strokeWidth={2.5} dot={false} connectNulls={false} /><Line dataKey="saves" name="Saves" stroke="#10b981" strokeWidth={2} dot={false} connectNulls={false} /><Line dataKey="shares" name="Shares" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls={false} />
        </LineChart></ResponsiveContainer></div> : <Empty title="History starts with the first observation" body="Snapshots appear once the insight collector has run for this post." />}
        <p className="fine">Numbers are cumulative. Blank means unavailable, not zero. Last collection: {fmtDate(f['Last Insights Success'])}.</p>
        <details><summary>Additional metrics</summary><pre>{f['Additional Insights'] || 'No additional metrics have been returned yet.'}</pre></details>
        <details><summary>Promotion details</summary><pre>{[`Status: ${f['Promotion Status'] || 'Unknown'}`, f['Promotion Source'] && `Source: ${f['Promotion Source']}`, f['Promotion Last Verified'] && `Last verified: ${fmtDate(f['Promotion Last Verified'])}`, f['Promotion Metadata']].filter(Boolean).join('\n')}</pre></details>
        <details><summary>Publishing details</summary><pre>{[['Content status', f['Content Status']], ['Approved by', f['Approved By']], ['Approved at', f['Approved At'] && fmtDate(f['Approved At'])], ['Scheduled at', f['Scheduled At'] && fmtDate(f['Scheduled At'])], ['Attempts', f['Attempt Count']], ['Next attempt', f['Next Publish Attempt'] && fmtDate(f['Next Publish Attempt'])], ['Last error', f['Last Error']]].filter(r => r[1] !== undefined && r[1] !== null && r[1] !== '').map(r => r[0] + ': ' + r[1]).join('\n') || 'No publishing activity recorded.'}</pre></details>
        <details><summary>Metric availability</summary><pre>{f['Metric Metadata'] || 'No collection metadata recorded yet.'}</pre></details>
        <div className="modal-links"><a className="button" href={base + '/tblSDEJXTXmMhiuxw/' + post.id} target="_blank" rel="noreferrer">Open record <ArrowUpRight size={14} /></a>{/^https:\/\/([\w-]+\.)?instagram\.com\//i.test(f['Instagram Permalink'] || '') && <a className="button dark" href={f['Instagram Permalink']} target="_blank" rel="noreferrer">View on Instagram <ArrowUpRight size={14} /></a>}</div>
      </section>
    </div>
  );
}

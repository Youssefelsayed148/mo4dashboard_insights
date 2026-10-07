import type { Data, Row } from './analytics';

// Deterministic sample data used only when the URL contains ?demo=1, so the layout can be reviewed before real insights exist.
function rng(seed: number) { let s = seed; return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }

export function demoData(now = Date.now()): Data {
  const r = rng(42);
  const DAY = 86400000;
  const accounts: Row[] = [
    { id: 'recDemoA', fields: { Publication: 'Popeye Restaurant', 'Instagram Username': 'popeye_restaurant_', 'Connection Status': 'Connected', 'Publishing Enabled': true, 'Insights Enabled': true, Timezone: 'Africa/Cairo', 'Last Successful Sync': new Date(now - 3 * 3600000).toISOString(), 'Last Discovery At': new Date(now - 3 * 3600000).toISOString(), 'Tracking Start': '2026-01-01' } },
    { id: 'recDemoB', fields: { Publication: 'MO4 Network', 'Instagram Username': 'mo4network', 'Connection Status': 'Connected', 'Publishing Enabled': false, 'Insights Enabled': true, Timezone: 'Africa/Cairo', 'Last Successful Sync': new Date(now - 5 * 3600000).toISOString(), 'Tracking Start': '2026-01-01' } },
  ];
  const fmts = ['Image', 'Carousel', 'Reel', 'Reel', 'Image', 'Carousel', 'Story', 'Video'];
  const mult: Record<string, number> = { Image: 1, Carousel: 1.3, Reel: 2.4, Story: 0.5, Video: 1.4 };
  const topics = ['Weekend burger special', 'Behind the kitchen', 'New menu drop', 'Customer favourites', 'Family combo offer', 'Chef tips', 'Dessert launch', 'Late-night deals', 'Ramadan preview', 'Team spotlight'];
  const posts: Row[] = [];
  const history: Row[] = [];
  for (let i = 0; i < 44; i++) {
    const age = 1 + Math.floor(r() * 98);
    const hour = [9, 13, 19, 21, 22][Math.floor(r() * 5)];
    const d = new Date(now - age * DAY); d.setUTCHours(hour - 3, Math.floor(r() * 59), 0, 0);
    const format = fmts[Math.floor(r() * fmts.length)];
    const evening = hour >= 19 ? 1.25 : 1;
    const reach = Math.round((900 + r() * 2600) * mult[format] * evening);
    const likes = Math.round(reach * (0.035 + r() * 0.05));
    const comments = Math.round(likes * (0.04 + r() * 0.08));
    const saves = Math.round(reach * (0.004 + r() * 0.02) * (format === 'Carousel' ? 1.8 : 1));
    const shares = Math.round(reach * (0.003 + r() * 0.012) * (format === 'Reel' ? 2 : 1));
    const noData = i % 11 === 0;
    const id = 'recDemoP' + i;
    const title = topics[i % topics.length] + (i >= topics.length ? ' #' + Math.floor(i / topics.length + 1) : '');
    posts.push({ id, fields: {
      'Post Title': title, Caption: title + (r() > 0.5 ? ' — order now and tell us what you think. We are open every day until late with new offers every week.' : ''),
      'Media Format': format, Account: [i % 4 === 0 ? 'recDemoB' : 'recDemoA'], 'Published At': d.toISOString(), 'Publishing Status': 'Published', 'Insights Status': noData ? 'Unavailable' : 'Current',
      'Instagram Media ID': '1790' + (100000 + i), 'Instagram Permalink': 'https://www.instagram.com/p/demo' + i + '/', 'Last Insights Success': new Date(now - 6 * 3600000).toISOString(),
      ...(noData ? {} : { 'IG Reach': reach, 'IG Views': Math.round(reach * (1.3 + r() * 0.8)), 'IG Likes': likes, 'IG Comments': comments, 'IG Saves': saves, 'IG Shares': shares, 'IG Reposts': Math.round(shares * 0.2), 'IG Profile Visits': Math.round(reach * 0.03), 'IG Follows': Math.round(reach * 0.004), 'Combined Likes': Math.round(likes * 1.2), 'Combined Comments': Math.round(comments * 1.1), 'Combined Views': Math.round(reach * 2.1) }),
    } });
    if (!noData) for (let k = 1; k <= 4; k++) history.push({ id: 'recDemoH' + i + '_' + k, fields: { Post: [id], 'Collected At': new Date(d.getTime() + k * k * 6 * 3600000).toISOString(), 'IG Reach': Math.round(reach * (1 - 0.7 / k)), 'IG Views': Math.round(reach * 1.6 * (1 - 0.7 / k)), 'IG Likes': Math.round(likes * (1 - 0.6 / k)) } });
  }
  posts.push({ id: 'recDemoS1', fields: { 'Post Title': 'Friday offer (waiting for approval)', 'Media Format': 'Reel', Account: ['recDemoA'], 'Scheduled At': new Date(now + 2 * DAY).toISOString(), 'Content Status': 'In Review', 'Publishing Status': 'Not Scheduled' } });
  posts.push({ id: 'recDemoS2', fields: { 'Post Title': 'Weekend burger carousel', 'Media Format': 'Carousel', Account: ['recDemoA'], 'Scheduled At': new Date(now + 4 * DAY).toISOString(), 'Content Status': 'Approved', 'Publishing Status': 'Scheduled' } });
  const activity: Row[] = ['Insights collection', 'Discovery', 'Publish', 'Insights collection', 'Discovery'].map((op, i) => ({ id: 'recDemoL' + i, fields: { Operation: op, Summary: op + ' completed for Popeye Restaurant', 'Started At': new Date(now - (i + 1) * 5 * 3600000).toISOString(), Outcome: i === 2 ? 'Failed' : 'Succeeded' } }));
  return { state: 'connected', accounts, posts, history, activity, fetchedAt: new Date(now).toISOString(), errors: {}, truncated: [] };
}

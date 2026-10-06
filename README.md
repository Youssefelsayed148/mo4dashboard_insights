# MO4 Content Hub — standalone deployment

This is a portable Next.js dashboard, independent of ChatGPT sign-in. Airtable remains the central database. The application is read-only and does not publish posts or activate n8n workflows.

## Deploy to Vercel

1. Extract this folder and push it to a **private** Git repository you control. Do not upload node_modules, .next, or real .env files.
2. In Vercel choose Add New → Project → import the repository. Framework: Next.js; root directory: the folder containing package.json. Use the build command already supplied (`npm run build`).
3. Set the following environment variables for the deployment environment:
   - `DASHBOARD_USERNAME`: choose a username for the initial private dashboard.
   - `DASHBOARD_PASSWORD`: generate a unique random password of at least 20 characters. Do not reuse your Airtable or Vercel password.
   - `AIRTABLE_READ_TOKEN`: an Airtable personal access token with **data.records:read** scope and access only to base **app72eKOnd9oaiCyR**. Create it at https://airtable.com/create/tokens. Write scope is unnecessary.
4. Deploy. Open the returned HTTPS deployment URL. Your browser prompts for the dashboard username/password.
5. Confirm Accounts loads, open an existing post, compare media ID and metrics with Airtable, and check Activity. Missing metrics remain unavailable, rather than becoming zero. If the base has no posts, the empty view is expected.
6. Changing Vercel environment variables requires a new deployment to take effect. Do not use NEXT_PUBLIC_ prefixes for secrets.

A personal demo can use Vercel Hobby under its non-commercial rules. MO4 business operations require an appropriate commercial hosting plan; Vercel Hobby is not suitable for this use. No paid subscription has been started. See https://vercel.com/docs/plans/hobby.

## Access and connections

Initial access uses one shared HTTP Basic credential over HTTPS. Missing credentials or a password shorter than 20 characters blocks access. This is suitable for a restricted acceptance demo, not individual user management: add a managed identity provider with a verified MO4 allowlist before broader team rollout. Rotate the shared password by changing the hosting secret and redeploying; browsers may retain old credentials until closed. Vercel's deployment protection may add a separate host-level login.

Airtable secrets are used only in the server route. Former ChatGPT identity headers have no effect. Data is never written to browser local storage. The app requires same-origin requests and does not expose a public Airtable proxy.

## Refresh and limits

The visible page refreshes every two minutes. Server snapshots are cached for one minute per warm instance, and overlapping requests share the same work. Requests are paced to reduce Airtable calls. This cache is not shared between server instances; it does not eliminate Airtable quotas. One fully populated refresh reads up to 20 Airtable pages. Account for Airtable monthly API allowances before wider rollout.

Each of four sources is bounded to 500 records, with a visible partial-total warning when more records exist. Refresh deadline: 45 seconds; Vercel route limit: 60 seconds. A failed source retains previous values in the open page with a stale-data warning. No last-known snapshot is persisted across browser sessions. For network-scale histories, add filtered server pagination and shared caching before relying on complete totals.

The dashboard reflects Airtable's data. It does not replace the n8n insight collection schedule. All workflow activation and live acceptance blockers remain as documented in the implementation bundle.

## Local validation

Use Node 22.13+ (or 24):

```sh
npm install
cp .env.example .env.local
# Set your secrets locally; do not commit them.
npm test
npm run build
npm start
```

This package includes no live tokens, passwords, media files, or account performance records. Deployment and live Airtable acceptance require your hosting account and token.

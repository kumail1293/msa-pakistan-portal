# Deployment

## Always-on hosting budget (USD)

The existing Render Free Blueprint is only for a technical preview. It sleeps,
has an ephemeral filesystem, and is not suitable for a portal expected to stay
available around the clock. A paid service avoids the free-tier idle sleep, but
a single instance and a single database still have failure and maintenance
windows. No small hosting budget can promise literal 100% uptime.

### Recommended staged budget

| Stage | Components | Estimated monthly cost | What it provides |
| --- | --- | ---: | --- |
| Always-on pilot | DigitalOcean App Platform, 1 shared 1 GiB container ($12); DigitalOcean Managed MySQL, 1 GiB single node (from $15, plus storage); Cloudflare R2 within its free allowance; email/monitoring allowance | **Plan for $40–$55** | No idle sleep, managed MySQL, durable external object storage. Still a single app instance and non-HA database. |
| Redundant production target | Two App Platform 1 GiB containers ($24 total); Managed MySQL Standard HA primary and standby (from $30 per node, about $60 compute total, plus storage); R2 and email/monitoring allowance | **Plan for $100–$130** | Redundant app capacity and database failover, after the application supports multiple replicas. |

The prices above are provider list prices checked on **October 24, 2026**.
The pilot baseline is approximately USD $27 before database storage, backups,
email, monitoring, taxes, and usage overages. The production target starts at
about USD $84 before database storage, backups, email, monitoring, taxes, and
usage overages. The monthly planning totals include a reserve for those
variable or separately billed items; confirm the current checkout estimate
before creating resources. At a budgeting exchange rate of PKR 280 per USD,
the recommended production reserve is roughly **PKR 28,000–36,400/month**.
This is a planning conversion, not a live exchange quote; bank rates, taxes,
and international card fees may increase the PKR charge. The domain is
excluded because it is already owned.

The redundant production target is **not deploy-ready with the current
application architecture**. Member accounts and rate limits include
process-local memory, and the email queue processor starts inside each web
instance. Running two replicas before addressing shared state, distributed
rate limiting, and single-run background job processing can cause inconsistent
member state or duplicate email. Keep one web instance until those items are
fixed and tested; budget for two only as the target after that engineering
work.

The recommended host is DigitalOcean App Platform in Singapore with
DigitalOcean Managed MySQL in the same region. The 1 GiB application size is a
starting point for a low-traffic pilot; monitor memory and response times and
move to 2 GiB ($25/container/month) if needed. Managed MySQL Standard HA
requires a matching standby and costs for both nodes; database storage is
additional. Cloudflare R2 currently includes 10 GB-month of Standard storage
and monthly request allowances, then charges by storage and operation volume.
Email cost depends on the chosen transactional provider and delivery volume.

### If approved for Google Workspace for Nonprofits

Google currently lists Workspace for Nonprofits at **$0 per user per month**
for eligible, verified organizations. It includes custom-domain email and
100 TB of pooled storage. This can make staff email and low-volume portal email
cost $0, but it does **not** pay for the app host or MySQL database, and it
does not make the portal highly available.

The application already reads SMTP settings from environment variables. For
low-volume transactional email, a dedicated Workspace mailbox may be
configured with `smtp.gmail.com`, port `587`, TLS, the mailbox address as
`SMTP_USER`, an administrator-allowed Google App Password as `SMTP_PASSWORD`,
and a matching/verified `FROM_EMAIL`. Require 2-Step Verification and verify
that the Workspace administrator permits app passwords. Test password setup,
membership notices, and email queue behavior end to end. Google's Gmail SMTP
limits and anti-abuse policies apply; sending limits can change, and email is
not an uptime guarantee. For larger volumes, use an appropriate transactional
email provider instead.

Workspace Drive's pooled storage is also **not automatically connected** to
the portal's uploads. The current portal's upload helper requires the configured
Forge storage API credentials; its Google Drive engine is currently
process-local, not a persistent Drive API integration. Using Workspace Drive
for member uploads requires a separate Drive API integration, access-control
design, and testing before replacing object storage.

With Workspace covering email, plan roughly **$35–$50/month** for the
always-on pilot and **$95–$125/month** for the redundant production target,
still excluding taxes, card FX fees, and usage overages. Keep a reserve for
managed-database storage/backups and monitoring; the Google nonprofit offer
does not remove those costs.

Price references:

- [DigitalOcean App Platform plans](https://docs.digitalocean.com/products/app-platform/details/pricing/)
- [DigitalOcean MySQL pricing and HA](https://docs.digitalocean.com/products/databases/mysql/details/pricing/)
- [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Google Workspace for Nonprofits offer](https://www.google.com/nonprofits/offerings/workspace/)
- [Google guidance for sending email from apps](https://support.google.com/a/answer/176600)

### Availability requirements before launch

- [ ] Use paid, always-on application hosting; do not use Render Free or any
      other sleeping free instance for the live portal.
- [ ] Use a managed MySQL plan with automatic failover and backups; test a
      restore before storing member data.
- [ ] Keep uploads in durable object storage, not on the application
      filesystem.
- [ ] Configure and test transactional email and uptime/error alerts.
- [ ] Resolve the multi-instance state and background-job issues before
      enabling more than one application replica.
- [ ] Agree an acceptable recovery-point and recovery-time objective. Redundancy
      reduces downtime but does not guarantee zero downtime or zero data loss.

If the organization cannot fund the always-on pilot, keep the free deployment
strictly as a preview with synthetic data. Do not present it as the live,
always-available member portal.

## Free beta deployment (Render + TiDB Cloud Starter)

This repository uses MySQL (`mysql2` and Drizzle's MySQL dialect). SQLite URLs
are not supported by the application database layer. A no-cost technical
preview can use:

- [Render Free Web Services](https://render.com/docs/free) for the Node.js app.
- [TiDB Cloud Starter](https://docs.pingcap.com/tidbcloud/serverless-limitations/)
  with MySQL compatibility for the database. Its published free quota is
  5 GiB row-based storage and 50 million request units per month per eligible
  instance; when the quota is exhausted, new connections are denied until
  usage resets or the quota changes.

**Free-tier limitations:** Render suspends an idle Free Web Service after
15 minutes and the next request can wait about a minute for it to wake. Its
filesystem is ephemeral: local files are lost on restart, redeploy, or sleep.
Render explicitly says not to use Free instances for production applications.
Render may also suspend a Free service for unusually high outbound traffic,
including traffic to an external database or object storage.
Use this setup only for a limited technical beta with synthetic or otherwise
approved test data. Do not upload real CNICs, member documents, photos, or
other sensitive personal information to this free-tier deployment. Review the
platform terms, data location, privacy obligations, and backup/recovery plan
before any real-member pilot.

The app's file-upload helpers require `BUILT_IN_FORGE_API_URL` and
`BUILT_IN_FORGE_API_KEY`; the documented `STORAGE_PROVIDER=local` option does
not configure the current upload implementation. Do not rely on local disk for
uploads on Render Free. Configure the Forge storage credentials before testing
upload-dependent flows, or leave those flows out of the beta.

Render Free blocks outbound SMTP ports 25, 465, and 587. Email delivery
therefore requires an SMTP provider that supports a permitted alternate port
(for example, 2525) and a successful end-to-end test. Without working email,
member password setup links and other transactional email will not be
delivered.

### 1. Create the MySQL-compatible database

1. Create a TiDB Cloud Starter instance with MySQL compatibility. Choose a
   region close to the Render service (Singapore is selected in `render.yaml`
   when available).
2. Create a database for the portal and create/save a database password.
3. In the TiDB Cloud console's **Connect** dialog, configure the public
   endpoint/firewall and use the Node.js/mysql2 connection details. The
   application expects a MySQL connection URL in `DATABASE_URL`, for example:
   `mysql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:4000/portal?ssl=%7B%7D`.
   Replace the placeholders with TiDB's actual values and URL-encode special
   characters in credentials.
   `ssl=%7B%7D` enables mysql2 TLS using the system's trusted CA certificates;
   do not disable certificate verification. Restrict the TiDB public endpoint
   to Render's current outbound IP ranges where supported.
4. Keep the database credentials private. Do not add them to Git or paste them
   into chat.

Before connecting a real beta deployment, confirm the project's generated
Drizzle migrations apply cleanly to the selected TiDB version. Apply them
from a trusted machine with `DATABASE_URL` set to the TiDB connection URL:

```bash
pnpm db:push
```

Back up the database before schema changes. Do not run schema generation as an
automatic Render build step.

### 2. Deploy the application to Render

1. Push the project to a GitHub repository that Render can access.
2. In Render, create a **Blueprint** from the repository. Render reads the
   root [`render.yaml`](../render.yaml), builds the frontend and server, and
   starts the app with `pnpm start`.
3. When prompted, set the secret `DATABASE_URL` to the TiDB MySQL URL. The
   Blueprint generates `JWT_SECRET` and sets `PORTAL_BASE_URL` to
   `https://portal.msapakistan.org`.
4. In the Render service's **Environment** page, add any integration settings
   needed for the flows in scope:
   - `BUILT_IN_FORGE_API_URL` and `BUILT_IN_FORGE_API_KEY` for uploads.
   - `MSAP_APPS_SCRIPT_URL` if membership lookup/sync uses the Apps Script.
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and any required
     sender settings. On Render Free, use a provider-supported SMTP port other
     than 25, 465, or 587; otherwise transactional email will not work.
5. Wait for the deploy to finish. Check the service logs and verify
   `https://<render-service>.onrender.com/health/live` returns HTTP 200.
   `/health/ready` should report the database as `ok`; SMTP may be `degraded`
   if it is not configured.

### 3. Connect `portal.msapakistan.org`

1. In the Render service's **Settings → Custom Domains**, add
   `portal.msapakistan.org`.
2. At the DNS provider for `msapakistan.org`, set a CNAME record:
   - Name/host: `portal`
   - Target/value: the Render service hostname, such as
     `msap-portal.onrender.com` (use the hostname shown by Render).
3. Remove conflicting `A` or `AAAA` records for the `portal` name only. Do not
   change unrelated DNS records for the organization's domain.
4. If using Cloudflare, initially set the CNAME to **DNS only**. Verify the
   domain in Render and wait for its managed TLS certificate to become active.
   After HTTPS works, Cloudflare proxying is optional.
5. Confirm `https://portal.msapakistan.org/health/live` returns HTTP 200 and
   the browser shows a valid HTTPS certificate.

Render Free services sleep when idle and have no persistent filesystem. Keep
the Render-provided hostname as a fallback for initial verification and
expect cold starts on the custom domain.

### Beta launch checklist

- [ ] MySQL-compatible TiDB database is reachable and migrations are applied.
- [ ] Render `/health/ready` reports the database as `ok`.
- [ ] `JWT_SECRET` is generated and stable across deployments.
- [ ] The custom domain resolves to Render and managed HTTPS is active.
- [ ] Password setup/login works with the intended identity source.
- [ ] Email delivery is tested through a port Render Free permits.
- [ ] Uploads are tested with the configured Forge storage credentials, or
      upload-dependent flows are excluded from the beta.
- [ ] Free-tier beta uses only synthetic or explicitly approved test data;
      database backup and restore have been tested.

This is a beta preview architecture, not a production recommendation. Move to
paid, persistent application hosting and a supported database/storage setup
before accepting real member personal data or depending on continuous
availability.

## Environment Setup

### Prerequisites

- Node.js 24+
- MySQL 8.0+
- pnpm

### Environment Variables

```env
# Database
DATABASE_URL=mysql://user:pass@host:3306/dbname

# Authentication
JWT_SECRET=<your-secret>

# Email (SMTP; Render Free blocks ports 25, 465, and 587)
SMTP_HOST=
SMTP_PORT=<provider-supported-port>
SMTP_USER=
SMTP_PASSWORD=

# File uploads (required for upload-dependent flows)
BUILT_IN_FORGE_API_URL=
BUILT_IN_FORGE_API_KEY=

# Portal
PORTAL_BASE_URL=https://portal.msapakistan.org
NODE_ENV=production

# Optional: External Services
SENTRY_DSN=
ANALYTICS_ID=
```

---

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your values

# Push database schema
pnpm db:push

# Generate and apply schema migrations
pnpm db:push

# Start development server
pnpm dev
```

### Available Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm test         # Run tests
pnpm db:push      # Generate and apply Drizzle migrations
```

---

## Production

### Build

```bash
pnpm build
```

### Start

```bash
pnpm start
```

### PM2 (Recommended)

```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    {
      name: "msap-portal",
      script: "dist/index.js",
      env: {
        NODE_ENV: "production",
      },
      instances: "max",
      exec_mode: "cluster",
    },
  ],
};
```

### Docker

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

---

## Database

### Migrations

```bash
# Generate and apply migrations (DATABASE_URL must be set)
pnpm db:push
```

### Backup

```bash
# Dump database
mysqldump -u user -p dbname > backup.sql

# Restore database
mysql -u user -p dbname < backup.sql
```

### Seeding

There is no general-purpose `pnpm seed` script in `package.json`. Seed
organization-specific production data through the supported admin/configuration
flows after verifying the database migrations and access controls.

---

## Monitoring

### Health Check

```
GET /health
```

### Logging

- Structured JSON logs (Pino)
- Request/response logging
- Error tracking (Sentry)

### Metrics (Future)

- Prometheus endpoint
- Request duration
- Error rates
- Database query times

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets in environment variables
- [ ] No secrets in code or git
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS configured properly

### Production

- [ ] Error messages sanitized
- [ ] Logging sanitized (no passwords)
- [ ] Database backups configured
- [ ] Monitoring alerts set up
- [ ] SSL certificates valid

---

## Scaling

### Horizontal

- Multiple instances behind load balancer
- Session store in database (not memory)
- File storage external (S3/GCS)

### Vertical

- Increase server resources
- Optimize database queries
- Add caching layer (Redis)

### Database

- Read replicas for read-heavy workloads
- Connection pooling
- Query optimization

---

## Rollback

### Application

1. Keep previous version deployed
2. Switch traffic to previous version
3. Investigate and fix

### Database

1. Run rollback migration
2. Or restore from backup
3. Verify data integrity

# Deployment

## Environment Setup

### Prerequisites
- Node.js 18+
- MySQL 8.0+
- pnpm

### Environment Variables
```env
# Database
DATABASE_URL=mysql://user:pass@host:3306/dbname

# Authentication
JWT_SECRET=<your-secret>

# Email (SMTP)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=

# Storage
STORAGE_PROVIDER=local  # or "s3", "gcs"
STORAGE_BUCKET=
STORAGE_ACCESS_KEY=
STORAGE_SECRET_KEY=

# Portal
PORTAL_BASE_URL=https://yourdomain.com
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

# Seed default data
pnpm seed

# Start development server
pnpm dev
```

### Available Commands
```bash
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm start        # Start production server
pnpm test         # Run tests
pnpm db:push      # Push schema changes
pnpm db:generate  # Generate migrations
pnpm db:migrate   # Run migrations
pnpm db:studio    # Open Drizzle Studio
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
  apps: [{
    name: "msap-portal",
    script: "dist/server/index.js",
    env: {
      NODE_ENV: "production",
    },
    instances: "max",
    exec_mode: "cluster",
  }],
};
```

### Docker
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server/index.js"]
```

---

## Database

### Migrations
```bash
# Generate migration from schema changes
pnpm db:generate

# Apply migrations
pnpm db:migrate

# Open Drizzle Studio (visual DB browser)
pnpm db:studio
```

### Backup
```bash
# Dump database
mysqldump -u user -p dbname > backup.sql

# Restore database
mysql -u user -p dbname < backup.sql
```

### Seeding
```bash
# Seed default configuration, roles, permissions
pnpm seed
```

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

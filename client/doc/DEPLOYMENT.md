# Deployment Guide

## Overview

This guide covers deploying wsx to production. The application consists of:
- **Frontend**: React SPA (Vite build)
- **Backend**: Node.js or Go WebSocket server
- **Storage**: Upstash Redis for message history

## Deployment Options

### Recommended Stack

- **Frontend**: Vercel (or Netlify)
- **Backend**: Railway (or Render, Fly.io)
- **Redis**: Upstash (integrated with Railway)

## Frontend Deployment (Vercel)

### Prerequisites

- Vercel account
- Git repository (GitHub, GitLab, or Bitbucket)

### Steps

1. **Install Vercel CLI**
```bash
npm install -g vercel
```

2. **Build Configuration**

Create `vercel.json` in the project root:
```json
{
  "buildCommand": "cd client && npm run build",
  "outputDirectory": "client/dist",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

3. **Deploy**
```bash
vercel
```

4. **Configure Environment Variables**

In Vercel dashboard, add:
```
VITE_API_URL=https://your-backend-url.railway.app
VITE_WS_URL=wss://your-backend-url.railway.app
```

5. **Configure Domains**

Add your custom domain in Vercel dashboard.

### Alternative: Manual Deployment

1. **Build**
```bash
cd client
npm run build
```

2. **Upload**

Upload `client/dist/` to your hosting provider (Netlify, AWS S3 + CloudFront, etc.)

3. **Configure SPA Fallback**

Ensure your hosting serves `index.html` for all routes.

## Backend Deployment (Railway)

### Prerequisites

- Railway account
- Upstash Redis database

### Steps

1. **Create New Project**

In Railway dashboard, click "New Project" → "Deploy from GitHub repo"

2. **Select Repository**

Connect your GitHub repository and select it.

3. **Configure Service**

**Node.js Backend:**
- Root directory: `server`
- Start command: `npm start`
- Build command: `npm run build`

**Go Backend:**
- Root directory: `backend-go`
- Start command: `./wsx-server`
- Build command: `go build -o wsx-server .`

4. **Add Environment Variables**

```bash
PORT=8080
ALLOWED_ORIGINS=https://your-frontend-domain.vercel.app,https://yourdomain.com
ENCRYPTION_KEY=your-64-char-hex-key
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
DEBUG=false
```

5. **Add Upstash Redis**

- In Railway project, click "New Service" → "Add Upstash Redis"
- Or use existing Upstash database
- Copy REST URL and token to environment variables

6. **Deploy**

Click "Deploy" to deploy your backend.

7. **Get Backend URL**

Railway provides a URL like `https://your-project.railway.app`

Update frontend environment variables with this URL.

## Backend Deployment (Render)

### Prerequisites

- Render account
- Upstash Redis database

### Steps

1. **Create New Web Service**

In Render dashboard, click "New +" → "Web Service"

2. **Connect Repository**

Connect your GitHub repository.

3. **Configure Service**

**Node.js Backend:**
- Root directory: `server`
- Build command: `npm run build`
- Start command: `npm start`

**Go Backend:**
- Root directory: `backend-go`
- Build command: `go build -o wsx-server .`
- Start command: `./wsx-server`

4. **Add Environment Variables**

Same as Railway configuration.

5. **Deploy**

Click "Create Web Service"

## Backend Deployment (Fly.io)

### Prerequisites

- Fly.io CLI
- Upstash Redis database

### Steps

1. **Install Fly CLI**
```bash
curl -L https://fly.io/install.sh | sh
```

2. **Login**
```bash
flyctl auth login
```

3. **Initialize**

**Node.js:**
```bash
cd server
flyctl launch
```

**Go:**
```bash
cd backend-go
flyctl launch
```

4. **Configure fly.toml**

```toml
app = "your-app-name"

[build]
  # For Node.js
  dockerfile = "Dockerfile"
  
  # For Go (if using Go build)
  # builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8080"
  ALLOWED_ORIGINS = "https://your-frontend-domain.vercel.app"
  ENCRYPTION_KEY = "your-64-char-hex-key"
  UPSTASH_REDIS_REST_URL = "your-upstash-url"
  UPSTASH_REDIS_REST_TOKEN = "your-upstash-token"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.tcp_checks]]
    interval = 60
    grace_period = "5s"
    timeout = "5s"
```

5. **Deploy**
```bash
flyctl deploy
```

## Upstash Redis Setup

### Create Database

1. Go to [Upstash Console](https://console.upstash.com)
2. Click "Create Database"
3. Select region (close to your backend)
4. Click "Create"

### Get Credentials

- REST URL: In database dashboard, click "REST API"
- Token: Copy the REST token

### Configure Backend

Add to environment variables:
```bash
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

### Enable TLS

Upstash Redis uses TLS by default. No additional configuration needed.

## Docker Deployment

### Node.js Backend Dockerfile

Create `server/Dockerfile`:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production
COPY --from=builder /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

### Go Backend Dockerfile

Create `backend-go/Dockerfile`:
```dockerfile
FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN go build -o wsx-server .

FROM alpine:latest AS runner
WORKDIR /app
COPY --from=builder /app/wsx-server .
ENV PORT=8080
EXPOSE 8080
CMD ["./wsx-server"]
```

### Build and Run

```bash
# Build image
docker build -t wsx-server .

# Run container
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e ALLOWED_ORIGINS=https://yourdomain.com \
  -e ENCRYPTION_KEY=your-key \
  -e UPSTASH_REDIS_REST_URL=your-url \
  -e UPSTASH_REDIS_REST_TOKEN=your-token \
  wsx-server
```

## Environment Variables

### Production Checklist

```bash
# Required
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
PORT=8080

# Required for history
ENCRYPTION_KEY=64-char-hex-string
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Optional
DEBUG=false
```

### Frontend Environment Variables (Vercel)

```bash
VITE_API_URL=https://your-backend.railway.app
VITE_WS_URL=wss://your-backend.railway.app
```

## SSL/TLS Configuration

### Railway

- Automatic SSL/TLS provided
- HTTPS enabled by default

### Render
- Automatic SSL/TLS provided
- HTTPS enabled by default

### Fly.io
- Automatic SSL/TLS provided
- HTTPS enabled by default

### Custom Domain SSL

For custom domains:
1. Configure DNS (CNAME record)
2. Platform provisions SSL certificate automatically
- Railway: Automatic via Let's Encrypt
- Render: Automatic via Let's Encrypt
- Fly.io: Automatic via Let's Encrypt

## Monitoring

### Health Checks

Backend provides `/health` endpoint:
```bash
curl https://your-backend.railway.app/health
```

Response:
```json
{
  "status": "ok",
  "redis": "connected",
  "history": "enabled"
}
```

### Railway Monitoring

- Built-in metrics in Railway dashboard
- View logs in real-time
- Set up alerts for errors

### Render Monitoring

- Built-in metrics in Render dashboard
- View logs in real-time
- Set up alerts for errors

### Upstash Monitoring

- View Redis metrics in Upstash console
- Monitor memory usage
- Monitor connection count

## Scaling

### Vertical Scaling

**Railway:**
- Upgrade plan for more CPU/RAM
- Adjust in service settings

**Render:**
- Upgrade plan for more CPU/RAM
- Adjust in service settings

### Horizontal Scaling

**Node.js:**
- Use Railway's multiple instances
- Add load balancer (optional)

**Go:**
- Use Railway's multiple instances
- Go handles concurrency natively

### Redis Scaling

Upstash scales automatically:
- No manual scaling needed
- Pay per request

## Security Best Practices

### Production Checklist

- [ ] Use strong `ENCRYPTION_KEY` (64 hex chars)
- [ ] Set `ALLOWED_ORIGINS` to your domains only
- [ ] Enable HTTPS (automatic on Railway/Render/Fly)
- [ ] Disable `DEBUG` in production
- [ ] Use environment-specific configs
- [ ] Rotate encryption keys periodically
- [ ] Monitor Redis for unauthorized access
- [ ] Set up rate limiting (enabled by default)
- [ ] Use health checks for load balancer
- [ ] Configure backup strategy

### Firewall Rules

- Allow inbound HTTP/HTTPS (port 80, 443)
- Allow inbound WebSocket (same as HTTP)
- Block direct Redis access (use REST API)

### Secrets Management

- Never commit `.env` files
- Use platform secret management
- Rotate secrets regularly
- Use different keys per environment

## Troubleshooting

### WebSocket Connection Fails

**Symptom:** WebSocket connection fails in production

**Solutions:**
1. Check `ALLOWED_ORIGINS` includes frontend domain
2. Verify backend is accessible (curl health endpoint)
3. Check firewall allows WebSocket
4. Verify SSL certificate is valid

### Redis Connection Fails

**Symptom:** History disabled despite valid credentials

**Solutions:**
1. Verify `UPSTASH_REDIS_REST_URL` is correct
2. Verify `UPSTASH_REDIS_REST_TOKEN` is correct
3. Check Upstash database status
4. Test connection manually

### Build Fails

**Symptom:** Build fails on deployment

**Solutions:**
1. Check build logs for specific error
2. Verify all dependencies are in package.json
3. Ensure Node.js/Go version compatibility
4. Check for missing environment variables

### Performance Issues

**Symptom:** Slow response times

**Solutions:**
1. Check resource usage (CPU/RAM)
2. Scale up if needed
3. Check Redis latency
4. Optimize database queries

## Cost Estimation

### Frontend (Vercel)

- **Hobby**: Free
- **Pro**: $20/month
- Includes: SSL, CDN, automatic deployments

### Backend (Railway)

- **Free**: $5/month credit
- **Standard**: $5/month per service
- Includes: SSL, auto-scaling, logs

### Redis (Upstash)

- **Free**: 10K commands/day
- **Paid**: $0.20 per 1M commands
- Includes: TLS, auto-scaling

### Total Estimated Cost

**Small deployment:** ~$5-10/month
**Medium deployment:** ~$20-30/month
**Large deployment:** $50+/month

## CI/CD

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          working-directory: ./client

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: railwayapp/cli@v1.0
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}
          service: your-service-name
          command: up
```

## Rollback

### Vercel Rollback

1. Go to Vercel dashboard
2. Select deployment
3. Click "Rollback"

### Railway Rollback

1. Go to Railway dashboard
2. Select deployment
3. Click "Redeploy" with previous commit

### Database Rollback

Upstash doesn't support snapshots. For critical data:
- Consider periodic exports
- Use Redis persistence if needed

## Maintenance

### Regular Tasks

- **Weekly**: Check logs for errors
- **Monthly**: Review usage and costs
- **Quarterly**: Rotate encryption keys
- **As needed**: Update dependencies

### Dependency Updates

**Node.js:**
```bash
npm audit
npm update
```

**Go:**
```bash
go get -u ./...
go mod tidy
```

## Support

- **Documentation**: See [README](./README.md)
- **Architecture**: See [Architecture](./ARCHITECTURE.md)
- **API**: See [API Reference](./API.md)
- **WebSocket**: See [WebSocket Protocol](./WEBSOCKET_PROTOCOL.md)

---
name: deploy-dressapp
description: >
  Deployment and DevOps skill for DressApp. Use this skill whenever the user asks
  about deploying DressApp, setting up the VPS, Docker configuration, Caddy TLS,
  MongoDB Atlas setup, environment variables, scaling, backups, or troubleshooting
  production issues. Triggers include: "deploy", "how to deploy", "set up server",
  "Docker compose", "Caddy config", "MongoDB setup", "production environment",
  "VPS setup", "scaling", "backup", "troubleshoot production", "deploy to Hetzner",
  "deploy to VPS", "production deploy", "go live", "DNS setup", "SSL certificate",
  "HTTPS setup", "docker compose up", "redeploy", "restart server", "check logs",
  "production logs", "model warm-up", "swap file", "OOM", "out of memory".
---

# DressApp Deployment Guide

You are a DevOps engineer for the DressApp project. Your job is to help with
deployment, server setup, Docker configuration, and production troubleshooting.

---

## Quick Reference

**Target**: Single VPS (Hetzner CX22 or larger), docker-compose, Caddy for automatic HTTPS, MongoDB Atlas M0 tier.

**Architecture**:
```
dressapp.co (port 443)
    │
    ▼
  caddy (TLS)
    │
    ├── /api/* → backend (FastAPI + SegFormer, :8001)
    └── /*     → frontend (nginx + CRA bundle, :3000)

  backend → mongodb+srv (MongoDB Atlas M0)
```

---

## Deployment Steps

### 1. Server Setup
- Create Ubuntu 24.04 server (Hetzner CX22 recommended: 2 vCPU / 4 GB RAM / 40 GB NVMe)
- SSH in: `ssh root@<IP>`

### 2. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker compose version
```

### 3. DNS
- Point domain A record to VPS IPv4
- Verify: `dig +short dressapp.co @1.1.1.1`

### 4. MongoDB Atlas
- Sign up at https://cloud.mongodb.com
- Build M0 (free) database
- Add user in Database Access
- Set Network Access to VPS IP
- Copy Python driver URI

### 5. Pull Code
```bash
cd /srv
git clone https://github.com/Yoram-Jacobs/AI-Stylist.git
cd AI-Stylist
```

### 6. Environment Variables
```bash
cp deploy/.env.example deploy/.env
$EDITOR deploy/.env
```

**Required fields**: DOMAIN, CADDY_ACME_EMAIL, MONGO_URL, DB_NAME, JWT_SECRET, GEMINI_API_KEY, PAYPAL_*, GOOGLE_OAUTH_*, GROQ_API_KEY, OPENWEATHER_API_KEY.

### 7. Build & Launch
```bash
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

### 8. Post-Launch
- Add Google OAuth redirect URI: `https://dressapp.co/api/v1/auth/google/callback`
- Set PayPal webhook URL: `https://dressapp.co/api/v1/paypal/webhook`
- Warm models: `docker compose exec backend curl -sS -o /dev/null -X POST http://127.0.0.1:8001/api/v1/closet/warm || true`

---

## Day-2 Operations

### View Logs
```bash
docker compose -f deploy/docker-compose.yml logs -f backend
docker compose -f deploy/docker-compose.yml logs -f caddy
```

### Redeploy
```bash
cd /srv/dressapp
git pull
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --build
```

### Free Disk
```bash
docker image prune -f
```

### Reset Model Cache
```bash
docker compose -f deploy/docker-compose.yml down
docker volume rm dressapp_model-cache dressapp_rembg-cache
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d
```

---

## Scaling

- Single CX22 supports ~20 concurrent users
- For more: duplicate backend service + Caddy load balancing
- Or upgrade to CX32 (4 vCPU / 8 GB)
- Or deploy inference server on separate GPU box

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Caddy certificate_obtain_failed | DNS not propagated, or ports 80/443 blocked |
| Backend OOM | Add swap, upgrade, or disable vision models (`USE_LOCAL_CLOTHING_PARSER=false`) |
| analyze 500s | Check `.env` for missing EMERGENT_LLM_KEY or MONGO_URL |
| pymongo InvalidURI | Fix trailing `&appName` in MONGO_URL |
| pymongo bad auth | Reset Atlas user password |
| Mongo timeout | Add VPS IP to Atlas Network Access |
| OAuth redirect_uri_mismatch | Add callback URL to Google Cloud Console |
| PayPal 401 | Copy correct webhook ID from PayPal dashboard |
| ERR_BLOCKED_BY_CLIENT | Ad blocker blocking `/ads/` path |
| docker compose command missing | Install compose plugin manually |

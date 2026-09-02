---
name: local-deploy
description: >
  Local container deployment and testing guide for DressApp using WSL.
  Triggers include: "local-deploy", "local deploy", "local containers",
  "wsl deploy", "docker compose local", "run local docker", "local docker run".
---

# DressApp Local Container Deployment Guide

This skill guides the local container deployment and testing of DressApp inside Windows Subsystem for Linux (WSL) using Docker Compose.

---

## Local Setup Overview

To test DressApp containerized locally without SSL/Caddy configuration errors, we run the FastAPI backend and React frontend in Docker, bypass the Caddy reverse-proxy, and map container ports directly to the host machine.

### Ports and Integration:
* **Frontend:** maps to `http://localhost:3000` (which matches Google OAuth authorized redirect URIs).
* **Backend:** maps to `http://localhost:8001`.

---

## Step-by-Step Deployment Instructions

### 1. Free Up Local Ports on Host (Windows)
Before starting the containers, ensure that ports `3000` and `8001` are not being used by host-level dev servers. Run the following commands in **Windows PowerShell**:

```powershell
# Stop any host processes using port 3000 (React)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess -Force -ErrorAction SilentlyContinue

# Stop any host processes using port 8001 (FastAPI)
Stop-Process -Id (Get-NetTCPConnection -LocalPort 8001).OwningProcess -Force -ErrorAction SilentlyContinue
```

### 2. Configure Local Docker Compose Override
Create or verify the override file at `deploy/docker-compose.override.yml` to bind the container ports directly to the Windows host:

```yaml
services:
  backend:
    ports:
      - "8001:8001"
  frontend:
    build:
      args:
        # Bake localhost backend URL into the React build inside Docker
        REACT_APP_BACKEND_URL: http://localhost:8001
    ports:
      - "3000:3000"
```

### 3. Launch Containers inside the WSL Terminal
Since Docker on Windows is typically integrated with WSL, run these commands inside your **WSL terminal**:

```bash
# Navigate to the deploy folder via the mounted C drive path
cd /mnt/c/DressApp_AG/deploy

# Build and start the backend and frontend containers
docker compose up backend frontend --build
```
*(By specifying `backend frontend`, we avoid launching resources like `caddy` and `eyes` which are not needed for standard local testing).*

---

## Verification & Testing

1. **Verify Services:**
   * Open `http://localhost:3000` in your web browser.
   * Verify the API is responding at `http://localhost:8001/api/`.

2. **Sign In:**
   * **Option A (Google OAuth):** Since the frontend is running on the default port `3000`, click **Continue with Google** to sign in.
   * **Option B (Dev Bypass):** Click the **"Continue as dev user"** button at the bottom of the card to bypass OAuth login instantly.

---
name: deploy
description: Accesses the production server via SSH to pull the latest AI-Stylist changes and rebuild the Docker Compose stack.
---

# Deploy — Quick Remote Deploy

Because the SSH keys are configured inside the WSL terminal, you must use `wsl` to execute the remote deployment commands. 

Run the following command in the terminal to deploy:

```powershell
wsl ssh root@178.105.144.142 "cd /srv/AI-Stylist && git pull origin main && cd deploy && docker compose up -d --build"
```

#!/bin/bash
# ==============================================================================
# DressApp On-Prem MongoDB Nightly Backup Script
# Creates a compressed mongodump archive in /srv/AI-Stylist/deploy/backups/
# and retains the last 7 daily copies.
# ==============================================================================
set -euo pipefail

DEPLOY_DIR="/srv/AI-Stylist/deploy"
BACKUP_DIR="${DEPLOY_DIR}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/dressapp_backup_${TIMESTAMP}.gz"

mkdir -p "${BACKUP_DIR}"
chmod 777 "${BACKUP_DIR}"

MONGO_PASS=$(grep '^MONGO_ROOT_PASSWORD=' "${DEPLOY_DIR}/.env" | cut -d= -f2-)

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Starting MongoDB backup..."

docker run --rm \
  --network dressapp_dress \
  -v "${BACKUP_DIR}:/backup" \
  mongo:7 \
  mongodump \
  --uri="mongodb://dressapp:${MONGO_PASS}@dressapp-mongo:27017/dressapp?authSource=admin" \
  --db=dressapp \
  --archive="/backup/dressapp_backup_${TIMESTAMP}.gz" \
  --gzip

echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Backup completed: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Prune backups older than 7 days
find "${BACKUP_DIR}" -name "dressapp_backup_*.gz" -type f -mtime +7 -delete
echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Pruned backups older than 7 days."

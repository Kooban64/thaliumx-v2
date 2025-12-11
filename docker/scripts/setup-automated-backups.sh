#!/bin/bash
# ===========================================
# ThaliumX Automated Backup Setup
# ===========================================
# Sets up automated backups using cron

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_SCRIPT="${SCRIPT_DIR}/backup-all.sh"
BACKUP_DIR="/opt/thaliumx/backups"
LOG_DIR="/var/log/thaliumx"
CRON_FILE="/etc/cron.d/thaliumx-backup"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BLUE}=== ThaliumX Automated Backup Setup ===${NC}"
echo ""

# Create directories
echo "Creating backup directories..."
sudo mkdir -p "${BACKUP_DIR}"
sudo mkdir -p "${LOG_DIR}"
sudo chown -R $(whoami):$(whoami) "${BACKUP_DIR}"
sudo chown -R $(whoami):$(whoami) "${LOG_DIR}"
echo -e "  ${GREEN}✓ Directories created${NC}"

# Make backup script executable
chmod +x "${BACKUP_SCRIPT}"
echo -e "  ${GREEN}✓ Backup script made executable${NC}"

# Create cron job
echo ""
echo "Setting up cron jobs..."

# Create cron file
sudo tee "${CRON_FILE}" > /dev/null << EOF
# ThaliumX Automated Backups
# Generated on $(date)
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin
BACKUP_BASE_DIR=${BACKUP_DIR}

# Daily backup at 2:00 AM
0 2 * * * root ${BACKUP_SCRIPT} >> ${LOG_DIR}/backup.log 2>&1

# Weekly full backup on Sunday at 3:00 AM
0 3 * * 0 root ${BACKUP_SCRIPT} >> ${LOG_DIR}/backup-weekly.log 2>&1

# Cleanup old backups (keep 7 days of daily, 4 weeks of weekly)
0 4 * * * root find ${BACKUP_DIR} -name "thaliumx_backup_*.tar.gz" -mtime +7 -delete >> ${LOG_DIR}/backup-cleanup.log 2>&1
EOF

sudo chmod 644 "${CRON_FILE}"
echo -e "  ${GREEN}✓ Cron job created at ${CRON_FILE}${NC}"

# Create logrotate configuration
echo ""
echo "Setting up log rotation..."

sudo tee /etc/logrotate.d/thaliumx-backup > /dev/null << EOF
${LOG_DIR}/backup*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 0640 root root
}
EOF

echo -e "  ${GREEN}✓ Log rotation configured${NC}"

# Create backup status script
echo ""
echo "Creating backup status script..."

cat > "${SCRIPT_DIR}/backup-status.sh" << 'STATUSEOF'
#!/bin/bash
# ThaliumX Backup Status

BACKUP_DIR="${BACKUP_BASE_DIR:-/opt/thaliumx/backups}"

echo "=== ThaliumX Backup Status ==="
echo ""
echo "Backup Directory: ${BACKUP_DIR}"
echo ""

if [ -d "${BACKUP_DIR}" ]; then
    echo "Recent Backups:"
    ls -lht "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | head -10 || echo "  No backups found"
    echo ""
    echo "Disk Usage:"
    du -sh "${BACKUP_DIR}" 2>/dev/null || echo "  Unable to calculate"
    echo ""
    echo "Total Backups: $(ls -1 "${BACKUP_DIR}"/*.tar.gz 2>/dev/null | wc -l)"
else
    echo "Backup directory does not exist!"
fi
STATUSEOF

chmod +x "${SCRIPT_DIR}/backup-status.sh"
echo -e "  ${GREEN}✓ Status script created${NC}"

# Create restore script wrapper
echo ""
echo "Creating restore helper..."

cat > "${SCRIPT_DIR}/restore-latest.sh" << 'RESTOREEOF'
#!/bin/bash
# ThaliumX Restore Latest Backup

BACKUP_DIR="${BACKUP_BASE_DIR:-/opt/thaliumx/backups}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== ThaliumX Restore Latest Backup ==="
echo ""

LATEST_BACKUP=$(ls -t "${BACKUP_DIR}"/thaliumx_backup_*.tar.gz 2>/dev/null | head -1)

if [ -z "${LATEST_BACKUP}" ]; then
    echo "No backups found in ${BACKUP_DIR}"
    exit 1
fi

echo "Latest backup: ${LATEST_BACKUP}"
echo ""
read -p "Are you sure you want to restore this backup? (yes/no): " CONFIRM

if [ "${CONFIRM}" == "yes" ]; then
    echo "Restoring..."
    "${SCRIPT_DIR}/restore-backup.sh" "${LATEST_BACKUP}"
else
    echo "Restore cancelled."
fi
RESTOREEOF

chmod +x "${SCRIPT_DIR}/restore-latest.sh"
echo -e "  ${GREEN}✓ Restore helper created${NC}"

# Run initial backup
echo ""
echo -e "${YELLOW}Running initial backup...${NC}"
BACKUP_BASE_DIR="${BACKUP_DIR}" "${BACKUP_SCRIPT}" || echo -e "${YELLOW}Initial backup completed with warnings${NC}"

# Summary
echo ""
echo -e "${GREEN}=== Automated Backup Setup Complete ===${NC}"
echo ""
echo "Backup Schedule:"
echo "  - Daily backup: 2:00 AM"
echo "  - Weekly backup: Sunday 3:00 AM"
echo "  - Cleanup: Daily at 4:00 AM (keeps 7 days)"
echo ""
echo "Backup Location: ${BACKUP_DIR}"
echo "Log Location: ${LOG_DIR}"
echo ""
echo "Commands:"
echo "  - Check status: ${SCRIPT_DIR}/backup-status.sh"
echo "  - Manual backup: ${BACKUP_SCRIPT}"
echo "  - Restore latest: ${SCRIPT_DIR}/restore-latest.sh"
echo ""
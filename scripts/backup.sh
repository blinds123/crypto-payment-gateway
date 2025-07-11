#!/bin/bash

# Production Backup Script
# Creates backups of critical application data

# Configuration
BACKUP_DIR="/var/backups/crypto-gateway"
APP_DIR="/home/ubuntu/crypto-payment-gateway"
RETENTION_DAYS=30
S3_BUCKET="${S3_BUCKET:-your-backup-bucket}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup process..."
echo "Timestamp: $TIMESTAMP"

# Backup environment files
echo "Backing up environment configuration..."
mkdir -p "$BACKUP_DIR/env"
cp "$APP_DIR/.env" "$BACKUP_DIR/env/.env.$TIMESTAMP" 2>/dev/null || echo "No .env file found"
cp "$APP_DIR/.env.production" "$BACKUP_DIR/env/.env.production.$TIMESTAMP" 2>/dev/null

# Backup logs
echo "Backing up logs..."
mkdir -p "$BACKUP_DIR/logs"
if [ -d "$APP_DIR/logs" ]; then
    tar -czf "$BACKUP_DIR/logs/logs_$TIMESTAMP.tar.gz" -C "$APP_DIR" logs/
fi

# Backup PM2 configuration
echo "Backing up PM2 configuration..."
mkdir -p "$BACKUP_DIR/pm2"
pm2 save
cp ~/.pm2/dump.pm2 "$BACKUP_DIR/pm2/dump_$TIMESTAMP.pm2" 2>/dev/null

# Backup database (if applicable)
if [ -n "$DATABASE_URL" ]; then
    echo "Backing up database..."
    mkdir -p "$BACKUP_DIR/database"
    pg_dump "$DATABASE_URL" > "$BACKUP_DIR/database/db_$TIMESTAMP.sql"
    gzip "$BACKUP_DIR/database/db_$TIMESTAMP.sql"
fi

# Create master backup archive
echo "Creating master backup archive..."
cd "$BACKUP_DIR"
tar -czf "crypto_gateway_backup_$TIMESTAMP.tar.gz" \
    env/.env.$TIMESTAMP \
    env/.env.production.$TIMESTAMP \
    logs/logs_$TIMESTAMP.tar.gz \
    pm2/dump_$TIMESTAMP.pm2 \
    $([ -f "database/db_$TIMESTAMP.sql.gz" ] && echo "database/db_$TIMESTAMP.sql.gz")

# Upload to S3 (if configured)
if command -v aws &> /dev/null && [ -n "$S3_BUCKET" ]; then
    echo "Uploading to S3..."
    aws s3 cp "crypto_gateway_backup_$TIMESTAMP.tar.gz" "s3://$S3_BUCKET/backups/"
    if [ $? -eq 0 ]; then
        echo "Backup uploaded to S3 successfully"
    else
        echo "Failed to upload backup to S3"
    fi
fi

# Clean up old backups
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "crypto_gateway_backup_*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/env" -name ".env.*" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/logs" -name "logs_*.tar.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/pm2" -name "dump_*.pm2" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR/database" -name "db_*.sql.gz" -mtime +$RETENTION_DAYS -delete 2>/dev/null

# Report backup status
BACKUP_SIZE=$(du -h "crypto_gateway_backup_$TIMESTAMP.tar.gz" | cut -f1)
echo "================================="
echo "Backup completed successfully!"
echo "File: crypto_gateway_backup_$TIMESTAMP.tar.gz"
echo "Size: $BACKUP_SIZE"
echo "Location: $BACKUP_DIR"
echo "Retention: $RETENTION_DAYS days"
echo "================================="

# Create backup report
cat > "$BACKUP_DIR/backup_report_$TIMESTAMP.txt" <<EOF
Backup Report
=============
Date: $(date)
Timestamp: $TIMESTAMP
Backup File: crypto_gateway_backup_$TIMESTAMP.tar.gz
Size: $BACKUP_SIZE
Components:
- Environment configuration
- Application logs
- PM2 configuration
$([ -f "database/db_$TIMESTAMP.sql.gz" ] && echo "- Database dump")
S3 Upload: $([ -n "$S3_BUCKET" ] && echo "Yes - s3://$S3_BUCKET/backups/" || echo "No")
Retention Period: $RETENTION_DAYS days
EOF

echo "Backup report saved to: $BACKUP_DIR/backup_report_$TIMESTAMP.txt"
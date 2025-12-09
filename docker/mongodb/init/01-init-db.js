// MongoDB initialization script for Thaliumx
// This script runs on first container startup

// Switch to admin database to create application user
db = db.getSiblingDB('admin');

// Create application user with readWrite access to thaliumx database
db.createUser({
  user: 'thaliumx',
  pwd: 'ThaliumX2025',
  roles: [
    { role: 'readWrite', db: 'thaliumx' },
    { role: 'readWrite', db: 'thaliumx_audit' },
    { role: 'readWrite', db: 'thaliumx_fintech' },
    { role: 'dbAdmin', db: 'thaliumx' }
  ]
});

// Switch to thaliumx database
db = db.getSiblingDB('thaliumx');

// Create initial collections with validation schemas
db.createCollection('audit_logs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['timestamp', 'action', 'service'],
      properties: {
        timestamp: {
          bsonType: 'date',
          description: 'Timestamp of the audit event'
        },
        action: {
          bsonType: 'string',
          description: 'Action performed'
        },
        service: {
          bsonType: 'string',
          description: 'Service that generated the event'
        },
        userId: {
          bsonType: 'string',
          description: 'User ID if applicable'
        },
        metadata: {
          bsonType: 'object',
          description: 'Additional metadata'
        }
      }
    }
  }
});

// Create indexes for audit_logs
db.audit_logs.createIndex({ timestamp: -1 });
db.audit_logs.createIndex({ service: 1, timestamp: -1 });
db.audit_logs.createIndex({ userId: 1, timestamp: -1 });

// Create documents collection for flexible document storage
db.createCollection('documents');
db.documents.createIndex({ createdAt: -1 });
db.documents.createIndex({ type: 1 });
db.documents.createIndex({ 'metadata.tenantId': 1 });

// Create configurations collection
db.createCollection('configurations');
db.configurations.createIndex({ key: 1 }, { unique: true });
db.configurations.createIndex({ service: 1 });

// Create notifications collection
db.createCollection('notifications');
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ read: 1, createdAt: -1 });
db.notifications.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

print('Thaliumx MongoDB initialization completed successfully');
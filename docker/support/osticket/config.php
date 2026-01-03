<?php
// osTicket Configuration for ThaliumX
// Integrated with Live Helper Chat for escalation

// Database configuration
define('DBTYPE', 'postgres');
define('DBHOST', getenv('DB_HOST') ?: 'thaliumx-support-postgres');
define('DBNAME', getenv('DB_NAME') ?: 'support');
define('DBUSER', getenv('DB_USER') ?: 'support');
define('DBPASS', getenv('DB_PASS') ?: '');

// Site configuration
define('OST_WEB_ROOT', '/');
define('OST_ROOT_PATH', '/var/www/html');
define('SECRET_SALT', getenv('OSTICKET_SECRET_SALT') ?: 'change-this-in-production');

// Zitadel OIDC Configuration
define('AUTH_BACKEND', 'zitadel');
define('ZITADEL_ISSUER', 'https://auth.thaliumx.com');
define('ZITADEL_CLIENT_ID', getenv('ZITADEL_CLIENT_ID') ?: '');
define('ZITADEL_CLIENT_SECRET', getenv('ZITADEL_CLIENT_SECRET') ?: '');
define('ZITADEL_REDIRECT_URI', 'https://tickets.thaliumx.com/api/auth/callback');

// Email configuration
define('MAIL_FROM', 'noreply@thaliumx.com');
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'mailhog');
define('SMTP_PORT', getenv('SMTP_PORT') ?: 1025);
define('SMTP_AUTH', false);

// Ticket settings
define('DEFAULT_PRIORITY', 2); // Normal
define('AUTO_ASSIGN', true);
define('ESCALATION_HOURS', 24);

// Custom fields for trading issues
define('CUSTOM_FIELDS', [
    'trading_pair' => 'Trading Pair',
    'order_id' => 'Order ID',
    'transaction_hash' => 'Transaction Hash',
    'exchange' => 'Exchange',
    'issue_type' => 'Issue Type'
]);

// SLA Configuration
define('SLA_LEVELS', [
    'critical' => ['response' => 1, 'resolution' => 4], // hours
    'high' => ['response' => 4, 'resolution' => 24],
    'normal' => ['response' => 24, 'resolution' => 72],
    'low' => ['response' => 72, 'resolution' => 168]
]);

// Integration with Live Helper Chat
define('LHC_INTEGRATION_ENABLED', true);
define('LHC_API_URL', 'http://thaliumx-live-helper-chat');
define('LHC_API_KEY', getenv('LHC_API_KEY') ?: '');

// Audit and compliance
define('AUDIT_LOG_ENABLED', true);
define('DATA_RETENTION_DAYS', 2555); // 7 years for financial data

// Security settings
define('FORCE_HTTPS', true);
define('SESSION_TIMEOUT', 3600); // 1 hour
define('MAX_LOGIN_ATTEMPTS', 5);
define('LOCKOUT_DURATION', 900); // 15 minutes

// File attachments
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB
define('ALLOWED_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx', 'txt', 'zip']);

// Redis cache
define('REDIS_ENABLED', true);
define('REDIS_HOST', 'thaliumx-redis');
define('REDIS_PORT', 6379);

// Admin notification settings
define('ADMIN_EMAIL', 'admin@thaliumx.com');
define('NOTIFICATION_EVENTS', [
    'ticket.created',
    'ticket.escalated',
    'sla.breached'
]);
?>
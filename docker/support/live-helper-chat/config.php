<?php
// Live Helper Chat Configuration for ThaliumX
// Integrated with Keycloak OIDC

// Database configuration
define('DB_HOST', getenv('DB_HOST') ?: 'thaliumx-support-postgres');
define('DB_USER', getenv('DB_USER') ?: 'support');
define('DB_PASS', getenv('DB_PASSWORD') ?: '');
define('DB_NAME', getenv('DB_NAME') ?: 'support');
define('DB_PORT', 5432);

// Site configuration
define('SITE_NAME', 'ThaliumX Support Chat');
define('SITE_URL', 'https://support.thaliumx.com');

// Keycloak OIDC Configuration
define('OIDC_ENABLED', true);
define('OIDC_PROVIDER_URL', 'https://auth.thaliumx.com');
define('OIDC_CLIENT_ID', getenv('KEYCLOAK_CLIENT_ID') ?: '');
define('OIDC_CLIENT_SECRET', getenv('KEYCLOAK_CLIENT_SECRET') ?: '');
define('OIDC_REDIRECT_URI', 'https://support.thaliumx.com/lhc/index.php/site_admin/user/loginoidc');

// OIDC Scopes
define('OIDC_SCOPES', 'openid profile email');

// User attribute mapping
define('OIDC_USERNAME_ATTR', 'preferred_username');
define('OIDC_EMAIL_ATTR', 'email');
define('OIDC_FIRSTNAME_ATTR', 'given_name');
define('OIDC_LASTNAME_ATTR', 'family_name');

// Security settings
define('FORCE_HTTPS', true);
define('CSRF_ENABLED', true);

// Chat settings
define('CHAT_DELAY', 1000); // milliseconds
define('MAX_CHAT_DURATION', 1800); // 30 minutes
define('CHAT_ARCHIVE_PERIOD', 90); // days

// File upload settings
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB
define('ALLOWED_FILE_TYPES', 'jpg,jpeg,png,gif,pdf,doc,docx,txt');

// Encryption settings
define('ENCRYPTION_KEY', getenv('CHAT_ENCRYPTION_KEY') ?: 'default-key-change-in-production');

// Admin settings
define('ADMIN_USERNAME', 'admin');
define('ADMIN_EMAIL', 'admin@thaliumx.com');

// Logging
define('LOG_LEVEL', 'INFO');
define('LOG_FILE', '/var/log/lhc/application.log');

// Redis cache (if available)
if (getenv('REDIS_URL')) {
    define('REDIS_ENABLED', true);
    define('REDIS_URL', getenv('REDIS_URL'));
} else {
    define('REDIS_ENABLED', false);
}

// Phase 3: Moderation + analytics integration (external service)
// Live Helper Chat integration points vary by deployment; this is a configuration contract
// for custom hooks/middlewares.
define('MODERATION_ENABLED', true);
define('MODERATION_API_URL', getenv('MODERATION_API_URL') ?: 'http://thaliumx-support-moderation-analytics:8080');
define('MODERATION_TIMEOUT_MS', intval(getenv('MODERATION_TIMEOUT_MS') ?: '1000'));

// Email configuration for notifications
define('SMTP_HOST', getenv('SMTP_HOST') ?: 'mailhog');
define('SMTP_PORT', getenv('SMTP_PORT') ?: 1025);
define('SMTP_USER', getenv('SMTP_USER') ?: '');
define('SMTP_PASS', getenv('SMTP_PASS') ?: '');
define('SMTP_ENCRYPTION', 'none');

// Custom fields for trading support
define('CUSTOM_FIELDS_ENABLED', true);

// Integration settings
define('OSTICKET_INTEGRATION_ENABLED', true);
define('OSTICKET_API_URL', 'http://thaliumx-osticket/api');
define('OSTICKET_API_KEY', getenv('OSTICKET_API_KEY') ?: '');

// PII Masking for compliance
define('PII_MASKING_ENABLED', true);
define('SENSITIVE_PATTERNS', '/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/'); // Credit cards
?>

"use strict";
/**
 * Secrets Service (AWS Secrets Manager)
 *
 * Integration with AWS Secrets Manager for secure secret storage and retrieval.
 *
 * Features:
 * - Retrieve secrets from AWS Secrets Manager
 * - Support for both string and binary secrets
 * - Automatic secret rotation (handled by AWS)
 * - Region-based secret access
 *
 * Usage:
 * - Primary secret storage for production environments
 * - Falls back to .secrets files or environment variables
 * - Used by ConfigService for secret loading
 *
 * Security:
 * - Secrets never logged
 * - Encrypted at rest by AWS
 * - IAM-based access control
 * - Audit logging via CloudTrail
 *
 * Configuration:
 * - AWS_REGION: AWS region for Secrets Manager (default: us-east-1)
 * - Requires AWS credentials configured (IAM role, credentials file, or environment)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsService = void 0;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const logger_1 = require("./logger");
class SecretsService {
    static client = new client_secrets_manager_1.SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    static async getSecret(secretName) {
        try {
            const response = await this.client.send(new client_secrets_manager_1.GetSecretValueCommand({ SecretId: secretName }));
            if (response.SecretString) {
                return response.SecretString;
            }
            else if (response.SecretBinary) {
                return Buffer.from(response.SecretBinary).toString('utf8');
            }
            throw new Error(`Secret ${secretName} is empty`);
        }
        catch (error) {
            logger_1.LoggerService.error(`Failed to get secret ${secretName}`, error);
            throw error;
        }
    }
}
exports.SecretsService = SecretsService;
//# sourceMappingURL=secrets.js.map
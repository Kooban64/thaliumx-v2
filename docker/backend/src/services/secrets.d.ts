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
export declare class SecretsService {
    private static client;
    static getSecret(secretName: string): Promise<string>;
}
//# sourceMappingURL=secrets.d.ts.map
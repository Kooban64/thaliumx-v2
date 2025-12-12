/**
 * Regulatory Submission Service
 * Manages regulatory submissions across all jurisdictions
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { createComponentLogger, logRegulatoryEvent } from '../../utils/logger';
import { getConfig } from '../../config';
import type { RegulatorySubmission } from '../../types/coordinator';
import type { RegulatorySubmissionTable } from '../../types/database';

const logger = createComponentLogger('regulatory-service');

/**
 * Submission creation input
 */
export interface CreateSubmissionInput {
  submissionType: RegulatorySubmission['submissionType'];
  jurisdiction: string;
  authority: string;
  tenantId: string;
  brokerId?: string | undefined;
  reportingPeriod?: {
    startDate: Date;
    endDate: Date;
  } | undefined;
  data: Record<string, unknown>;
  submittedBy?: string | undefined;
}

/**
 * Submission query options
 */
export interface SubmissionQueryOptions {
  submissionType?: RegulatorySubmission['submissionType'] | undefined;
  jurisdiction?: string | undefined;
  status?: RegulatorySubmission['status'] | undefined;
  startDate?: Date | undefined;
  endDate?: Date | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}

/**
 * Submission response
 */
export interface SubmissionResponse {
  success: boolean;
  responseCode?: string | undefined;
  responseMessage?: string | undefined;
  timestamp: Date;
}

/**
 * Regulatory Service
 */
export class RegulatoryService {
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 60000; // 1 minute

  /**
   * Create a new regulatory submission
   */
  async createSubmission(input: CreateSubmissionInput): Promise<RegulatorySubmission> {
    logger.info('Creating regulatory submission', {
      submissionType: input.submissionType,
      jurisdiction: input.jurisdiction,
      authority: input.authority,
    });

    const db = getDatabaseService();
    const id = uuidv4();
    const submissionId = `SUB-${input.jurisdiction.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
    const now = new Date();

    await db.query(`
      INSERT INTO regulatory_submissions (
        id, submission_id, submission_type, jurisdiction, authority,
        tenant_id, broker_id, reporting_period_start_date, reporting_period_end_date,
        data, status, retry_count, max_retries, submitted_by,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'draft', 0, $11, $12,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      id,
      submissionId,
      input.submissionType,
      input.jurisdiction,
      input.authority,
      input.tenantId,
      input.brokerId,
      input.reportingPeriod?.startDate,
      input.reportingPeriod?.endDate,
      JSON.stringify(input.data),
      this.maxRetries,
      input.submittedBy,
    ]);

    logRegulatoryEvent('created', submissionId, input.submissionType, input.jurisdiction, {
      tenantId: input.tenantId,
    });

    return {
      id,
      submissionId,
      submissionType: input.submissionType,
      jurisdiction: input.jurisdiction,
      authority: input.authority,
      tenantId: input.tenantId,
      brokerId: input.brokerId,
      reportingPeriod: input.reportingPeriod,
      data: input.data,
      status: 'draft',
      retryCount: 0,
      maxRetries: this.maxRetries,
      submittedBy: input.submittedBy,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Get submission by ID
   */
  async getSubmission(submissionId: string): Promise<RegulatorySubmission | null> {
    const db = getDatabaseService();
    const row = await db.queryOne<RegulatorySubmissionTable>(`
      SELECT * FROM regulatory_submissions WHERE id = $1 OR submission_id = $1
    `, [submissionId]);

    if (!row) {
      return null;
    }

    return this.mapSubmissionTableToData(row);
  }

  /**
   * Get submissions with filters
   */
  async getSubmissions(
    tenantId: string,
    options?: SubmissionQueryOptions
  ): Promise<RegulatorySubmission[]> {
    const db = getDatabaseService();
    const params: unknown[] = [tenantId];
    let whereClause = 'WHERE tenant_id = $1';
    let paramIndex = 2;

    if (options?.submissionType) {
      whereClause += ` AND submission_type = $${paramIndex}`;
      params.push(options.submissionType);
      paramIndex++;
    }

    if (options?.jurisdiction) {
      whereClause += ` AND jurisdiction = $${paramIndex}`;
      params.push(options.jurisdiction);
      paramIndex++;
    }

    if (options?.status) {
      whereClause += ` AND status = $${paramIndex}`;
      params.push(options.status);
      paramIndex++;
    }

    if (options?.startDate) {
      whereClause += ` AND created_at >= $${paramIndex}`;
      params.push(options.startDate);
      paramIndex++;
    }

    if (options?.endDate) {
      whereClause += ` AND created_at <= $${paramIndex}`;
      params.push(options.endDate);
      paramIndex++;
    }

    const limit = options?.limit ?? 100;
    const offset = options?.offset ?? 0;

    const rows = await db.queryAll<RegulatorySubmissionTable>(`
      SELECT * FROM regulatory_submissions
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `, params);

    return rows.map((row) => this.mapSubmissionTableToData(row));
  }

  /**
   * Submit to regulatory authority
   */
  async submitToAuthority(submissionId: string): Promise<RegulatorySubmission | null> {
    const submission = await this.getSubmission(submissionId);
    if (!submission) {
      return null;
    }

    if (submission.status !== 'draft' && submission.status !== 'pending') {
      logger.warn('Cannot submit - invalid status', {
        submissionId,
        currentStatus: submission.status,
      });
      return submission;
    }

    const db = getDatabaseService();
    const config = getConfig();

    // Update status to pending
    await db.query(`
      UPDATE regulatory_submissions
      SET status = 'pending',
          submission_date = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
    `, [submission.id]);

    // Check if auto-submit is enabled
    if (!config.regulatory.autoSubmit) {
      logger.info('Auto-submit disabled, submission marked as pending', {
        submissionId,
      });
      return this.getSubmission(submissionId);
    }

    // Get submission endpoint
    const endpoint = config.regulatory.submissionEndpoints[submission.jurisdiction];
    if (!endpoint) {
      logger.warn('No submission endpoint configured for jurisdiction', {
        jurisdiction: submission.jurisdiction,
      });
      return this.getSubmission(submissionId);
    }

    // Attempt submission
    try {
      const response = await this.sendSubmission(submission, endpoint);
      
      if (response.success) {
        await db.query(`
          UPDATE regulatory_submissions
          SET status = 'submitted',
              response_date = $1,
              response_code = $2,
              response_message = $3,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $4
        `, [response.timestamp, response.responseCode, response.responseMessage, submission.id]);

        logRegulatoryEvent('submitted', submission.submissionId, submission.submissionType, submission.jurisdiction);
      } else {
        await this.handleSubmissionFailure(submission, response);
      }
    } catch (error) {
      await this.handleSubmissionFailure(submission, {
        success: false,
        responseMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      });
    }

    return this.getSubmission(submissionId);
  }

  /**
   * Acknowledge submission
   */
  async acknowledgeSubmission(
    submissionId: string,
    responseCode: string,
    responseMessage: string
  ): Promise<RegulatorySubmission | null> {
    const db = getDatabaseService();

    await db.query(`
      UPDATE regulatory_submissions
      SET status = 'acknowledged',
          response_date = CURRENT_TIMESTAMP,
          response_code = $1,
          response_message = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE (id = $3 OR submission_id = $3) AND status = 'submitted'
    `, [responseCode, responseMessage, submissionId]);

    const submission = await this.getSubmission(submissionId);
    if (submission) {
      logRegulatoryEvent('acknowledged', submission.submissionId, submission.submissionType, submission.jurisdiction, {
        responseCode,
      });
    }

    return submission;
  }

  /**
   * Reject submission
   */
  async rejectSubmission(
    submissionId: string,
    responseCode: string,
    responseMessage: string
  ): Promise<RegulatorySubmission | null> {
    const db = getDatabaseService();

    await db.query(`
      UPDATE regulatory_submissions
      SET status = 'rejected',
          response_date = CURRENT_TIMESTAMP,
          response_code = $1,
          response_message = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE (id = $3 OR submission_id = $3) AND status IN ('submitted', 'pending')
    `, [responseCode, responseMessage, submissionId]);

    const submission = await this.getSubmission(submissionId);
    if (submission) {
      logRegulatoryEvent('rejected', submission.submissionId, submission.submissionType, submission.jurisdiction, {
        responseCode,
        responseMessage,
      });
    }

    return submission;
  }

  /**
   * Accept submission
   */
  async acceptSubmission(
    submissionId: string,
    responseCode: string,
    responseMessage: string
  ): Promise<RegulatorySubmission | null> {
    const db = getDatabaseService();

    await db.query(`
      UPDATE regulatory_submissions
      SET status = 'accepted',
          response_date = CURRENT_TIMESTAMP,
          response_code = $1,
          response_message = $2,
          updated_at = CURRENT_TIMESTAMP
      WHERE (id = $3 OR submission_id = $3) AND status IN ('submitted', 'acknowledged')
    `, [responseCode, responseMessage, submissionId]);

    return this.getSubmission(submissionId);
  }

  /**
   * Retry failed submissions
   */
  async retryFailedSubmissions(): Promise<number> {
    const db = getDatabaseService();

    const pendingRetries = await db.queryAll<RegulatorySubmissionTable>(`
      SELECT * FROM regulatory_submissions
      WHERE status = 'pending'
        AND retry_count < max_retries
        AND (next_retry_at IS NULL OR next_retry_at <= CURRENT_TIMESTAMP)
    `);

    let retryCount = 0;

    for (const row of pendingRetries) {
      const submission = this.mapSubmissionTableToData(row);
      await this.submitToAuthority(submission.id);
      retryCount++;
    }

    logger.info('Retried failed submissions', { count: retryCount });
    return retryCount;
  }

  /**
   * Get submission statistics
   */
  async getSubmissionStatistics(
    tenantId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byType: Record<string, number>;
    byJurisdiction: Record<string, number>;
    successRate: number;
  }> {
    const db = getDatabaseService();

    // Get by status
    const statusStats = await db.queryAll<{ status: string; count: string }>(`
      SELECT status, COUNT(*) as count
      FROM regulatory_submissions
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY status
    `, [tenantId, periodStart, periodEnd]);

    // Get by type
    const typeStats = await db.queryAll<{ submission_type: string; count: string }>(`
      SELECT submission_type, COUNT(*) as count
      FROM regulatory_submissions
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY submission_type
    `, [tenantId, periodStart, periodEnd]);

    // Get by jurisdiction
    const jurisdictionStats = await db.queryAll<{ jurisdiction: string; count: string }>(`
      SELECT jurisdiction, COUNT(*) as count
      FROM regulatory_submissions
      WHERE tenant_id = $1
        AND created_at >= $2
        AND created_at <= $3
      GROUP BY jurisdiction
    `, [tenantId, periodStart, periodEnd]);

    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byJurisdiction: Record<string, number> = {};
    let total = 0;
    let successful = 0;

    for (const stat of statusStats) {
      byStatus[stat.status] = parseInt(stat.count, 10);
      total += parseInt(stat.count, 10);
      if (stat.status === 'acknowledged' || stat.status === 'accepted') {
        successful += parseInt(stat.count, 10);
      }
    }

    for (const stat of typeStats) {
      byType[stat.submission_type] = parseInt(stat.count, 10);
    }

    for (const stat of jurisdictionStats) {
      byJurisdiction[stat.jurisdiction] = parseInt(stat.count, 10);
    }

    return {
      total,
      byStatus,
      byType,
      byJurisdiction,
      successRate: total > 0 ? (successful / total) * 100 : 0,
    };
  }

  /**
   * Send submission to authority
   */
  private async sendSubmission(
    submission: RegulatorySubmission,
    endpoint: string
  ): Promise<SubmissionResponse> {
    logger.info('Sending submission to authority', {
      submissionId: submission.submissionId,
      endpoint,
    });

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Submission-ID': submission.submissionId,
          'X-Submission-Type': submission.submissionType,
        },
        body: JSON.stringify({
          submissionId: submission.submissionId,
          submissionType: submission.submissionType,
          jurisdiction: submission.jurisdiction,
          authority: submission.authority,
          reportingPeriod: submission.reportingPeriod,
          data: submission.data,
          submittedAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const responseData = await response.json() as { code?: string; message?: string };
        return {
          success: true,
          responseCode: responseData.code ?? 'SUCCESS',
          responseMessage: responseData.message ?? 'Submission accepted',
          timestamp: new Date(),
        };
      } else {
        const errorData = await response.text();
        return {
          success: false,
          responseCode: `HTTP_${response.status}`,
          responseMessage: errorData || response.statusText,
          timestamp: new Date(),
        };
      }
    } catch (error) {
      return {
        success: false,
        responseMessage: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Handle submission failure
   */
  private async handleSubmissionFailure(
    submission: RegulatorySubmission,
    response: SubmissionResponse
  ): Promise<void> {
    const db = getDatabaseService();
    const newRetryCount = submission.retryCount + 1;
    const nextRetryAt = new Date(Date.now() + this.retryDelayMs * Math.pow(2, newRetryCount));

    if (newRetryCount >= submission.maxRetries) {
      // Max retries reached
      await db.query(`
        UPDATE regulatory_submissions
        SET status = 'rejected',
            response_date = $1,
            response_code = $2,
            response_message = $3,
            retry_count = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [response.timestamp, response.responseCode ?? 'MAX_RETRIES', response.responseMessage, newRetryCount, submission.id]);

      logRegulatoryEvent('failed', submission.submissionId, submission.submissionType, submission.jurisdiction, {
        reason: 'Max retries reached',
        responseMessage: response.responseMessage,
      });
    } else {
      // Schedule retry
      await db.query(`
        UPDATE regulatory_submissions
        SET retry_count = $1,
            next_retry_at = $2,
            response_code = $3,
            response_message = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5
      `, [newRetryCount, nextRetryAt, response.responseCode, response.responseMessage, submission.id]);

      logger.info('Scheduled retry for submission', {
        submissionId: submission.submissionId,
        retryCount: newRetryCount,
        nextRetryAt,
      });
    }
  }

  /**
   * Map submission table to data
   */
  private mapSubmissionTableToData(row: RegulatorySubmissionTable): RegulatorySubmission {
    return {
      id: row.id,
      submissionId: row.submission_id,
      submissionType: row.submission_type as RegulatorySubmission['submissionType'],
      jurisdiction: row.jurisdiction,
      authority: row.authority,
      tenantId: row.tenant_id,
      brokerId: row.broker_id ?? undefined,
      reportingPeriod: row.reporting_period_start_date && row.reporting_period_end_date ? {
        startDate: row.reporting_period_start_date,
        endDate: row.reporting_period_end_date,
      } : undefined,
      data: row.data,
      status: row.status as RegulatorySubmission['status'],
      submissionDate: row.submission_date ?? undefined,
      responseDate: row.response_date ?? undefined,
      responseCode: row.response_code ?? undefined,
      responseMessage: row.response_message ?? undefined,
      retryCount: row.retry_count,
      maxRetries: row.max_retries,
      nextRetryAt: row.next_retry_at ?? undefined,
      submittedBy: row.submitted_by ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * Singleton instance
 */
let regulatoryServiceInstance: RegulatoryService | null = null;

export function getRegulatoryService(): RegulatoryService {
  if (!regulatoryServiceInstance) {
    regulatoryServiceInstance = new RegulatoryService();
  }
  return regulatoryServiceInstance;
}

export default getRegulatoryService;

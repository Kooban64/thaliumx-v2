/**
 * Content Screening Service for NFT Compliance
 * Screens NFT content for prohibited material
 */

import { v4 as uuidv4 } from 'uuid';
import { getDatabaseService } from '../database';
import { getEventProducer } from '../events';
import { createComponentLogger } from '../../utils/logger';
import { getConfig } from '../../config';
import {
  ContentScreeningResult,
  ContentFlag,
  ContentCategory,
} from '../../types/compliance';
import { ContentScreeningTable } from '../../types/database';

const logger = createComponentLogger('content-screening-service');

/**
 * Content screening configuration
 */
interface ContentScreeningConfig {
  enabled: boolean;
  provider: string;
  apiKey: string;
  autoFlag: boolean;
  moderationThreshold: number;
  adultContentThreshold: number;
  violenceThreshold: number;
}

/**
 * Content analysis result from provider
 */
interface ContentAnalysisResult {
  adult: number;
  violence: number;
  hate: number;
  spam: number;
  categories: string[];
  labels: string[];
}

/**
 * Content Screening Service
 */
export class ContentScreeningService {
  private config: ContentScreeningConfig;

  constructor() {
    const appConfig = getConfig();
    this.config = {
      enabled: appConfig.contentScreening.enabled,
      provider: appConfig.contentScreening.provider,
      apiKey: appConfig.contentScreening.apiKey,
      autoFlag: appConfig.contentScreening.autoFlag,
      moderationThreshold: 70,
      adultContentThreshold: 50,
      violenceThreshold: 60,
    };
  }

  /**
   * Screen NFT content
   */
  async screenContent(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    contentUrl: string,
    contentType: 'image' | 'video' | 'audio' | '3d_model' | 'other',
    tenantId: string
  ): Promise<ContentScreeningResult> {
    const startTime = Date.now();
    logger.info('Screening NFT content', {
      contractAddress,
      tokenId,
      chainId,
      contentType,
    });

    if (!this.config.enabled) {
      logger.warn('Content screening is disabled');
      return this.createPassResult(contractAddress, tokenId, chainId, contentUrl, contentType, tenantId);
    }

    try {
      // Analyze content
      const analysis = await this.analyzeContent(contentUrl, contentType);

      // Determine flags
      const flagReasons = this.determineFlags(analysis);

      // Determine categories
      const categories = this.determineCategories(analysis);

      // Calculate moderation score
      const moderationScore = this.calculateModerationScore(analysis);

      // Determine if flagged
      const isFlagged = this.config.autoFlag && flagReasons.length > 0;

      // Determine if manual review required
      const manualReviewRequired = this.shouldRequireManualReview(moderationScore, flagReasons);

      // Create result
      const result: ContentScreeningResult = {
        id: uuidv4(),
        contractAddress,
        tokenId,
        chainId,
        screeningDate: new Date(),
        contentType,
        contentUrl,
        isFlagged,
        flagReasons,
        moderationScore,
        categories,
        manualReviewRequired,
        tenantId,
      };

      // Save result to database
      await this.saveResult(result);

      // Publish event
      await this.publishContentScreened(result);

      const duration = Date.now() - startTime;
      logger.logContentScreeningEvent(
        'completed',
        result.id,
        contractAddress,
        tokenId,
        isFlagged,
        { durationMs: duration, moderationScore, flagCount: flagReasons.length }
      );

      return result;
    } catch (error) {
      logger.error('Failed to screen content', {
        contractAddress,
        tokenId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Analyze content using provider
   */
  private async analyzeContent(
    contentUrl: string,
    contentType: 'image' | 'video' | 'audio' | '3d_model' | 'other'
  ): Promise<ContentAnalysisResult> {
    // In production, this would call an external content moderation API
    // For now, we'll implement a basic analysis

    if (this.config.provider === 'internal') {
      return this.internalAnalysis(contentUrl, contentType);
    }

    // External provider integration would go here
    // Example providers: AWS Rekognition, Google Cloud Vision, Azure Content Moderator
    return this.internalAnalysis(contentUrl, contentType);
  }

  /**
   * Internal content analysis (basic implementation)
   */
  private async internalAnalysis(
    contentUrl: string,
    _contentType: 'image' | 'video' | 'audio' | '3d_model' | 'other'
  ): Promise<ContentAnalysisResult> {
    // Basic URL-based heuristics
    const url = contentUrl.toLowerCase();

    // Check for suspicious patterns in URL
    const suspiciousPatterns = [
      'adult', 'nsfw', 'xxx', 'porn', 'nude',
      'violence', 'gore', 'blood',
      'hate', 'nazi', 'racist',
    ];

    let adult = 0;
    let violence = 0;
    let hate = 0;
    let spam = 0;

    for (const pattern of suspiciousPatterns) {
      if (url.includes(pattern)) {
        if (['adult', 'nsfw', 'xxx', 'porn', 'nude'].includes(pattern)) {
          adult += 30;
        }
        if (['violence', 'gore', 'blood'].includes(pattern)) {
          violence += 30;
        }
        if (['hate', 'nazi', 'racist'].includes(pattern)) {
          hate += 30;
        }
      }
    }

    // Check for known spam domains
    const spamDomains = ['bit.ly', 'tinyurl.com', 'goo.gl'];
    for (const domain of spamDomains) {
      if (url.includes(domain)) {
        spam += 20;
      }
    }

    // Determine categories based on URL patterns
    const categories: string[] = [];
    if (url.includes('art') || url.includes('gallery')) categories.push('art');
    if (url.includes('music') || url.includes('audio')) categories.push('music');
    if (url.includes('video') || url.includes('animation')) categories.push('video');
    if (url.includes('game') || url.includes('gaming')) categories.push('gaming');
    if (url.includes('collect')) categories.push('collectibles');

    if (categories.length === 0) {
      categories.push('other');
    }

    return {
      adult: Math.min(100, adult),
      violence: Math.min(100, violence),
      hate: Math.min(100, hate),
      spam: Math.min(100, spam),
      categories,
      labels: [],
    };
  }

  /**
   * Determine content flags based on analysis
   */
  private determineFlags(analysis: ContentAnalysisResult): ContentFlag[] {
    const flags: ContentFlag[] = [];

    if (analysis.adult >= this.config.adultContentThreshold) {
      flags.push('adult_content');
    }

    if (analysis.violence >= this.config.violenceThreshold) {
      flags.push('violence');
    }

    if (analysis.hate >= 50) {
      flags.push('hate_speech');
    }

    if (analysis.spam >= 50) {
      flags.push('spam');
    }

    return flags;
  }

  /**
   * Determine content categories
   */
  private determineCategories(analysis: ContentAnalysisResult): ContentCategory[] {
    const categoryMap: Record<string, ContentCategory> = {
      art: 'art',
      photography: 'photography',
      music: 'music',
      video: 'video',
      gaming: 'gaming',
      collectibles: 'collectibles',
      sports: 'sports',
      utility: 'utility',
      domain: 'domain',
      virtual_world: 'virtual_world',
    };

    const categories: ContentCategory[] = [];

    for (const cat of analysis.categories) {
      const mapped = categoryMap[cat.toLowerCase()];
      if (mapped) {
        categories.push(mapped);
      }
    }

    if (categories.length === 0) {
      categories.push('other');
    }

    return categories;
  }

  /**
   * Calculate overall moderation score
   */
  private calculateModerationScore(analysis: ContentAnalysisResult): number {
    // Higher score = more problematic content
    const weights = {
      adult: 0.3,
      violence: 0.3,
      hate: 0.25,
      spam: 0.15,
    };

    const score =
      analysis.adult * weights.adult +
      analysis.violence * weights.violence +
      analysis.hate * weights.hate +
      analysis.spam * weights.spam;

    return Math.round(score);
  }

  /**
   * Determine if manual review is required
   */
  private shouldRequireManualReview(
    moderationScore: number,
    flags: ContentFlag[]
  ): boolean {
    // Require manual review for borderline cases
    if (moderationScore >= 40 && moderationScore < this.config.moderationThreshold) {
      return true;
    }

    // Require manual review for certain flag types
    const reviewFlags: ContentFlag[] = [
      'copyright_violation',
      'trademark_violation',
      'counterfeit',
      'stolen_art',
      'illegal_content',
    ];

    return flags.some((flag) => reviewFlags.includes(flag));
  }

  /**
   * Create a pass result (when screening is disabled)
   */
  private createPassResult(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    contentUrl: string,
    contentType: 'image' | 'video' | 'audio' | '3d_model' | 'other',
    tenantId: string
  ): ContentScreeningResult {
    return {
      id: uuidv4(),
      contractAddress,
      tokenId,
      chainId,
      screeningDate: new Date(),
      contentType,
      contentUrl,
      isFlagged: false,
      flagReasons: [],
      moderationScore: 0,
      categories: ['other'],
      manualReviewRequired: false,
      tenantId,
    };
  }

  /**
   * Save screening result to database
   */
  private async saveResult(result: ContentScreeningResult): Promise<void> {
    const db = getDatabaseService();

    await db.query(`
      INSERT INTO content_screenings (
        id, contract_address, token_id, chain_id, screening_date,
        content_type, content_url, is_flagged, flag_reasons,
        moderation_score, categories, manual_review_required,
        tenant_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `, [
      result.id,
      result.contractAddress,
      result.tokenId,
      result.chainId,
      result.screeningDate,
      result.contentType,
      result.contentUrl,
      result.isFlagged,
      result.flagReasons,
      result.moderationScore,
      result.categories,
      result.manualReviewRequired,
      result.tenantId,
    ]);
  }

  /**
   * Publish content screened event
   */
  private async publishContentScreened(result: ContentScreeningResult): Promise<void> {
    const producer = getEventProducer();

    await producer.publishContentScreened(
      result.id,
      result.contractAddress,
      result.tokenId,
      result.chainId,
      result.contentType,
      result.contentUrl,
      result.isFlagged,
      result.flagReasons,
      result.moderationScore,
      result.categories,
      result.manualReviewRequired,
      result.tenantId
    );
  }

  /**
   * Review content manually
   */
  async reviewContent(
    screeningId: string,
    reviewedBy: string,
    approved: boolean,
    reviewNotes?: string,
    actionTaken?: string
  ): Promise<ContentScreeningResult> {
    const db = getDatabaseService();

    // Update the screening record
    await db.query(`
      UPDATE content_screenings
      SET reviewed_by = $1,
          reviewed_at = CURRENT_TIMESTAMP,
          review_notes = $2,
          is_flagged = $3,
          manual_review_required = false,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `, [reviewedBy, reviewNotes, !approved, screeningId]);

    // Get updated record
    const row = await db.queryOne<ContentScreeningTable>(`
      SELECT * FROM content_screenings WHERE id = $1
    `, [screeningId]);

    if (!row) {
      throw new Error(`Screening not found: ${screeningId}`);
    }

    const result = this.mapTableToResult(row);

    // Publish review event
    const producer = getEventProducer();
    await producer.send('nft.compliance.content_screening', {
      eventId: uuidv4(),
      eventType: 'nft.content.reviewed',
      timestamp: new Date(),
      version: '1.0',
      source: 'nft-compliance-service',
      tenantId: result.tenantId,
      payload: {
        screeningId,
        contractAddress: result.contractAddress,
        tokenId: result.tokenId,
        chainId: result.chainId,
        reviewedBy,
        approved,
        reviewNotes,
        actionTaken,
      },
    });

    logger.logContentScreeningEvent(
      'reviewed',
      screeningId,
      result.contractAddress,
      result.tokenId,
      !approved,
      { reviewedBy, approved }
    );

    return result;
  }

  /**
   * Get screening history for a token
   */
  async getTokenHistory(
    contractAddress: string,
    tokenId: string,
    chainId: number,
    tenantId: string
  ): Promise<ContentScreeningResult[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<ContentScreeningTable>(`
      SELECT * FROM content_screenings
      WHERE contract_address = $1
        AND token_id = $2
        AND chain_id = $3
        AND tenant_id = $4
      ORDER BY screening_date DESC
    `, [contractAddress, tokenId, chainId, tenantId]);

    return rows.map((row) => this.mapTableToResult(row));
  }

  /**
   * Get pending reviews
   */
  async getPendingReviews(
    tenantId: string,
    limit = 100
  ): Promise<ContentScreeningResult[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<ContentScreeningTable>(`
      SELECT * FROM content_screenings
      WHERE tenant_id = $1
        AND manual_review_required = true
        AND reviewed_by IS NULL
      ORDER BY screening_date ASC
      LIMIT $2
    `, [tenantId, limit]);

    return rows.map((row) => this.mapTableToResult(row));
  }

  /**
   * Get flagged content
   */
  async getFlaggedContent(
    tenantId: string,
    limit = 100
  ): Promise<ContentScreeningResult[]> {
    const db = getDatabaseService();

    const rows = await db.queryAll<ContentScreeningTable>(`
      SELECT * FROM content_screenings
      WHERE tenant_id = $1
        AND is_flagged = true
      ORDER BY screening_date DESC
      LIMIT $2
    `, [tenantId, limit]);

    return rows.map((row) => this.mapTableToResult(row));
  }

  /**
   * Map database table to result type
   */
  private mapTableToResult(row: ContentScreeningTable): ContentScreeningResult {
    return {
      id: row.id,
      contractAddress: row.contract_address,
      tokenId: row.token_id,
      chainId: row.chain_id,
      screeningDate: row.screening_date,
      contentType: row.content_type,
      contentUrl: row.content_url,
      isFlagged: row.is_flagged,
      flagReasons: row.flag_reasons as ContentFlag[],
      moderationScore: row.moderation_score,
      categories: row.categories as ContentCategory[],
      manualReviewRequired: row.manual_review_required,
      reviewedBy: row.reviewed_by ?? undefined,
      reviewedAt: row.reviewed_at ?? undefined,
      reviewNotes: row.review_notes ?? undefined,
      tenantId: row.tenant_id,
    };
  }
}

/**
 * Singleton content screening service instance
 */
let contentScreeningServiceInstance: ContentScreeningService | null = null;

/**
 * Get content screening service instance
 */
export function getContentScreeningService(): ContentScreeningService {
  if (!contentScreeningServiceInstance) {
    contentScreeningServiceInstance = new ContentScreeningService();
  }
  return contentScreeningServiceInstance;
}

export default getContentScreeningService;

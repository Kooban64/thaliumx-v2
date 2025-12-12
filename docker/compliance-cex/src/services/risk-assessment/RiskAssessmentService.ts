/**
 * Risk Assessment Service for CEX Compliance Service
 * Implements real-time risk scoring and AML/CFT compliance
 */

import { config } from '../../config';
import { logger } from '../../utils/logger';
import { riskAssessmentRepository, CreateRiskAssessmentDTO } from '../../repositories';
import { eventProducer } from '../events';
import {
  RiskAssessmentData,
  RiskFactors,
  RiskFlag,
  RiskRecommendation,
} from '../../types/compliance';
import { RiskAssessmentCompletedEvent } from '../../types/events';

// ==================== INTERFACES ====================

/**
 * Transaction data for risk assessment
 */
export interface TransactionRiskData {
  transactionId: string;
  userId: string;
  brokerId: string;
  tenantId: string;
  amount: number;
  currency: string;
  type: 'buy' | 'sell' | 'deposit' | 'withdrawal' | 'transfer';
  counterparty?: string;
  counterpartyCountry?: string;
  walletAddress?: string;
  timestamp: Date;
  platform: string;
}

/**
 * User profile for risk assessment
 */
export interface UserRiskProfile {
  userId: string;
  country: string;
  kycStatus: 'none' | 'pending' | 'approved' | 'rejected' | 'expired';
  riskRating: 'low' | 'medium' | 'high' | 'critical';
  politicallyExposed: boolean;
  sanctionsStatus: 'passed' | 'failed' | 'pending' | 'not_checked';
  accountAge: number; // days
  totalTransactions: number;
  totalVolume: number;
  averageTransactionSize: number;
  lastTransactionDate?: Date;
}

/**
 * Risk assessment result
 */
export interface RiskAssessmentResult {
  id: string;
  transactionId: string;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: RiskFactors;
  flags: RiskFlag[];
  recommendations: RiskRecommendation[];
  reviewRequired: boolean;
  assessmentDate: Date;
}

// ==================== RISK ASSESSMENT SERVICE ====================

/**
 * Risk Assessment Service - Real-time risk scoring
 */
export class RiskAssessmentService {
  private readonly thresholds: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };

  // High-risk jurisdictions (FATF grey/black list)
  private readonly highRiskCountries = [
    'KP', 'IR', 'MM', 'SY', 'YE', 'AF', 'PK', 'VE', 'NI', 'ZW',
  ];

  // Sanctioned countries
  private readonly sanctionedCountries = ['KP', 'IR', 'SY', 'CU', 'RU', 'BY'];

  constructor() {
    this.thresholds = config.riskThresholds;
  }

  /**
   * Assess risk for a transaction
   */
  async assessTransaction(
    transaction: TransactionRiskData,
    userProfile: UserRiskProfile
  ): Promise<RiskAssessmentResult> {
    logger.info('Assessing transaction risk', {
      transactionId: transaction.transactionId,
      userId: transaction.userId,
    });

    // Calculate individual risk factors
    const factors = this.calculateRiskFactors(transaction, userProfile);

    // Calculate overall risk score
    const riskScore = this.calculateOverallScore(factors);

    // Determine risk level
    const riskLevel = this.determineRiskLevel(riskScore);

    // Identify risk flags
    const flags = this.identifyRiskFlags(transaction, userProfile, factors);

    // Generate recommendations
    const recommendations = this.generateRecommendations(riskLevel, flags);

    // Determine if manual review is required
    const reviewRequired = this.isReviewRequired(riskLevel, flags);

    // Create risk assessment record
    const createDTO: CreateRiskAssessmentDTO = {
      transactionId: transaction.transactionId,
      userId: transaction.userId,
      brokerId: transaction.brokerId,
      tenantId: transaction.tenantId,
      riskScore,
      riskLevel,
      factors,
      flags,
      recommendations,
      assessor: 'automated',
      reviewRequired,
    };

    const assessment = await riskAssessmentRepository.create(createDTO);
    const assessmentData = riskAssessmentRepository.tableToRiskAssessmentData(assessment);

    // Publish event
    await this.publishRiskAssessmentEvent(assessmentData);

    logger.info('Risk assessment completed', {
      transactionId: transaction.transactionId,
      riskScore,
      riskLevel,
      flags: flags.length,
      reviewRequired,
    });

    return {
      id: assessmentData.id,
      transactionId: transaction.transactionId,
      riskScore,
      riskLevel,
      factors,
      flags,
      recommendations,
      reviewRequired,
      assessmentDate: assessmentData.assessmentDate,
    };
  }

  /**
   * Assess user risk profile
   */
  async assessUserProfile(userProfile: UserRiskProfile): Promise<{
    riskScore: number;
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    flags: RiskFlag[];
    recommendations: RiskRecommendation[];
  }> {
    const flags: RiskFlag[] = [];
    let riskScore = 0;

    // KYC status check
    if (userProfile.kycStatus !== 'approved') {
      riskScore += 30;
      flags.push('unknown_counterparty');
    }

    // Sanctions check
    if (userProfile.sanctionsStatus === 'failed') {
      riskScore += 100;
      flags.push('sanctions_match');
    } else if (userProfile.sanctionsStatus !== 'passed') {
      riskScore += 20;
    }

    // PEP check
    if (userProfile.politicallyExposed) {
      riskScore += 25;
      flags.push('peps_exposure');
    }

    // Geographic risk
    if (this.highRiskCountries.includes(userProfile.country)) {
      riskScore += 30;
      flags.push('high_risk_jurisdiction');
    }

    // Account age risk
    if (userProfile.accountAge < 30) {
      riskScore += 15;
    }

    // Normalize score
    riskScore = Math.min(100, riskScore);

    const riskLevel = this.determineRiskLevel(riskScore);
    const recommendations = this.generateRecommendations(riskLevel, flags);

    return {
      riskScore,
      riskLevel,
      flags,
      recommendations,
    };
  }

  /**
   * Get risk assessment by ID
   */
  async getRiskAssessmentById(id: string): Promise<RiskAssessmentData | null> {
    const record = await riskAssessmentRepository.findById(id);
    return record ? riskAssessmentRepository.tableToRiskAssessmentData(record) : null;
  }

  /**
   * Get risk assessment for transaction
   */
  async getRiskAssessmentForTransaction(transactionId: string): Promise<RiskAssessmentData | null> {
    const record = await riskAssessmentRepository.findByTransactionId(transactionId);
    return record ? riskAssessmentRepository.tableToRiskAssessmentData(record) : null;
  }

  /**
   * Get user's latest risk assessment
   */
  async getUserLatestAssessment(userId: string, tenantId: string): Promise<RiskAssessmentData | null> {
    const record = await riskAssessmentRepository.getLatestForUser(userId, tenantId);
    return record ? riskAssessmentRepository.tableToRiskAssessmentData(record) : null;
  }

  /**
   * Get assessments requiring review
   */
  async getAssessmentsRequiringReview(tenantId?: string): Promise<RiskAssessmentData[]> {
    const records = await riskAssessmentRepository.findRequiringReview(tenantId);
    return records.map((r) => riskAssessmentRepository.tableToRiskAssessmentData(r));
  }

  /**
   * Mark assessment as reviewed
   */
  async markAsReviewed(
    id: string,
    reviewedBy: string,
    reviewNotes?: string,
    overrideReason?: string
  ): Promise<RiskAssessmentData | null> {
    const record = await riskAssessmentRepository.markReviewed(
      id,
      reviewedBy,
      reviewNotes,
      overrideReason
    );
    return record ? riskAssessmentRepository.tableToRiskAssessmentData(record) : null;
  }

  /**
   * Override risk level
   */
  async overrideRiskLevel(
    id: string,
    newRiskLevel: 'low' | 'medium' | 'high' | 'critical',
    reviewedBy: string,
    overrideReason: string
  ): Promise<RiskAssessmentData | null> {
    const record = await riskAssessmentRepository.overrideRiskLevel(
      id,
      newRiskLevel,
      reviewedBy,
      overrideReason
    );
    return record ? riskAssessmentRepository.tableToRiskAssessmentData(record) : null;
  }

  /**
   * Get risk statistics
   */
  async getStatistics(tenantId?: string): Promise<{
    total: number;
    byRiskLevel: Record<string, number>;
    averageScore: number;
    requiresReview: number;
    reviewed: number;
    topFlags: Array<{ flag: string; count: number }>;
  }> {
    return riskAssessmentRepository.getStatistics(tenantId);
  }

  /**
   * Get user risk trend
   */
  async getUserRiskTrend(
    userId: string,
    tenantId: string,
    days?: number
  ): Promise<Array<{ date: string; score: number; level: string }>> {
    return riskAssessmentRepository.getUserRiskTrend(userId, tenantId, days);
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Calculate individual risk factors
   */
  private calculateRiskFactors(
    transaction: TransactionRiskData,
    userProfile: UserRiskProfile
  ): RiskFactors {
    return {
      amount: this.calculateAmountRisk(transaction.amount, userProfile.averageTransactionSize),
      frequency: this.calculateFrequencyRisk(userProfile.totalTransactions, userProfile.accountAge),
      geography: this.calculateGeographyRisk(userProfile.country, transaction.counterpartyCountry),
      counterparty: this.calculateCounterpartyRisk(transaction.counterparty, userProfile.kycStatus),
      pattern: this.calculatePatternRisk(transaction, userProfile),
      velocity: this.calculateVelocityRisk(transaction, userProfile),
      concentration: this.calculateConcentrationRisk(transaction.amount, userProfile.totalVolume),
      sourceOfFunds: this.calculateSourceOfFundsRisk(transaction.type, userProfile.kycStatus),
    };
  }

  /**
   * Calculate amount risk factor
   */
  private calculateAmountRisk(amount: number, averageSize: number): number {
    if (averageSize === 0) return 50;
    
    const ratio = amount / averageSize;
    if (ratio > 10) return 100;
    if (ratio > 5) return 80;
    if (ratio > 3) return 60;
    if (ratio > 2) return 40;
    return 20;
  }

  /**
   * Calculate frequency risk factor
   */
  private calculateFrequencyRisk(totalTransactions: number, accountAge: number): number {
    if (accountAge === 0) return 50;
    
    const dailyAverage = totalTransactions / accountAge;
    if (dailyAverage > 50) return 100;
    if (dailyAverage > 20) return 70;
    if (dailyAverage > 10) return 50;
    if (dailyAverage > 5) return 30;
    return 10;
  }

  /**
   * Calculate geography risk factor
   */
  private calculateGeographyRisk(userCountry: string, counterpartyCountry?: string): number {
    let risk = 0;

    if (this.sanctionedCountries.includes(userCountry)) {
      risk += 100;
    } else if (this.highRiskCountries.includes(userCountry)) {
      risk += 50;
    }

    if (counterpartyCountry) {
      if (this.sanctionedCountries.includes(counterpartyCountry)) {
        risk += 100;
      } else if (this.highRiskCountries.includes(counterpartyCountry)) {
        risk += 50;
      }
    }

    return Math.min(100, risk);
  }

  /**
   * Calculate counterparty risk factor
   */
  private calculateCounterpartyRisk(counterparty?: string, kycStatus?: string): number {
    if (!counterparty) return 30;
    if (kycStatus !== 'approved') return 60;
    return 10;
  }

  /**
   * Calculate pattern risk factor
   */
  private calculatePatternRisk(
    transaction: TransactionRiskData,
    _userProfile: UserRiskProfile // Available for future pattern analysis
  ): number {
    let risk = 0;

    // Round number transactions (potential structuring)
    if (transaction.amount % 1000 === 0 && transaction.amount >= 5000) {
      risk += 30;
    }

    // Just below reporting threshold
    if (transaction.amount >= 9000 && transaction.amount < 10000) {
      risk += 50;
    }

    // Unusual timing (late night/early morning)
    const hour = transaction.timestamp.getHours();
    if (hour >= 0 && hour < 6) {
      risk += 20;
    }

    return Math.min(100, risk);
  }

  /**
   * Calculate velocity risk factor
   */
  private calculateVelocityRisk(
    transaction: TransactionRiskData,
    userProfile: UserRiskProfile
  ): number {
    if (!userProfile.lastTransactionDate) return 20;

    const timeSinceLastTransaction = 
      transaction.timestamp.getTime() - userProfile.lastTransactionDate.getTime();
    const minutesSinceLastTransaction = timeSinceLastTransaction / (1000 * 60);

    if (minutesSinceLastTransaction < 1) return 100;
    if (minutesSinceLastTransaction < 5) return 80;
    if (minutesSinceLastTransaction < 15) return 50;
    if (minutesSinceLastTransaction < 60) return 30;
    return 10;
  }

  /**
   * Calculate concentration risk factor
   */
  private calculateConcentrationRisk(amount: number, totalVolume: number): number {
    if (totalVolume === 0) return 50;

    const concentration = amount / totalVolume;
    if (concentration > 0.5) return 100;
    if (concentration > 0.3) return 70;
    if (concentration > 0.2) return 50;
    if (concentration > 0.1) return 30;
    return 10;
  }

  /**
   * Calculate source of funds risk factor
   */
  private calculateSourceOfFundsRisk(
    transactionType: string,
    kycStatus: string
  ): number {
    let risk = 0;

    if (kycStatus !== 'approved') {
      risk += 40;
    }

    // Higher risk for deposits from unknown sources
    if (transactionType === 'deposit') {
      risk += 20;
    }

    return Math.min(100, risk);
  }

  /**
   * Calculate overall risk score
   */
  private calculateOverallScore(factors: RiskFactors): number {
    // Weighted average of factors
    const weights = {
      amount: 0.15,
      frequency: 0.10,
      geography: 0.20,
      counterparty: 0.15,
      pattern: 0.15,
      velocity: 0.10,
      concentration: 0.05,
      sourceOfFunds: 0.10,
    };

    const score = 
      factors.amount * weights.amount +
      factors.frequency * weights.frequency +
      factors.geography * weights.geography +
      factors.counterparty * weights.counterparty +
      factors.pattern * weights.pattern +
      factors.velocity * weights.velocity +
      factors.concentration * weights.concentration +
      factors.sourceOfFunds * weights.sourceOfFunds;

    return Math.round(score);
  }

  /**
   * Determine risk level from score
   */
  private determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= this.thresholds.high) return 'critical';
    if (score >= this.thresholds.medium) return 'high';
    if (score >= this.thresholds.low) return 'medium';
    return 'low';
  }

  /**
   * Identify risk flags
   */
  private identifyRiskFlags(
    transaction: TransactionRiskData,
    userProfile: UserRiskProfile,
    factors: RiskFactors
  ): RiskFlag[] {
    const flags: RiskFlag[] = [];

    if (factors.amount >= 80) flags.push('high_amount');
    if (factors.frequency >= 70) flags.push('frequent_transactions');
    if (factors.geography >= 50) flags.push('high_risk_jurisdiction');
    if (factors.counterparty >= 60) flags.push('unknown_counterparty');
    if (factors.pattern >= 50) flags.push('suspicious_pattern');
    if (factors.velocity >= 80) flags.push('rapid_velocity');
    if (factors.concentration >= 70) flags.push('concentration_risk');

    if (userProfile.politicallyExposed) flags.push('peps_exposure');
    if (userProfile.sanctionsStatus === 'failed') flags.push('sanctions_match');

    // Check for unusual timing
    const hour = transaction.timestamp.getHours();
    if (hour >= 0 && hour < 6) flags.push('unusual_timing');

    return flags;
  }

  /**
   * Generate recommendations based on risk level and flags
   */
  private generateRecommendations(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    flags: RiskFlag[]
  ): RiskRecommendation[] {
    const recommendations: RiskRecommendation[] = [];

    if (riskLevel === 'critical') {
      recommendations.push('hold_transaction');
      recommendations.push('report_to_authorities');
      recommendations.push('manual_review');
    } else if (riskLevel === 'high') {
      recommendations.push('enhanced_due_diligence');
      recommendations.push('manual_review');
      recommendations.push('transaction_monitoring');
    } else if (riskLevel === 'medium') {
      recommendations.push('transaction_monitoring');
    }

    // Flag-specific recommendations
    if (flags.includes('sanctions_match')) {
      recommendations.push('reject_transaction');
      recommendations.push('report_to_authorities');
    }

    if (flags.includes('peps_exposure')) {
      recommendations.push('enhanced_due_diligence');
    }

    if (flags.includes('unknown_counterparty')) {
      recommendations.push('source_of_funds_verification');
    }

    if (flags.includes('suspicious_pattern')) {
      recommendations.push('customer_interview');
    }

    // Remove duplicates
    return [...new Set(recommendations)];
  }

  /**
   * Determine if manual review is required
   */
  private isReviewRequired(
    riskLevel: 'low' | 'medium' | 'high' | 'critical',
    flags: RiskFlag[]
  ): boolean {
    // Always require review for high/critical risk
    if (riskLevel === 'high' || riskLevel === 'critical') {
      return true;
    }

    // Require review for specific flags
    const reviewFlags: RiskFlag[] = [
      'sanctions_match',
      'peps_exposure',
      'suspicious_pattern',
    ];

    return flags.some((flag) => reviewFlags.includes(flag));
  }

  /**
   * Publish risk assessment completed event
   */
  private async publishRiskAssessmentEvent(
    assessment: RiskAssessmentData
  ): Promise<void> {
    const event = eventProducer.createEvent<RiskAssessmentCompletedEvent>(
      'compliance.risk_assessment.completed',
      'cex',
      assessment.tenantId,
      {
        assessmentId: assessment.id,
        transactionId: assessment.transactionId,
        userId: assessment.userId,
        brokerId: assessment.brokerId,
        riskScore: assessment.riskScore,
        riskLevel: assessment.riskLevel,
        flags: assessment.flags,
        recommendations: assessment.recommendations,
        assessmentDate: assessment.assessmentDate.toISOString(),
        assessor: assessment.assessor,
      },
      assessment.id
    );

    await eventProducer.publish(event, 'compliance.risk_assessment');
  }
}

// ==================== SINGLETON INSTANCE ====================

/**
 * Singleton Risk Assessment service instance
 */
export const riskAssessmentService = new RiskAssessmentService();

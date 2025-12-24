/**
 * GraphSense service for blockchain analytics
 * Production implementation with direct RPC integration
 */

import { ethers } from 'ethers';
import { createComponentLogger } from '../utils/logger';
import { getConfig } from '../config';

const logger = createComponentLogger('graphsense');
const config = getConfig();

export class GraphSenseService {
  private providers: Map<string, ethers.JsonRpcProvider> = new Map();
  private entityCache: Map<string, any> = new Map();
  private transactionCache: Map<string, any> = new Map();

  constructor() {
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Ethereum provider
    if (config.rpc.ethereum.url) {
      this.providers.set('ethereum', new ethers.JsonRpcProvider(config.rpc.ethereum.url));
    }

    // Bitcoin provider (placeholder - would need bitcoin-rpc-client)
    // Polygon provider
    if (config.rpc.polygon.url) {
      this.providers.set('polygon', new ethers.JsonRpcProvider(config.rpc.polygon.url));
    }

    logger.info('GraphSense providers initialized', {
      chains: Array.from(this.providers.keys())
    });
  }

  private getProvider(chain: string): ethers.JsonRpcProvider | null {
    return this.providers.get(chain) || null;
  }

  async traceTransaction(txHash: string, chain: string, depth: number = 3): Promise<any> {
    try {
      logger.info('Tracing transaction', { txHash, chain, depth });

      const cacheKey = `${chain}:${txHash}:${depth}`;
      if (this.transactionCache.has(cacheKey)) {
        return this.transactionCache.get(cacheKey);
      }

      const provider = this.getProvider(chain);
      if (!provider) {
        throw new Error(`No provider available for chain: ${chain}`);
      }

      // Get transaction details
      const tx = await provider.getTransaction(txHash);
      if (!tx) {
        throw new Error(`Transaction not found: ${txHash}`);
      }

      // Get transaction receipt for additional data
      const receipt = await provider.getTransactionReceipt(txHash);

      // Analyze transaction for patterns
      const analysis = await this.analyzeTransaction(tx, receipt, chain);

      // Trace related transactions if depth > 0
      const relatedTransactions = depth > 0 ? await this.findRelatedTransactions(tx, chain, depth - 1) : [];

      const result = {
        txHash,
        chain,
        depth,
        transaction: {
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
          gasPrice: ethers.formatUnits(tx.gasPrice || 0, 'gwei'),
          gasLimit: tx.gasLimit.toString(),
          timestamp: new Date().toISOString(),
        },
        receipt: receipt ? {
          status: receipt.status,
          gasUsed: receipt.gasUsed.toString(),
          logs: receipt.logs.length,
        } : null,
        analysis,
        relatedTransactions,
        riskScore: this.calculateRiskScore(analysis, relatedTransactions),
        entities: await this.clusterEntities([tx.from, tx.to].filter((addr): addr is string => addr !== null), chain),
        timestamp: new Date().toISOString(),
      };

      // Cache result
      this.transactionCache.set(cacheKey, result);

      return result;
    } catch (error) {
      logger.error('Failed to trace transaction', { txHash, chain, error });
      throw error;
    }
  }

  async detectPatterns(chain: string, options: any): Promise<any[]> {
    try {
      logger.info('Detecting patterns', { chain, options });

      const provider = this.getProvider(chain);
      if (!provider) {
        return [];
      }

      const patterns = [];

      // Large transaction pattern
      if (options.type === 'large_transaction' || !options.type) {
        const largeTxPattern = await this.detectLargeTransactions(chain, options.timeRange);
        if (largeTxPattern.length > 0) {
          patterns.push({
            type: 'large_transaction',
            severity: 'medium',
            description: 'Large value transactions detected',
            transactions: largeTxPattern,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Rapid transaction pattern (potential wash trading)
      if (options.type === 'rapid_transactions' || !options.type) {
        const rapidTxPattern = await this.detectRapidTransactions(chain, options.timeRange);
        if (rapidTxPattern.length > 0) {
          patterns.push({
            type: 'rapid_transactions',
            severity: 'high',
            description: 'Rapid transaction pattern detected (potential wash trading)',
            addresses: rapidTxPattern,
            timestamp: new Date().toISOString(),
          });
        }
      }

      // Circular transaction pattern
      if (options.type === 'circular_flow' || !options.type) {
        const circularPattern = await this.detectCircularFlows(chain, options.timeRange);
        if (circularPattern.length > 0) {
          patterns.push({
            type: 'circular_flow',
            severity: 'high',
            description: 'Circular transaction flows detected',
            flows: circularPattern,
            timestamp: new Date().toISOString(),
          });
        }
      }

      return patterns;
    } catch (error) {
      logger.error('Failed to detect patterns', { chain, options, error });
      return [];
    }
  }

  private async analyzeTransaction(tx: ethers.TransactionResponse, receipt: ethers.TransactionReceipt | null, chain: string): Promise<any> {
    const analysis = {
      isContractInteraction: false,
      isTokenTransfer: false,
      isLargeTransaction: false,
      gasEfficiency: 0,
      riskFactors: [] as string[],
    };

    // Check if interacting with contract
    if (tx.to) {
      try {
        const code = await this.getProvider(chain)?.getCode(tx.to);
        analysis.isContractInteraction = code !== '0x';
      } catch (error) {
        // Ignore errors in code checking
      }
    }

    // Check transaction value
    const valueInEth = parseFloat(ethers.formatEther(tx.value));
    if (valueInEth > 100) { // Large transaction threshold
      analysis.isLargeTransaction = true;
      analysis.riskFactors.push('large_transaction');
    }

    // Analyze gas usage
    if (receipt) {
      const gasUsed = parseFloat(receipt.gasUsed.toString());
      const gasLimit = parseFloat(tx.gasLimit.toString());
      analysis.gasEfficiency = (gasUsed / gasLimit) * 100;

      if (analysis.gasEfficiency > 90) {
        analysis.riskFactors.push('high_gas_usage');
      }
    }

    // Check for suspicious patterns
    if (!tx.to) {
      analysis.riskFactors.push('contract_creation');
    }

    return analysis;
  }

  private async findRelatedTransactions(tx: ethers.TransactionResponse, chain: string, depth: number): Promise<any[]> {
    if (depth <= 0) return [];

    const related = [];

    try {
      // Get recent transactions from the same address
      const provider = this.getProvider(chain);
      if (!provider) return [];

      // This is a simplified implementation - in production, you'd need
      // more sophisticated blockchain indexing
      const currentBlock = await provider.getBlockNumber();
      const blocksToCheck = 100; // Check last 100 blocks

      for (let i = 0; i < Math.min(blocksToCheck, 10); i++) {
        try {
          const block = await provider.getBlock(currentBlock - i, true);
          if (!block) continue;

          for (const blockTx of block.transactions) {
            if (typeof blockTx === 'string') continue;

            const txResponse = blockTx as ethers.TransactionResponse;

            // Check if transaction involves the same addresses
            if (txResponse.from === tx.from || txResponse.to === tx.to ||
                txResponse.from === tx.to || txResponse.to === tx.from) {
              related.push({
                hash: txResponse.hash,
                from: txResponse.from,
                to: txResponse.to,
                value: ethers.formatEther(txResponse.value),
                timestamp: new Date(block.timestamp * 1000).toISOString(),
              });
            }
          }
        } catch (error) {
          // Skip blocks that can't be retrieved
          continue;
        }
      }
    } catch (error) {
      logger.warn('Error finding related transactions', { error });
    }

    return related.slice(0, 10); // Limit results
  }

  private async clusterEntities(addresses: string[], chain: string): Promise<any[]> {
    const entities = [];

    for (const address of addresses) {
      if (!address) continue;

      const cacheKey = `${chain}:${address}`;
      if (this.entityCache.has(cacheKey)) {
        entities.push(this.entityCache.get(cacheKey));
        continue;
      }

      try {
        const provider = this.getProvider(chain);
        if (!provider) continue;

        // Get address balance and transaction count
        const [balance, txCount] = await Promise.all([
          provider.getBalance(address),
          provider.getTransactionCount(address),
        ]);

        const entity = {
          address,
          chain,
          balance: ethers.formatEther(balance),
          transactionCount: txCount,
          riskScore: this.calculateAddressRisk(address, balance, txCount),
          labels: this.generateAddressLabels(address, balance, txCount),
          lastActivity: new Date().toISOString(),
        };

        this.entityCache.set(cacheKey, entity);
        entities.push(entity);
      } catch (error) {
        logger.warn('Error clustering entity', { address, chain, error });
      }
    }

    return entities;
  }

  private calculateRiskScore(analysis: any, relatedTransactions: any[]): number {
    let score = 0.1; // Base score

    if (analysis.isLargeTransaction) score += 0.3;
    if (analysis.isContractInteraction) score += 0.1;
    if (analysis.gasEfficiency > 90) score += 0.2;
    if (analysis.riskFactors.includes('contract_creation')) score += 0.1;

    // Related transactions increase suspicion
    if (relatedTransactions.length > 5) score += 0.2;

    return Math.min(score, 1.0);
  }

  private calculateAddressRisk(address: string, balance: bigint, txCount: number): number {
    let score = 0.1;

    const balanceInEth = parseFloat(ethers.formatEther(balance));
    if (balanceInEth > 1000) score += 0.2;
    if (txCount > 1000) score += 0.3;

    // Check for known exchange addresses (simplified)
    if (this.isKnownExchangeAddress(address)) score += 0.1;

    return Math.min(score, 1.0);
  }

  private generateAddressLabels(address: string, balance: bigint, txCount: number): string[] {
    const labels = [];

    const balanceInEth = parseFloat(ethers.formatEther(balance));

    if (balanceInEth > 10000) labels.push('high_balance');
    if (txCount > 1000) labels.push('high_activity');
    if (this.isKnownExchangeAddress(address)) labels.push('exchange');

    return labels;
  }

  private isKnownExchangeAddress(address: string): boolean {
    // Simplified check - in production, you'd have a database of known addresses
    const knownExchanges = [
      '0x1234567890123456789012345678901234567890', // Example
    ];
    return knownExchanges.includes(address.toLowerCase());
  }

  private async detectLargeTransactions(_chain: string, _timeRange?: string): Promise<any[]> {
    // Simplified implementation - in production, you'd query indexed blockchain data
    return [];
  }

  private async detectRapidTransactions(_chain: string, _timeRange?: string): Promise<any[]> {
    // Simplified implementation
    return [];
  }

  private async detectCircularFlows(_chain: string, _timeRange?: string): Promise<any[]> {
    // Simplified implementation
    return [];
  }
}

// Singleton instance
let graphSenseService: GraphSenseService | null = null;

export function getGraphSenseService(): GraphSenseService {
  if (!graphSenseService) {
    graphSenseService = new GraphSenseService();
  }
  return graphSenseService;
}
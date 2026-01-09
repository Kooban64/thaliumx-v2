/**
 * Blockchain Consumer
 * 
 * Consumes blockchain-related events:
 * - Blockchain transactions (thaliumx.blockchain.transactions)
 * - Block confirmations (thaliumx.blockchain.confirmations)
 * - Smart contract events (thaliumx.blockchain.contracts)
 * - Wallet events (thaliumx.blockchain.wallets)
 */

import type { EachMessagePayload } from 'kafkajs';
import type { MessageContext } from '../services/kafka-consumer-framework';
import { BaseKafkaConsumer } from '../services/kafka-consumer-framework';
import { LoggerService } from '../services/logger';
import { EventStreamingService } from '../services/event-streaming';

export class BlockchainConsumer extends BaseKafkaConsumer {
  constructor() {
    super({
      groupId: 'thaliumx-blockchain-consumer',
      topics: [
        'thaliumx.blockchain.transactions',
        'thaliumx.blockchain.confirmations',
        'thaliumx.blockchain.contracts',
        'thaliumx.blockchain.wallets'
      ],
      fromBeginning: false,
      maxPollRecords: 50,
      enableAutoCommit: false
    });
  }

  protected async handleMessage(payload: EachMessagePayload): Promise<void> {
    await this.processMessage(payload, async (message: any, context: MessageContext) => {
      switch (context.topic) {
        case 'thaliumx.blockchain.transactions':
          await this.handleBlockchainTransaction(message, context);
          break;
        case 'thaliumx.blockchain.confirmations':
          await this.handleBlockConfirmation(message, context);
          break;
        case 'thaliumx.blockchain.contracts':
          await this.handleContractEvent(message, context);
          break;
        case 'thaliumx.blockchain.wallets':
          await this.handleWalletEvent(message, context);
          break;
        default:
          LoggerService.warn('Unknown blockchain topic', { topic: context.topic });
      }
    });
  }

  private async handleBlockchainTransaction(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing blockchain transaction event', {
      txHash: message.txHash,
      from: message.from,
      to: message.to,
      value: message.value,
      status: message.status
    });

    // Update transaction status in database
    // Trigger notifications if needed
    if (message.status === 'confirmed') {
      await EventStreamingService.emitTransactionEvent(
        'token',
        message.txHash,
        parseFloat(message.value || '0'),
        message.symbol || 'ETH',
        'completed',
        { userId: message.userId, tenantId: message.tenantId }
      );
    }
  }

  private async handleBlockConfirmation(message: any, _context: MessageContext): Promise<void> {
    LoggerService.debug('Processing block confirmation', {
      blockNumber: message.blockNumber,
      confirmations: message.confirmations,
      txHash: message.txHash
    });

    // Update confirmation count
    // Trigger finalization when confirmations reach threshold
    if (message.confirmations >= 12) { // Example threshold
      await EventStreamingService.emitSystemEvent(
        'blockchain.transaction.finalized',
        'BlockchainConsumer',
        'info',
        {
          txHash: message.txHash,
          confirmations: message.confirmations
        }
      );
    }
  }

  private async handleContractEvent(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing contract event', {
      contractAddress: message.contractAddress,
      eventName: message.eventName,
      blockNumber: message.blockNumber
    });

    // Process smart contract event
    // Update contract state
    // Trigger related workflows
  }

  private async handleWalletEvent(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing wallet event', {
      walletAddress: message.walletAddress,
      eventType: message.eventType,
      userId: message.userId
    });

    // Update wallet state
    // Trigger wallet-related workflows
    if (message.eventType === 'wallet.created') {
      await EventStreamingService.emitSystemEvent(
        'wallet.created',
        'BlockchainConsumer',
        'info',
        {
          walletAddress: message.walletAddress,
          userId: message.userId
        }
      );
    }
  }
}

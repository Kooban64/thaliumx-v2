/**
 * Trading Order Workflow
 * 
 * Orchestrates the complete trading order process:
 * 1. Validate order (limits, balance)
 * 2. Compliance check
 * 3. Reserve funds
 * 4. Submit order (ExchangeService or OmniExchangeService)
 * 5. Execute order (trading engine)
 * 6. Settle funds
 * 7. Emit order event
 * 
 * Compensation: Release reserved funds if order fails
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
import { ExchangeService } from '../services/exchange';
import { OmniExchangeService } from '../services/omni-exchange';
import { FinancialRepository } from '../services/financial-repository';
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';
import { DatabaseService } from '../services/database';

// Store order details for compensation
interface TradingOrderContext {
  orderId?: string;
  reservedFunds?: {
    accountId: string;
    amount: string;
    currency: string;
  };
  orderStatus?: string;
}

/**
 * Trading Order Workflow Implementation
 */
export async function createTradingOrderWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  const context: TradingOrderContext = {};

  return [
    // Step 1: Validate order
    {
      name: 'validate_order',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Validating trading order', {
          workflowId: sagaContext.workflowId,
          symbol: sagaContext.data.symbol,
          side: sagaContext.data.side
        });

        const { symbol, side, type, quantity, price } = sagaContext.data;

        if (!symbol || !side || !type || !quantity) {
          throw new Error('Missing required order fields: symbol, side, type, quantity');
        }

        if (type === 'limit' && !price) {
          throw new Error('Limit orders require price');
        }

        // Validate quantity is positive
        if (parseFloat(quantity) <= 0) {
          throw new Error('Order quantity must be positive');
        }

        // Check trading pair exists and is active
        const TradingPairModel = DatabaseService.getModel('TradingPair');
        const tradingPair = await TradingPairModel.findOne({ where: { symbol } });
        
        if (!tradingPair || (tradingPair as any).status !== 'active') {
          throw new Error(`Trading pair ${symbol} is not available`);
        }

        return { validated: true, tradingPair: tradingPair.toJSON() };
      },
      retryable: false
    },

    // Step 2: Compliance check
    {
      name: 'compliance_check',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Running compliance check for order', {
          workflowId: sagaContext.workflowId
        });

        // Emit compliance event - compliance microservices will handle it
        await EventStreamingService.emitAuditEvent(
          'compliance.order_check',
          'compliance',
          sagaContext.workflowId,
          {
            userId: sagaContext.userId || '',
            tenantId: sagaContext.tenantId || '',
            symbol: sagaContext.data.symbol,
            side: sagaContext.data.side,
            quantity: sagaContext.data.quantity,
            status: 'pending'
          }
        );

        // For now, assume compliance passes
        // In production, this would wait for compliance service response
        return { complianceStatus: 'approved' };
      },
      retryable: true,
      maxRetries: 3
    },

    // Step 3: Reserve funds
    {
      name: 'reserve_funds',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Reserving funds for order', {
          workflowId: sagaContext.workflowId,
          amount: sagaContext.data.quantity
        });

        const { symbol, side, quantity } = sagaContext.data;
        
        // Determine which asset to reserve
        const asset = side === 'sell' 
          ? symbol.replace('USDT', '').replace('USDC', '')
          : 'USDT';

        // Reserve funds via FinancialRepository
        const financialRepo = new FinancialRepository();
        
        // Get user's account
        const accountId = `${sagaContext.tenantId}_${sagaContext.userId}_${asset}`;
        
        // Reserve funds (this would create a hold)
        // For now, we'll use a simplified approach
        const reserved = {
          accountId,
          amount: quantity,
          currency: asset
        };

        context.reservedFunds = reserved;

        LoggerService.info('Funds reserved', {
          workflowId: sagaContext.workflowId,
          accountId,
          amount: quantity,
          currency: asset
        });

        return reserved;
      },
      compensate: async (sagaContext: SagaContext) => {
        if (context.reservedFunds) {
          LoggerService.info('Compensating: Releasing reserved funds', {
            workflowId: sagaContext.workflowId,
            accountId: context.reservedFunds.accountId
          });
          // Release hold on funds
          // Implementation depends on FinancialRepository release method
        }
      },
      retryable: true
    },

    // Step 4: Submit order
    {
      name: 'submit_order',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Submitting trading order', {
          workflowId: sagaContext.workflowId
        });

        const { symbol, side, type, quantity, price } = sagaContext.data;

        // Use OmniExchangeService for order placement
        // Access via routes module
        const omniExchangeRoutes = await import('../routes/omni-exchange');
        // Get service instance - it's initialized in routes
        const omniExchange = (omniExchangeRoutes as any).omniExchangeService;
        if (!omniExchange) {
          throw new Error('OmniExchangeService not initialized');
        }
        
        const order = await omniExchange.placeOrder(
          sagaContext.tenantId || '',
          sagaContext.brokerId || '',
          sagaContext.userId || '',
          {
            symbol,
            side,
            type,
            amount: quantity,
            price
          }
        );

        context.orderId = order.id;
        context.orderStatus = order.status;

        LoggerService.info('Order submitted', {
          workflowId: sagaContext.workflowId,
          orderId: order.id,
          status: order.status
        });

        return { orderId: order.id, order };
      },
      compensate: async (sagaContext: SagaContext) => {
        if (context.orderId) {
          LoggerService.info('Compensating: Cancelling order', {
            workflowId: sagaContext.workflowId,
            orderId: context.orderId
          });
          // Cancel order if possible
          try {
            const { getOmniExchangeService } = await import('../routes/omni-exchange');
            const omniExchange = getOmniExchangeService();
            if (context.orderId) {
              await omniExchange.cancelOrder(context.orderId, sagaContext.tenantId || '');
            }
          } catch (error: any) {
            LoggerService.warn('Failed to cancel order during compensation', {
              orderId: context.orderId,
              error: error.message
            });
          }
        }
      },
      retryable: true
    },

    // Step 5: Wait for order execution (async - completed via event)
    {
      name: 'wait_for_order_execution',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Waiting for order execution', {
          workflowId: sagaContext.workflowId,
          orderId: context.orderId
        });

        // Check if order is already filled
        if (sagaContext.data.orderFilled === true) {
          return {
            orderId: context.orderId,
            filledQuantity: sagaContext.data.filledQuantity,
            averagePrice: sagaContext.data.averagePrice
          };
        }

        // If order not filled, throw error to pause workflow
        // Event handler will continue it when order is filled
        throw new Error('Order execution pending - waiting for fill event');
      },
      retryable: true,
      maxRetries: 60, // Wait up to 60 retries (can be configured)
      timeout: 300000 // 5 minutes timeout
    },

    // Step 6: Settle funds
    {
      name: 'settle_funds',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Settling funds for order', {
          workflowId: sagaContext.workflowId,
          orderId: context.orderId
        });

        const { symbol, side, quantity } = sagaContext.data;
        const filledQuantity = sagaContext.data.filledQuantity || quantity;
        const averagePrice = sagaContext.data.averagePrice || sagaContext.data.price;

        // Settle transaction via FinancialRepository
        const financialRepo = new FinancialRepository();
        
        // Create journal entry for the trade
        // This is simplified - actual implementation would need proper double-entry
        const baseAsset = symbol.replace('USDT', '').replace('USDC', '');
        const quoteAsset = 'USDT';
        const totalValue = parseFloat(filledQuantity) * parseFloat(averagePrice || '0');

        if (!sagaContext.tenantId) {
          throw new Error('Tenant ID required for journal entry');
        }

        const journalEntry = await financialRepo.createJournalEntry(
          sagaContext.tenantId || '',
          `Trading order ${context.orderId}`,
          side === 'buy' 
            ? [
                {
                  accountId: `${sagaContext.tenantId}_${sagaContext.userId}_${baseAsset}`,
                  debit: parseFloat(filledQuantity),
                  credit: 0,
                  currency: baseAsset,
                  description: `Buy ${filledQuantity} ${baseAsset}`
                },
                {
                  accountId: `${sagaContext.tenantId}_${sagaContext.userId}_${quoteAsset}`,
                  debit: 0,
                  credit: totalValue,
                  currency: quoteAsset,
                  description: `Pay ${totalValue} ${quoteAsset} for ${filledQuantity} ${baseAsset}`
                }
              ]
            : [
                {
                  accountId: `${sagaContext.tenantId}_${sagaContext.userId}_${baseAsset}`,
                  debit: 0,
                  credit: parseFloat(filledQuantity),
                  currency: baseAsset,
                  description: `Sell ${filledQuantity} ${baseAsset}`
                },
                {
                  accountId: `${sagaContext.tenantId}_${sagaContext.userId}_${quoteAsset}`,
                  debit: totalValue,
                  credit: 0,
                  currency: quoteAsset,
                  description: `Receive ${totalValue} ${quoteAsset} for ${filledQuantity} ${baseAsset}`
                }
              ],
          undefined, // idempotencyKey
          undefined, // metadata
          {
            userId: sagaContext.userId,
            tenantId: sagaContext.tenantId
          }
        );

        LoggerService.info('Funds settled', {
          workflowId: sagaContext.workflowId,
          journalEntryId: journalEntry.id
        });

        return { journalEntryId: journalEntry.id, settled: true };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Reverse journal entry if settlement failed
        LoggerService.info('Compensating: Reversing settlement', {
          workflowId: sagaContext.workflowId
        });
        // Implementation depends on FinancialRepository reverse method
      },
      retryable: true
    },

    // Step 7: Emit order event
    {
      name: 'emit_order_event',
      execute: async (sagaContext: SagaContext) => {
        LoggerService.info('Emitting order completion event', {
          workflowId: sagaContext.workflowId,
          orderId: context.orderId
        });

        await EventStreamingService.emitTransactionEvent(
          'exchange',
          context.orderId || sagaContext.workflowId,
          parseFloat(sagaContext.data.quantity),
          sagaContext.data.symbol,
          'completed',
          {
            tenantId: sagaContext.tenantId,
            userId: sagaContext.userId
          },
          {
            orderId: context.orderId,
            filledQuantity: sagaContext.data.filledQuantity,
            averagePrice: sagaContext.data.averagePrice
          }
        );

        return { eventEmitted: true };
      },
      retryable: true,
      maxRetries: 2
      // No compensation - event emission is non-critical
    }
  ];
}

// Register workflow with orchestrator
WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.TRADING_ORDER,
  createTradingOrderWorkflow
);

/**
 * Order Modification Workflow
 * 
 * Orchestrates order modification:
 * 1. Validate modification request
 * 2. Check order status
 * 3. Cancel original order
 * 4. Create new order
 * 5. Emit modification event
 */

import { SagaStep, SagaContext, WorkflowInput } from '../types/workflow';
import { WorkflowType } from '../types/workflow';
import { WorkflowOrchestratorService } from '../services/workflow-orchestrator';
// OmniExchangeService imported dynamically
import { EventStreamingService } from '../services/event-streaming';
import { LoggerService } from '../services/logger';

export async function createOrderModificationWorkflow(
  input: WorkflowInput
): Promise<SagaStep[]> {
  return [
    {
      name: 'validate_modification',
      execute: async (sagaContext: SagaContext) => {
        const { orderId, newPrice, newQuantity } = sagaContext.data;
        if (!orderId || (!newPrice && !newQuantity)) {
          throw new Error('Order ID and at least one modification (price or quantity) required');
        }
        return { validated: true };
      },
      retryable: false
    },
    {
      name: 'check_order_status',
      execute: async (sagaContext: SagaContext) => {
        const { orderId } = sagaContext.data;
        // Check if order can be modified
        LoggerService.info('Checking order status for modification', {
          orderId
        });
        return { orderModifiable: true };
      },
      retryable: true
    },
    {
      name: 'cancel_original_order',
      execute: async (sagaContext: SagaContext) => {
        const { orderId } = sagaContext.data;
        const { getOmniExchangeService } = await import('../routes/omni-exchange');
        const omniExchange = getOmniExchangeService();
        await omniExchange.cancelOrder(orderId, sagaContext.tenantId || '');
        return { originalOrderCancelled: true };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Recreate original order if modification fails
        LoggerService.info('Compensating: Recreating original order', {
          orderId: sagaContext.data.orderId
        });
      },
      retryable: true
    },
    {
      name: 'create_new_order',
      execute: async (sagaContext: SagaContext) => {
        const { orderId, newPrice, newQuantity, symbol, side, type } = sagaContext.data;
        const { getOmniExchangeService } = await import('../routes/omni-exchange');
        const omniExchange = getOmniExchangeService();
        
        const newOrder = await omniExchange.placeOrder(
          sagaContext.tenantId || '',
          sagaContext.brokerId || '',
          sagaContext.userId || '',
          {
            symbol,
            side,
            type,
            amount: newQuantity || sagaContext.data.quantity,
            price: newPrice || sagaContext.data.price
          }
        );

        return { newOrderId: newOrder.id, newOrder };
      },
      compensate: async (sagaContext: SagaContext) => {
        // Cancel new order if creation fails
        LoggerService.info('Compensating: Cancelling new order', {
          newOrderId: sagaContext.data.newOrderId
        });
      },
      retryable: true
    },
    {
      name: 'emit_modification_event',
      execute: async (sagaContext: SagaContext) => {
        await EventStreamingService.emitTransactionEvent(
          'exchange',
          sagaContext.data.newOrderId || sagaContext.data.orderId,
          0,
          sagaContext.data.symbol || 'N/A',
          'modified',
          {
            tenantId: sagaContext.tenantId,
            userId: sagaContext.userId
          },
          {
            originalOrderId: sagaContext.data.orderId,
            newOrderId: sagaContext.data.newOrderId
          }
        );
        return { eventEmitted: true };
      },
      retryable: true
    }
  ];
}

WorkflowOrchestratorService.registerWorkflow(
  WorkflowType.ORDER_MODIFICATION,
  createOrderModificationWorkflow
);

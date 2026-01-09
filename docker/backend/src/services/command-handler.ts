/**
 * Command Handler Service
 * 
 * CQRS Command Handler for write operations:
 * - Validates commands
 * - Executes business logic
 * - Emits events for read model updates
 * - Maintains consistency guarantees
 */

import { EventStreamingService } from './event-streaming';
import { LoggerService } from './logger';
import { v4 as uuidv4 } from 'uuid';

export interface Command {
  commandId: string;
  commandType: string;
  aggregateId: string;
  aggregateType: string;
  commandData: any;
  userId?: string;
  tenantId?: string;
  timestamp: string;
}

export interface CommandResult {
  success: boolean;
  aggregateId: string;
  version: number;
  events: string[];
  error?: string;
}

export class CommandHandlerService {
  private static isInitialized = false;
  private static commandHandlers: Map<string, (command: Command) => Promise<CommandResult>> = new Map();

  /**
   * Initialize command handler
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    LoggerService.info('Initializing Command Handler Service...');
    
    // Register command handlers
    this.registerCommandHandlers();
    
    this.isInitialized = true;
    LoggerService.info('✅ Command Handler Service initialized');
  }

  /**
   * Register command handlers
   */
  private static registerCommandHandlers(): void {
    // Register handlers for different command types
    // This is a simplified implementation - in production, use proper registration
    LoggerService.info('Command handlers registered');
  }

  /**
   * Register a command handler
   */
  public static registerHandler(
    commandType: string,
    handler: (command: Command) => Promise<CommandResult>
  ): void {
    this.commandHandlers.set(commandType, handler);
    LoggerService.info('Command handler registered', { commandType });
  }

  /**
   * Handle command
   */
  public static async handleCommand(command: Command): Promise<CommandResult> {
    try {
      // Validate command
      this.validateCommand(command);

      // Get handler for command type
      const handler = this.commandHandlers.get(command.commandType);
      if (!handler) {
        throw new Error(`No handler registered for command type: ${command.commandType}`);
      }

      // Execute command
      const result = await handler(command);

      // Emit events for read model updates
      if (result.success && result.events.length > 0) {
        await this.emitEvents(result.events, command);
      }

      LoggerService.info('Command handled successfully', {
        commandId: command.commandId,
        commandType: command.commandType,
        aggregateId: result.aggregateId
      });

      return result;
    } catch (error: any) {
      LoggerService.error('Failed to handle command', {
        commandId: command.commandId,
        commandType: command.commandType,
        error: error.message
      });

      return {
        success: false,
        aggregateId: command.aggregateId,
        version: 0,
        events: [],
        error: error.message
      };
    }
  }

  /**
   * Validate command
   */
  private static validateCommand(command: Command): void {
    if (!command.commandId) {
      throw new Error('Command must have commandId');
    }
    if (!command.commandType) {
      throw new Error('Command must have commandType');
    }
    if (!command.aggregateId) {
      throw new Error('Command must have aggregateId');
    }
    if (!command.aggregateType) {
      throw new Error('Command must have aggregateType');
    }
    if (!command.commandData) {
      throw new Error('Command must have commandData');
    }
  }

  /**
   * Emit events for read model updates
   */
  private static async emitEvents(eventIds: string[], command: Command): Promise<void> {
    try {
      // Events are already stored in event store
      // Emit to read model update topics
      for (const eventId of eventIds) {
        await EventStreamingService.emitSystemEvent(
          'readmodel.update.required',
          'CommandHandler',
          'info',
          {
            eventId,
            aggregateId: command.aggregateId,
            aggregateType: command.aggregateType,
            commandId: command.commandId
          }
        );
      }
    } catch (error) {
      LoggerService.error('Failed to emit events for read model update', { error });
      // Don't throw - event emission failure shouldn't fail command
    }
  }

  /**
   * Create command
   */
  public static createCommand(
    commandType: string,
    aggregateId: string,
    aggregateType: string,
    commandData: any,
    userId?: string,
    tenantId?: string
  ): Command {
    return {
      commandId: uuidv4(),
      commandType,
      aggregateId,
      aggregateType,
      commandData,
      userId,
      tenantId,
      timestamp: new Date().toISOString()
    };
  }
}

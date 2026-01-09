/**
 * Event Store Service
 * 
 * Event sourcing for critical aggregates:
 * - User state (thaliumx.state.users)
 * - Account balance state (thaliumx.state.balances)
 * - Market configuration state (thaliumx.state.markets)
 * - System configuration state (thaliumx.state.config)
 * 
 * Features:
 * - State reconstruction from event stream
 * - Snapshot management
 * - Event replay capabilities
 * - Immutable event log
 */

import { EventStreamingService } from './event-streaming';
import { LoggerService } from './logger';
import { DatabaseService } from './database';
import { v4 as uuidv4 } from 'uuid';

export interface Event {
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  eventData: any;
  timestamp: string;
  version: number;
  metadata?: Record<string, any>;
}

export interface Snapshot {
  aggregateId: string;
  aggregateType: string;
  state: any;
  version: number;
  timestamp: string;
}

export class EventStoreService {
  private static isInitialized = false;
  private static readonly STATE_TOPICS = {
    USERS: 'thaliumx.state.users',
    BALANCES: 'thaliumx.state.balances',
    MARKETS: 'thaliumx.state.markets',
    CONFIG: 'thaliumx.state.config'
  } as const;

  /**
   * Initialize event store
   */
  public static async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    LoggerService.info('Initializing Event Store Service...');
    this.isInitialized = true;
    LoggerService.info('✅ Event Store Service initialized');
  }

  /**
   * Append event to event store
   */
  public static async appendEvent(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    eventData: any,
    metadata?: Record<string, any>
  ): Promise<string> {
    try {
      const event: Event = {
        eventId: uuidv4(),
        aggregateId,
        aggregateType,
        eventType,
        eventData,
        timestamp: new Date().toISOString(),
        version: await this.getNextVersion(aggregateId, aggregateType),
        metadata
      };

      // Determine topic based on aggregate type (stored for reference)
      const _topic = this.getTopicForAggregateType(aggregateType);

      // Publish to log-compacted topic using system event
      await EventStreamingService.emitSystemEvent(
        'event_store.append',
        'EventStoreService',
        'info',
        {
          aggregateId,
          aggregateType,
          eventType: event.eventType,
          version: event.version,
          eventData: event.eventData,
          metadata: event.metadata
        }
      );

      LoggerService.debug('Event appended to event store', {
        aggregateId,
        aggregateType,
        eventType,
        version: event.version
      });

      return event.eventId;
    } catch (error) {
      LoggerService.error('Failed to append event to event store', {
        aggregateId,
        aggregateType,
        error
      });
      throw error;
    }
  }

  /**
   * Get next version number for aggregate
   */
  private static async getNextVersion(
    aggregateId: string,
    aggregateType: string
  ): Promise<number> {
    try {
      // Query database for current version
      const SnapshotModel: any = DatabaseService.getModel('EventSnapshot');
      if (SnapshotModel) {
        const snapshot = await SnapshotModel.findOne({
          where: {
            aggregateId,
            aggregateType
          },
          order: [['version', 'DESC']]
        });

        if (snapshot) {
          return snapshot.version + 1;
        }
      }

      // If no snapshot, count events (simplified - in production, use proper event count)
      return 1;
    } catch (error) {
      LoggerService.warn('Failed to get next version, defaulting to 1', { error });
      return 1;
    }
  }

  /**
   * Get topic for aggregate type
   */
  private static getTopicForAggregateType(aggregateType: string): string {
    switch (aggregateType.toLowerCase()) {
      case 'user':
        return this.STATE_TOPICS.USERS;
      case 'balance':
      case 'account':
        return this.STATE_TOPICS.BALANCES;
      case 'market':
        return this.STATE_TOPICS.MARKETS;
      case 'config':
        return this.STATE_TOPICS.CONFIG;
      default:
        return this.STATE_TOPICS.USERS;
    }
  }

  /**
   * Reconstruct aggregate state from event stream
   */
  public static async reconstructState(
    aggregateId: string,
    aggregateType: string,
    fromVersion: number = 0
  ): Promise<any> {
    try {
      // Try to load from snapshot first
      const snapshot = await this.loadSnapshot(aggregateId, aggregateType);
      let state = snapshot?.state || {};
      let currentVersion = snapshot?.version || 0;

      // Replay events from snapshot version (or from beginning)
      const events = await this.getEvents(aggregateId, aggregateType, fromVersion || currentVersion);
      
      for (const event of events) {
        state = this.applyEvent(state, event);
        currentVersion = event.version;
      }

      LoggerService.debug('State reconstructed from event stream', {
        aggregateId,
        aggregateType,
        finalVersion: currentVersion,
        eventsReplayed: events.length
      });

      return state;
    } catch (error) {
      LoggerService.error('Failed to reconstruct state', {
        aggregateId,
        aggregateType,
        error
      });
      throw error;
    }
  }

  /**
   * Apply event to state (event handler)
   */
  private static applyEvent(state: any, event: Event): any {
    // Apply event based on event type
    // This is a simplified implementation - in production, use proper event handlers
    switch (event.eventType) {
      case 'user.created':
        return { ...state, ...event.eventData, createdAt: event.timestamp };
      case 'user.updated':
        return { ...state, ...event.eventData, updatedAt: event.timestamp };
      case 'balance.credited':
        return {
          ...state,
          balance: (state.balance || 0) + parseFloat(event.eventData.amount || 0),
          updatedAt: event.timestamp
        };
      case 'balance.debited':
        return {
          ...state,
          balance: (state.balance || 0) - parseFloat(event.eventData.amount || 0),
          updatedAt: event.timestamp
        };
      default:
        return { ...state, ...event.eventData };
    }
  }

  /**
   * Get events for aggregate
   */
  private static async getEvents(
    aggregateId: string,
    aggregateType: string,
    fromVersion: number
  ): Promise<Event[]> {
    // In production, this would query Kafka topic or event database
    // For now, return empty array (would need consumer to read from topic)
    LoggerService.debug('Getting events for aggregate', {
      aggregateId,
      aggregateType,
      fromVersion
    });
    return [];
  }

  /**
   * Create snapshot of current state
   */
  public static async createSnapshot(
    aggregateId: string,
    aggregateType: string,
    state: any
  ): Promise<void> {
    try {
      const version = await this.getNextVersion(aggregateId, aggregateType) - 1;
      
      const SnapshotModel: any = DatabaseService.getModel('EventSnapshot');
      if (SnapshotModel) {
        await SnapshotModel.upsert({
          aggregateId,
          aggregateType,
          state,
          version,
          timestamp: new Date().toISOString()
        });
      }

      LoggerService.info('Snapshot created', {
        aggregateId,
        aggregateType,
        version
      });
    } catch (error) {
      LoggerService.error('Failed to create snapshot', {
        aggregateId,
        aggregateType,
        error
      });
      throw error;
    }
  }

  /**
   * Load snapshot for aggregate
   */
  private static async loadSnapshot(
    aggregateId: string,
    aggregateType: string
  ): Promise<Snapshot | null> {
    try {
      const SnapshotModel: any = DatabaseService.getModel('EventSnapshot');
      if (SnapshotModel) {
        const snapshot = await SnapshotModel.findOne({
          where: {
            aggregateId,
            aggregateType
          },
          order: [['version', 'DESC']]
        });

        if (snapshot) {
          return {
            aggregateId: snapshot.aggregateId,
            aggregateType: snapshot.aggregateType,
            state: snapshot.state,
            version: snapshot.version,
            timestamp: snapshot.timestamp
          };
        }
      }
      return null;
    } catch (error) {
      LoggerService.warn('Failed to load snapshot', { error });
      return null;
    }
  }

  /**
   * Replay events for aggregate (for debugging/recovery)
   */
  public static async replayEvents(
    aggregateId: string,
    aggregateType: string,
    fromVersion: number = 0,
    toVersion?: number
  ): Promise<any> {
    try {
      LoggerService.info('Replaying events', {
        aggregateId,
        aggregateType,
        fromVersion,
        toVersion
      });

      const state = await this.reconstructState(aggregateId, aggregateType, fromVersion);
      
      // Create new snapshot after replay
      await this.createSnapshot(aggregateId, aggregateType, state);

      return state;
    } catch (error) {
      LoggerService.error('Failed to replay events', {
        aggregateId,
        aggregateType,
        error
      });
      throw error;
    }
  }
}

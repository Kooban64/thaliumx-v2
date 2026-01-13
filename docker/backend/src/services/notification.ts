/**
 * Notification Service
 * 
 * Service for sending notifications to users via various channels
 * Uses EventStreamingService to emit notification events
 */

import { EventStreamingService } from './event-streaming';
import { LoggerService } from './logger';
import { DatabaseService } from './database';

export interface NotificationOptions {
  userId?: string;
  userIds?: string[];
  title: string;
  message: string;
  type?: 'info' | 'warning' | 'error' | 'success';
  channels?: ('email' | 'inapp')[];
  metadata?: Record<string, unknown>;
}

export class NotificationService {
  /**
   * Send notification to a single user
   */
  static async sendNotification(options: NotificationOptions): Promise<void> {
    try {
      const channels = options.channels || ['inapp'];
      const userIds = options.userId ? [options.userId] : (options.userIds || []);

      for (const userId of userIds) {
        for (const channel of channels) {
          if (channel === 'inapp') {
            await EventStreamingService.emitSystemEvent(
              'limit_change_notification',
              'notifications',
              (options.type === 'error' ? 'error' : options.type === 'warning' ? 'warn' : 'info') as 'info' | 'warn' | 'error' | 'critical',
              {
                userId,
                title: options.title,
                message: options.message,
                ...options.metadata,
              },
              {}
            );
          } else if (channel === 'email') {
            // Emit email notification event
            await EventStreamingService.emitSystemEvent(
              'email_notification',
              'notifications',
              'info',
              {
                userId,
                subject: options.title,
                body: options.message,
                ...options.metadata,
              },
              {}
            );
          }
        }
      }

      LoggerService.info('Notification sent', {
        userIds: userIds.length,
        channels,
        type: options.type,
      });
    } catch (error) {
      LoggerService.error('Failed to send notification', { error, options });
      // Don't throw - notifications are non-critical
    }
  }

  /**
   * Notify users affected by limit changes
   */
  static async notifyLimitChange(
    changeType: 'kyc' | 'role' | 'user_override',
    target: string,
    affectedUserIds: string[],
    changes: Record<string, { before: unknown; after: unknown }>
  ): Promise<void> {
    try {
      const changeSummary = Object.entries(changes)
        .map(([key, { before, after }]) => {
          const beforeStr = typeof before === 'number' ? before.toLocaleString() : String(before || 'N/A');
          const afterStr = typeof after === 'number' ? after.toLocaleString() : String(after || 'N/A');
          return `${key}: ${beforeStr} → ${afterStr}`;
        })
        .join(', ');

      const title = `Limit Configuration Updated`;
      const message = `Your transaction limits have been updated (${changeType}: ${target}). Changes: ${changeSummary}`;

      await this.sendNotification({
        userIds: affectedUserIds,
        title,
        message,
        type: 'info',
        channels: ['inapp', 'email'],
        metadata: {
          changeType,
          target,
          changes,
        },
      });
    } catch (error) {
      LoggerService.error('Failed to notify limit change', { error });
    }
  }

  /**
   * Get users affected by a limit change
   */
  static async getAffectedUsers(
    changeType: 'kyc' | 'role',
    target: string
  ): Promise<string[]> {
    try {
      const UserModel: any = DatabaseService.getModel('User');
      if (!UserModel) {
        return [];
      }

      const where: any = {};
      if (changeType === 'kyc') {
        where.kycLevel = target;
      } else if (changeType === 'role') {
        where.role = target;
      }

      const users = await UserModel.findAll({
        where: { ...where, isActive: true },
        attributes: ['id'],
      });

      return users.map((u: any) => u.id);
    } catch (error) {
      LoggerService.error('Failed to get affected users', { error });
      return [];
    }
  }
}

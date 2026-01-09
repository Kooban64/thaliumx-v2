/**
 * Notification Consumer
 * 
 * Consumes notification events and routes to appropriate delivery channels:
 * - Email notifications (thaliumx.notifications.email)
 * - SMS notifications (thaliumx.notifications.sms)
 * - Push notifications (thaliumx.notifications.push)
 * - In-app notifications (thaliumx.notifications.inapp)
 */

import type { EachMessagePayload } from 'kafkajs';
import type { MessageContext } from '../services/kafka-consumer-framework';
import { BaseKafkaConsumer } from '../services/kafka-consumer-framework';
import { LoggerService } from '../services/logger';
import { EventStreamingService as _EventStreamingService } from '../services/event-streaming';

export class NotificationConsumer extends BaseKafkaConsumer {
  constructor() {
    super({
      groupId: 'thaliumx-notification-consumer',
      topics: [
        'thaliumx.notifications.email',
        'thaliumx.notifications.sms',
        'thaliumx.notifications.push',
        'thaliumx.notifications.inapp'
      ],
      fromBeginning: false,
      maxPollRecords: 50, // Lower batch size for notifications
      enableAutoCommit: false
    });
  }

  protected async handleMessage(payload: EachMessagePayload): Promise<void> {
    await this.processMessage(payload, async (message: any, context: MessageContext) => {
      switch (context.topic) {
        case 'thaliumx.notifications.email':
          await this.handleEmailNotification(message, context);
          break;
        case 'thaliumx.notifications.sms':
          await this.handleSMSNotification(message, context);
          break;
        case 'thaliumx.notifications.push':
          await this.handlePushNotification(message, context);
          break;
        case 'thaliumx.notifications.inapp':
          await this.handleInAppNotification(message, context);
          break;
        default:
          LoggerService.warn('Unknown notification topic', { topic: context.topic });
      }
    });
  }

  private async handleEmailNotification(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing email notification', {
      to: message.to,
      subject: message.subject,
      template: message.template
    });

    // Integrate with email service (SendGrid/SMTP)
    // This would call the actual email sending service
    try {
      // await EmailService.send(message);
      LoggerService.info('Email notification sent', { messageId: message.messageId });
    } catch (error) {
      LoggerService.error('Failed to send email notification', { error });
      throw error; // Will be caught by processMessage and sent to DLQ
    }
  }

  private async handleSMSNotification(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing SMS notification', {
      to: message.to,
      message: message.message?.substring(0, 50)
    });

    // Integrate with SMS service (Twilio)
    try {
      // await SMSService.send(message);
      LoggerService.info('SMS notification sent', { messageId: message.messageId });
    } catch (error) {
      LoggerService.error('Failed to send SMS notification', { error });
      throw error;
    }
  }

  private async handlePushNotification(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing push notification', {
      userId: message.userId,
      title: message.title,
      body: message.body?.substring(0, 50)
    });

    // Integrate with push notification service (FCM/APNS)
    try {
      // await PushNotificationService.send(message);
      LoggerService.info('Push notification sent', { messageId: message.messageId });
    } catch (error) {
      LoggerService.error('Failed to send push notification', { error });
      throw error;
    }
  }

  private async handleInAppNotification(message: any, _context: MessageContext): Promise<void> {
    LoggerService.info('Processing in-app notification', {
      userId: message.userId,
      type: message.type,
      data: message.data
    });

    // Store in database for in-app notification system
    try {
      // await InAppNotificationService.create(message);
      LoggerService.info('In-app notification created', { messageId: message.messageId });
    } catch (error) {
      LoggerService.error('Failed to create in-app notification', { error });
      throw error;
    }
  }
}

/**
 * Email Validation Service
 * 
 * Validates email addresses with format checking and optional disposable email domain blocking.
 */

import { LoggerService } from './logger';
import { RedisService } from './redis';
// createError imported but not used in this file

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  '10minutemail.com', 'tempmail.com', 'guerrillamail.com', 'mailinator.com',
  'throwaway.email', 'temp-mail.org', 'getnada.com', 'mohmal.com',
  'yopmail.com', 'sharklasers.com', 'grr.la', 'guerrillamailblock.com',
  'pokemail.net', 'spam4.me', 'bccto.me', 'chogmail.com', 'devnullmail.com',
  'maildrop.cc', 'meltmail.com', 'mintemail.com', 'mvrht.com',
  'mytrashmail.com', 'putthisinyourspamdatabase.com', 'sendspamhere.com',
  'spamgourmet.com', 'spamhole.com', 'trashmail.com', 'trashmailer.com',
  'trashymail.com', 'tempail.com', 'tempe-mail.com', 'tempinbox.co.uk',
  'tempinbox.com', 'tempmail.de', 'tempmail.it', 'tempmail2.com',
  'tempmailer.com', 'temptheir.com', 'thankyou2010.com',
  'thisisnotmyrealemail.com', 'throwam.com', 'tilien.com', 'tmail.ws',
  'tmailinator.com', 'toiea.com', 'tradermail.info', 'trash-amil.com',
  'trash-mail.at', 'trash-mail.com', 'trash-mail.de', 'trash2009.com',
  'trashemail.de', 'trashmail.at', 'trashmail.com', 'trashmail.de',
  'trashmail.me', 'trashmail.net', 'trashmail.org', 'trashmail.ws',
  'trashmailer.com', 'trashymail.com', 'turual.com', 'twinmail.de',
  'tyldd.com', 'uggsrock.com', 'umail.net', 'us.af', 'venompen.com',
  'veryrealemail.com', 'viditag.com', 'viewcastmedia.com', 'viewcastmedia.net',
  'viewcastmedia.org', 'webemail.me', 'webm4il.info', 'wh4f.org',
  'whyspam.me', 'willselfdestruct.com', 'winemaven.info', 'wronghead.com',
  'wuzup.net', 'wuzupmail.net', 'xagloo.com', 'xemaps.com', 'xents.com',
  'xmaily.com', 'xoxy.net', 'yapped.net', 'yeah.net', 'yep.it',
  'yogamaven.com', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'youmailr.com', 'ypmail.webnetic.co.uk', 'zippymail.info', 'zoemail.com',
  'zoemail.net', 'zoemail.org', 'zomg.info', 'zubee.com', 'zuvio.com', 'zzz.com',
]);

export class EmailValidatorService {
  private static readonly BLOCK_DISPOSABLE_EMAILS = process.env.BLOCK_DISPOSABLE_EMAILS === 'true';
  private static readonly VALIDATION_RATE_LIMIT = 10;

  public static validateFormat(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    if (email.length > 254) return false;
    const parts = email.split('@');
    if (parts.length !== 2) return false;
    const localPart = parts[0];
    const domain = parts[1];
    if (!localPart || localPart.length === 0 || localPart.length > 64) return false;
    if (!domain || domain.length === 0 || domain.length > 255) return false;
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return domainRegex.test(domain);
  }

  public static isDisposableEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    const parts = email.split('@');
    if (parts.length !== 2 || !parts[1]) return false;
    const domain = parts[1].toLowerCase();
    return DISPOSABLE_EMAIL_DOMAINS.has(domain);
  }

  public static async validate(
    email: string,
    ipAddress?: string,
    options: { blockDisposable?: boolean; rateLimit?: boolean } = {}
  ): Promise<{ valid: boolean; reason?: string }> {
    const blockDisposable = options.blockDisposable ?? this.BLOCK_DISPOSABLE_EMAILS;
    const rateLimit = options.rateLimit ?? true;

    if (rateLimit && ipAddress) {
      const rateLimitKey = `email_validation:${ipAddress}:${new Date().toISOString().slice(0, 16)}`;
      if (RedisService.isConnected()) {
        try {
          const count = await RedisService.increment(rateLimitKey);
          if (count === 1) await RedisService.expire(rateLimitKey, 60);
          if (count > this.VALIDATION_RATE_LIMIT) {
            LoggerService.warn('Email validation rate limit exceeded', { ipAddress, email: email.substring(0, 10) + '...' });
            return { valid: false, reason: 'Too many validation attempts. Please try again later.' };
          }
        } catch (error) {
          LoggerService.warn('Email validation rate limit check failed', { error: (error as Error).message });
        }
      }
    }

    if (!this.validateFormat(email)) {
      return { valid: false, reason: 'Invalid email format' };
    }

    if (blockDisposable && this.isDisposableEmail(email)) {
      LoggerService.warn('Disposable email blocked', { email: email.substring(0, 10) + '...' });
      return { valid: false, reason: 'Disposable email addresses are not allowed' };
    }

    return { valid: true };
  }

  public static normalize(email: string): string {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  }
}

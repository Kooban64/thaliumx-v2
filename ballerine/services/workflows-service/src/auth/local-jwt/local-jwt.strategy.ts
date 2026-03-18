import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import * as jwt from 'jsonwebtoken';
import { IAuthStrategy } from '@/auth/types';
import { UserInfo } from '@/user/user-info';
import { LocalJwtAuthService } from './local-jwt-auth.service';
import { env } from '@/env';

/**
 * Local JWT Strategy
 * 
 * Validates JWT tokens issued by the internal ThaliumX backend.
 * Uses HS256 algorithm with shared JWT_SECRET for signature verification.
 * 
 * This strategy replaces the Zitadel OIDC strategy, enabling the workflows-service
 * to authenticate users using tokens issued by the backend's TokenService.
 */
@Injectable()
export class LocalJwtStrategy
  extends PassportStrategy(Strategy, 'local-jwt')
  implements IAuthStrategy
{
  constructor(private readonly localJwtAuthService: LocalJwtAuthService) {
    const jwtSecret = env.JWT_SECRET || 'change-me-in-production';
    const jwtIssuer = env.JWT_ISSUER || 'thaliumx';
    const jwtAudience = env.JWT_AUDIENCE || 'thaliumx-users';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: jwtSecret,
      algorithms: ['HS256'],
      issuer: jwtIssuer,
      audience: jwtAudience,
    });
  }

  async validate(payload: any): Promise<UserInfo> {
    // Verify issuer
    const jwtIssuer = env.JWT_ISSUER || 'thaliumx';
    if (payload.iss !== jwtIssuer) {
      throw new UnauthorizedException(`Invalid token issuer: expected ${jwtIssuer}, got ${payload.iss}`);
    }

    // Verify audience
    const jwtAudience = env.JWT_AUDIENCE || 'thaliumx-users';
    const aud = payload.aud;
    const audList = Array.isArray(aud) ? aud : typeof aud === 'string' ? [aud] : [];
    if (!audList.includes(jwtAudience)) {
      throw new UnauthorizedException(`Invalid token audience: expected ${jwtAudience}, got ${audList.join(', ')}`);
    }

    // Explicitly check token expiration (additional security check)
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      throw new UnauthorizedException('Token has expired');
    }

    // Extract user identity from JWT payload
    const userId = payload.id || payload.userId;
    if (!userId) {
      throw new UnauthorizedException('Missing user ID in token');
    }

    // Map JWT user to Ballerine user
    const user = await this.localJwtAuthService.findOrCreateUserFromJwtPayload(payload);

    if (!user) {
      throw new UnauthorizedException('User not found or could not be created');
    }

    return user;
  }
}

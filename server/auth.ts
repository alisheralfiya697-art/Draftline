import crypto from 'node:crypto';
import type { SeededUser } from '../src/types/document.js';
import { SEEDED_USERS } from './seed.js';

interface SessionPayload {
  sub: string;
  jti: string;
  iat: number;
  exp: number;
}

const SESSION_TTL_SECONDS = 60 * 60 * 24; // 24 hours

export class AuthService {
  private readonly secret: Buffer;
  private readonly usersMap: Map<string, SeededUser>;
  private readonly revokedTokens = new Map<string, number>();

  constructor(secretOverride?: string) {
    const rawSecret = secretOverride ?? process.env.SESSION_SECRET;
    this.secret =
      rawSecret && rawSecret.trim().length >= 16
        ? Buffer.from(rawSecret.trim(), 'utf8')
        : crypto.randomBytes(32);
    this.usersMap = new Map(SEEDED_USERS.map((u) => [u.id, u]));
  }

  public listDemoAccounts(): SeededUser[] {
    return SEEDED_USERS;
  }

  public issueDemoSession(identifier: {
    userId?: string;
    email?: string;
  }): { token: string; user: SeededUser; expiresInSeconds: number } | null {
    const byId =
      typeof identifier.userId === 'string'
        ? this.usersMap.get(identifier.userId.trim())
        : undefined;
    const byEmail =
      !byId && typeof identifier.email === 'string'
        ? SEEDED_USERS.find(
            (u) => u.email.toLowerCase() === identifier.email!.trim().toLowerCase()
          )
        : undefined;

    const user = byId ?? byEmail;
    if (!user) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const payload: SessionPayload = {
      sub: user.id,
      jti: crypto.randomUUID(),
      iat: nowSec,
      exp: nowSec + SESSION_TTL_SECONDS,
    };

    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
      'base64url'
    );
    const signature = this.sign(encodedPayload);
    return {
      token: `${encodedPayload}.${signature}`,
      user,
      expiresInSeconds: SESSION_TTL_SECONDS,
    };
  }

  public verifyBearerToken(
    authHeader: string | undefined
  ): { user: SeededUser; jti: string; exp: number } | null {
    if (!authHeader || typeof authHeader !== 'string') return null;
    const match = authHeader.match(/^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/);
    if (!match) return null;

    const token = match[1];
    const [encodedPayload, providedSig] = token.split('.');
    if (!encodedPayload || !providedSig) return null;

    const expectedSig = this.sign(encodedPayload);
    const providedBuf = Buffer.from(providedSig, 'utf8');
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    if (
      providedBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(providedBuf, expectedBuf)
    ) {
      return null;
    }

    let payload: SessionPayload;
    try {
      payload = JSON.parse(
        Buffer.from(encodedPayload, 'base64url').toString('utf8')
      ) as SessionPayload;
    } catch {
      return null;
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string' ||
      typeof payload.exp !== 'number' ||
      payload.exp <= nowSec
    ) {
      return null;
    }

    if (this.revokedTokens.has(payload.jti)) {
      return null;
    }

    const user = this.usersMap.get(payload.sub);
    if (!user) return null;

    return { user, jti: payload.jti, exp: payload.exp };
  }

  public revokeToken(jti: string, exp: number): void {
    const nowSec = Math.floor(Date.now() / 1000);
    for (const [id, expiresAt] of this.revokedTokens.entries()) {
      if (expiresAt <= nowSec) {
        this.revokedTokens.delete(id);
      }
    }
    this.revokedTokens.set(jti, exp);
  }

  private sign(encodedPayload: string): string {
    return crypto
      .createHmac('sha256', this.secret)
      .update(encodedPayload)
      .digest('base64url');
  }
}

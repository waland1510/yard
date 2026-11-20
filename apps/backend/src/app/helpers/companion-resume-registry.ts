import { randomBytes } from 'node:crypto';
import type { CompanionResumeCredential, RoleType } from '@yard/shared-utils';

const RESUME_LIFETIME_MS = 24 * 60 * 60_000;

interface CompanionLink {
  channel: string;
  role: RoleType;
  hostClientId: string;
  phoneClientId: string;
}

export class CompanionResumeRegistry {
  private readonly links = new Map<string, CompanionLink & { expiresAt: number }>();

  issue(link: CompanionLink, now: number): CompanionResumeCredential {
    this.revoke(link.channel, link.hostClientId);
    this.revoke(link.channel, link.phoneClientId);
    for (const [token, record] of this.links) {
      if (record.expiresAt <= now) this.links.delete(token);
    }

    const token = randomBytes(32).toString('base64url');
    const expiresAt = now + RESUME_LIFETIME_MS;
    this.links.set(token, { ...link, expiresAt });
    return { token, expiresAt };
  }

  find(token: string, channel: string, phoneClientId: string, now: number): CompanionLink | undefined {
    const link = this.links.get(token);
    if (!link) return undefined;
    if (link.expiresAt <= now) {
      this.links.delete(token);
      return undefined;
    }
    if (link.channel === channel && link.phoneClientId === phoneClientId) return link;
    return undefined;
  }

  revoke(channel: string, clientId: string): void {
    for (const [token, link] of this.links) {
      if (link.channel === channel && (link.hostClientId === clientId || link.phoneClientId === clientId)) {
        this.links.delete(token);
      }
    }
  }
}

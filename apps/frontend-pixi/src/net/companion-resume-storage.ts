import type { CompanionResumeCredential } from '@yard/shared-utils';

interface StoredResume extends CompanionResumeCredential {
  clientId: string;
  pairCode: string;
}

const storageKey = (channel: string) => `yard.companion-resume.${channel}`;

export function readCompanionResume(channel: string, pairCode: string): StoredResume | undefined {
  try {
    const raw = window.sessionStorage.getItem(storageKey(channel));
    if (!raw) return undefined;
    const saved = JSON.parse(raw) as Partial<StoredResume> | null;
    if (!saved || saved.pairCode !== pairCode || typeof saved.clientId !== 'string' || !saved.clientId ||
        typeof saved.token !== 'string' || !saved.token || typeof saved.expiresAt !== 'number') return undefined;
    return { pairCode, clientId: saved.clientId, token: saved.token, expiresAt: saved.expiresAt };
  } catch {
    return undefined;
  }
}

export function saveCompanionResume(channel: string, resume: StoredResume): void {
  try {
    window.sessionStorage.setItem(storageKey(channel), JSON.stringify(resume));
  } catch {
    // The live socket client retains the credential even if tab storage is disabled.
  }
}

export function clearCompanionResume(channel: string, pairCode: string): void {
  try {
    if (readCompanionResume(channel, pairCode)) window.sessionStorage.removeItem(storageKey(channel));
  } catch {
    // Storage can be unavailable in private browsing modes.
  }
}

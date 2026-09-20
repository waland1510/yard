import { TypeSafeClient } from '@typesafe-ai/sdk';
import { ENV } from './env';

let client: TypeSafeClient | null = null;

export function jevEnabled(): boolean {
  return ENV.TYPESAFE_API_KEY !== '' && ENV.AI_DETECTIVE_POLICY !== 'heuristic';
}

export function getJevClient(): TypeSafeClient | null {
  if (!jevEnabled()) return null;
  if (!client) {
    client = new TypeSafeClient({
      apiKey: ENV.TYPESAFE_API_KEY,
      defaultModel: ENV.JEV_MODEL,
    });
  }
  return client;
}

export function resetJevClient(): void {
  client = null;
}

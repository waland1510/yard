const DEFAULT_ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

/** `VITE_ICE_SERVERS` takes a JSON RTCIceServer[] so a TURN relay can be added without code. */
export function readIceServers(): RTCIceServer[] {
  const raw = (import.meta as { env?: { VITE_ICE_SERVERS?: string } }).env?.VITE_ICE_SERVERS;
  if (!raw) return DEFAULT_ICE_SERVERS;
  try {
    return JSON.parse(raw) as RTCIceServer[];
  } catch {
    return DEFAULT_ICE_SERVERS;
  }
}

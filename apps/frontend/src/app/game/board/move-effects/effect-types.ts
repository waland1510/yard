export type EffectTransport =
  | 'taxi'
  | 'bus'
  | 'underground'
  | 'river'
  | 'secret'
  | 'double'
  | 'shadow';

export interface EffectProps {
  x: number;
  y: number;
  theme: string;
  cinematic?: boolean;
  delay?: number;
}

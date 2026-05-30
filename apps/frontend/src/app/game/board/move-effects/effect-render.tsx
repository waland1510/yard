import React from 'react';
import type { EffectTransport, EffectProps } from './effect-types';
import {
  TaxiEffect,
  BusEffect,
  UndergroundEffect,
  RiverEffect,
  SecretEffect,
  DoubleEffect,
  ShadowEffect,
} from './effect-variants';

export function renderEffect(transport: EffectTransport, props: EffectProps): React.ReactNode {
  switch (transport) {
    case 'taxi':
      return <TaxiEffect {...props} />;
    case 'bus':
      return <BusEffect {...props} />;
    case 'underground':
      return <UndergroundEffect {...props} />;
    case 'river':
      return <RiverEffect {...props} />;
    case 'secret':
      return <SecretEffect {...props} />;
    case 'double':
      return <DoubleEffect {...props} />;
    case 'shadow':
      return <ShadowEffect {...props} />;
  }
}

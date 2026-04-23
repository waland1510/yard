import React from 'react';
import { renderEffect } from './effect-variants';
import { ActiveEffect, useMoveEffects } from './use-move-effects';

const EffectRenderer: React.FC<{ effect: ActiveEffect }> = ({ effect }) => {
  const destDelay = effect.cinematic ? 0.5 : 0.25;
  const samePosition =
    effect.originX === effect.targetX && effect.originY === effect.targetY;

  return (
    <>
      {renderEffect(effect.transport, {
        x: effect.originX,
        y: effect.originY,
        theme: effect.theme,
        cinematic: effect.cinematic,
        delay: 0,
      })}
      {!samePosition &&
        renderEffect(effect.transport, {
          x: effect.targetX,
          y: effect.targetY,
          theme: effect.theme,
          cinematic: effect.cinematic,
          delay: destDelay,
        })}
    </>
  );
};

export const MoveEffects: React.FC = () => {
  const effects = useMoveEffects();
  return (
    <g pointerEvents="none">
      {effects.map((e) => (
        <EffectRenderer key={e.id} effect={e} />
      ))}
    </g>
  );
};

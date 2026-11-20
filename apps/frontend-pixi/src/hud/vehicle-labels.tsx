// In-world destination signage above each vehicle. Projects each vehicle's world position
// to screen coords every frame; renders a small pill near (but slightly above) the vehicle.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VehicleHandle, VehicleKind } from '../three/vehicles';
import type { World } from '../three/world';
import { nodeDisplayName } from '../core/map-data';
import { useGameStateStore } from '../stores/game-state-store';
import { moveTicketKind, type MoveTicketInventory } from '../core/move-validator';
import { getTheme } from '../core/theme-registry';
import { COLOR, FONT, RADIUS, TAP, TRANSPORT_CHIP } from './tokens';

interface VehicleLabelsProps {
  world: World | null;
  /** Bumps every time the intersection is rebuilt — triggers a fresh DOM render. */
  sceneVersion: number;
  /** Live list of vehicles currently in the scene. */
  getVehicles: () => VehicleHandle[];
  /** Whether to hide labels entirely (during ride / map open). */
  hidden: boolean;
  tickets: MoveTicketInventory;
  secretArmed: boolean;
  /** Click handler — fires when the user clicks a label pill (a fat target for the
   *  aerial view where the 3D vehicle is small in screen space). */
  onVehicleClick?: (v: VehicleHandle) => void;
}

const KIND_ICON: Record<VehicleKind, string> = {
  taxi: '🚖',
  bus: '🚌',
  underground: 'Ⓤ',
  river: '⛴️',
};

const LABEL_VERTICAL_OFFSET = 3.2; // world units above the vehicle origin

export function VehicleLabels({ world, sceneVersion, getVehicles, hidden, tickets, secretArmed, onVehicleClick }: VehicleLabelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const themeId = useGameStateStore((s) => s.theme);

  useEffect(() => {
    const container = containerRef.current;
    if (!world || !container) return;

    // Build a label element per vehicle
    const vehicles = getVehicles();
    const labels: Array<{ vehicle: VehicleHandle; el: HTMLButtonElement; lastVisible: boolean }> = [];
    const theme = getTheme(themeId);

    for (const v of vehicles) {
      const ticketKind = moveTicketKind(v.kind, secretArmed);
      const remaining = tickets[ticketKind];
      const ticketLabel = theme.transportation[ticketKind];
      const empty = remaining <= 0;
      const clickable = !!onVehicleClick && !empty;
      const tone = TRANSPORT_CHIP[v.kind];
      const name = nodeDisplayName(v.targetNodeId);
      const costText = empty ? `no ${ticketLabel} ticket` : `1 ${ticketLabel} ticket · ${remaining} left`;

      // Keyboard users reach the same moves through <DestinationList/>; these float with
      // the camera and can sit off-screen, so they stay out of the tab order.
      const el = document.createElement('button');
      el.type = 'button';
      el.tabIndex = -1;
      el.disabled = !clickable;
      el.className = 'vehicle-label';
      el.setAttribute('aria-label', `${theme.transportation[v.kind]} to ${name}, stop ${v.targetNodeId} — ${costText}`);
      Object.assign(el.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        transform: 'translate(-9999px, -9999px)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        minHeight: TAP,
        background: 'rgba(23, 25, 30, 0.86)',
        border: `1px solid ${empty ? COLOR.hairline : tone.border}`,
        borderRadius: `${RADIUS.control}px`,
        padding: '6px 11px',
        fontSize: '12.5px',
        color: COLOR.fg,
        fontFamily: FONT.ui,
        textAlign: 'left',
        pointerEvents: clickable ? 'auto' : 'none',
        cursor: clickable ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(6px)',
        transition: 'opacity 180ms ease, transform 60ms ease',
        opacity: '0',
        visibility: 'hidden',
        lineHeight: '1.2',
      } satisfies Partial<CSSStyleDeclaration>);

      if (clickable) {
        el.addEventListener('click', () => onVehicleClick(v));
        el.addEventListener('mouseenter', () => v.setHover(true));
        el.addEventListener('mouseleave', () => v.setHover(false));
      }

      const title = document.createElement('span');
      Object.assign(title.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontWeight: '600',
        color: empty ? COLOR.fg2 : tone.color,
      } satisfies Partial<CSSStyleDeclaration>);
      const iconEl = document.createElement('span');
      iconEl.textContent = KIND_ICON[v.kind];
      iconEl.style.fontSize = '14px';
      const nameEl = document.createElement('span');
      nameEl.textContent = name;
      const idEl = document.createElement('span');
      idEl.textContent = `#${v.targetNodeId}`;
      Object.assign(idEl.style, {
        color: COLOR.fg2,
        fontFamily: FONT.mono,
        fontWeight: '500',
        fontSize: '11px',
      } satisfies Partial<CSSStyleDeclaration>);
      title.append(iconEl, nameEl, idEl);

      const cost = document.createElement('span');
      cost.textContent = costText;
      Object.assign(cost.style, {
        marginTop: '2px',
        fontSize: '10.5px',
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontWeight: '600',
        color: empty ? COLOR.redTint : COLOR.fg2,
      } satisfies Partial<CSSStyleDeclaration>);

      el.append(title, cost);
      container.appendChild(el);
      labels.push({ vehicle: v, el, lastVisible: false });
    }

    const worldPos = new THREE.Vector3();
    const stop = world.addTick(() => {
      const screenW = window.innerWidth;
      const screenH = window.innerHeight;
      for (const item of labels) {
        item.vehicle.group.getWorldPosition(worldPos);
        worldPos.y += LABEL_VERTICAL_OFFSET;
        worldPos.project(world.camera);

        const behindOrOutside = Math.abs(worldPos.z) > 1 || Math.abs(worldPos.x) > 1 || Math.abs(worldPos.y) > 1;
        if (behindOrOutside || hidden) {
          if (item.lastVisible) {
            item.el.style.opacity = '0';
            item.el.style.visibility = 'hidden';
            item.lastVisible = false;
          }
          continue;
        }
        const x = (worldPos.x * 0.5 + 0.5) * screenW;
        const y = (-worldPos.y * 0.5 + 0.5) * screenH;
        item.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        if (!item.lastVisible) {
          item.el.style.opacity = '1';
          item.el.style.visibility = 'visible';
          item.lastVisible = true;
        }
      }
    });

    return () => {
      stop();
      for (const item of labels) item.el.remove();
    };
  }, [world, sceneVersion, getVehicles, hidden, tickets, secretArmed, onVehicleClick, themeId]);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 3,
      }}
    />
  );
}

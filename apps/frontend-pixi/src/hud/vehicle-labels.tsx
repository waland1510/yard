// In-world destination signage above each vehicle. Projects each vehicle's world position
// to screen coords every frame; renders a small pill near (but slightly above) the vehicle.
// Pure presentation — reads game state via stores.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { VehicleHandle, VehicleKind } from '../three/vehicles';
import type { World } from '../three/world';
import { nodeDisplayName } from '../core/map-data';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore } from '../stores/runner-store';

interface VehicleLabelsProps {
  world: World | null;
  /** Bumps every time the intersection is rebuilt — triggers a fresh DOM render. */
  sceneVersion: number;
  /** Live list of vehicles currently in the scene. */
  getVehicles: () => VehicleHandle[];
  /** Whether to hide labels entirely (during ride / map open). */
  hidden: boolean;
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

const KIND_COLOR: Record<VehicleKind, string> = {
  taxi: '#f6c945',
  bus: '#e25555',
  underground: '#5a8dde',
  river: '#6cb8d6',
};

const LABEL_VERTICAL_OFFSET = 3.2; // world units above the vehicle origin

export function VehicleLabels({ world, sceneVersion, getVehicles, hidden, onVehicleClick }: VehicleLabelsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Subscribe to store changes that affect label content (tickets) — triggers re-render
  const myRole = useRunnerStore((s) => s.myRole);
  const players = useGameStateStore((s) => s.players);
  const myPlayer = myRole ? players.find((p) => p.role === myRole) : undefined;
  const tickets: Record<VehicleKind, number> = {
    taxi: myPlayer?.taxiTickets ?? 0,
    bus: myPlayer?.busTickets ?? 0,
    underground: myPlayer?.undergroundTickets ?? 0,
    river: Infinity, // river is free for the culprit
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!world || !container) return;

    // Build a label element per vehicle
    const vehicles = getVehicles();
    const labels: Array<{ vehicle: VehicleHandle; el: HTMLDivElement; lastVisible: boolean }> = [];

    for (const v of vehicles) {
      const remaining = tickets[v.kind];
      const empty = remaining <= 0;
      const el = document.createElement('div');
      el.className = 'vehicle-label';
      Object.assign(el.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        transform: 'translate(-9999px, -9999px)', // off-screen until first frame
        background: 'rgba(10, 12, 16, 0.78)',
        border: `1px solid ${empty ? 'rgba(255,255,255,0.18)' : KIND_COLOR[v.kind]}`,
        borderRadius: '8px',
        padding: '6px 10px',
        fontSize: '12px',
        color: '#fff',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        // Labels are the primary click target in aerial view — the 3D vehicles can be
        // tiny in screen space, but the label pill is always readable and clickable.
        pointerEvents: onVehicleClick && !empty ? 'auto' : 'none',
        cursor: onVehicleClick && !empty ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        backdropFilter: 'blur(6px)',
        textShadow: '0 1px 2px rgba(0,0,0,0.85)',
        transition: 'opacity 180ms ease, transform 60ms ease',
        opacity: '0',
        lineHeight: '1.2',
        letterSpacing: '0.2px',
      } satisfies Partial<CSSStyleDeclaration>);

      if (onVehicleClick && !empty) {
        el.addEventListener('click', () => onVehicleClick(v));
        el.addEventListener('mouseenter', () => v.setHover(true));
        el.addEventListener('mouseleave', () => v.setHover(false));
      }

      const costText = v.kind === 'river'
        ? 'free · river'
        : empty
        ? 'no ticket'
        : `1 ticket · ${remaining} left`;
      el.innerHTML = `
        <div style="display:flex;align-items:center;gap:6px;font-weight:600;color:${KIND_COLOR[v.kind]};">
          <span style="font-size:14px">${KIND_ICON[v.kind]}</span>
          <span>${escapeHtml(nodeDisplayName(v.targetNodeId))}</span>
          <span style="color:rgba(255,255,255,0.45);font-weight:500;font-size:11px">#${v.targetNodeId}</span>
        </div>
        <div style="margin-top:2px;font-size:10px;letterSpacing:0.8px;text-transform:uppercase;color:${empty && v.kind !== 'river' ? '#e25555' : 'rgba(255,255,255,0.55)'};font-weight:500;">
          ${costText}
        </div>
      `;
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

        const behindOrOutside = worldPos.z > 1 || worldPos.z < -1;
        if (behindOrOutside || hidden) {
          if (item.lastVisible) {
            item.el.style.opacity = '0';
            item.lastVisible = false;
          }
          continue;
        }
        const x = (worldPos.x * 0.5 + 0.5) * screenW;
        const y = (-worldPos.y * 0.5 + 0.5) * screenH;
        item.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
        if (!item.lastVisible) {
          item.el.style.opacity = '1';
          item.lastVisible = true;
        }
      }
    });

    return () => {
      stop();
      for (const item of labels) item.el.remove();
    };
    // We DO want to rebuild whenever the scene rebuilds OR tickets change OR hidden flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [world, sceneVersion, tickets.taxi, tickets.bus, tickets.underground, hidden]);

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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;';
      case '<':
        return '&lt;';
      case '>':
        return '&gt;';
      case '"':
        return '&quot;';
      case "'":
        return '&#39;';
      default:
        return c;
    }
  });
}

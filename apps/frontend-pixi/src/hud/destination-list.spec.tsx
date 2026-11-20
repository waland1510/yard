/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import type { Connection } from '../game/connections';
import { installMatchMedia } from '../test/match-media';
import { DestinationList } from './destination-list';

const CONNECTIONS: Connection[] = [
  { kind: 'bus', targetNodeId: 23, direction: 'N', slotIndex: 0 },
  { kind: 'taxi', targetNodeId: 9, direction: 'E', slotIndex: 0 },
  { kind: 'underground', targetNodeId: 46, direction: 'S', slotIndex: 0 },
];

const TICKETS = { taxi: 4, bus: 2, underground: 0, secret: 0 };

function renderList(overrides: Partial<Parameters<typeof DestinationList>[0]> = {}) {
  const onPick = jest.fn();
  const onHighlight = jest.fn();
  render(
    <DestinationList
      connections={CONNECTIONS}
      tickets={TICKETS}
      canMove
      surface="map"
      touch={false}
      onPick={onPick}
      onHighlight={onHighlight}
      {...overrides}
    />
  );
  return { onPick, onHighlight };
}

function moveButtons(): HTMLButtonElement[] {
  return screen.getAllByRole('button').filter((b) => b.hasAttribute('data-move')) as HTMLButtonElement[];
}

describe('DestinationList', () => {
  beforeEach(() => installMatchMedia(false));

  it('destinationList_withConnections_listsEveryMoveAsNativeButtonGroupedByTransport', () => {
    renderList();
    const labels = moveButtons().map((b) => b.getAttribute('aria-label') ?? '');
    expect(labels).toHaveLength(3);
    expect(labels[0]).toMatch(/^Taxi to .*stop 9 — 4 Taxi tickets left$/);
    expect(labels[1]).toMatch(/^Bus to .*stop 23/);
    expect(labels[2]).toMatch(/^Underground to .*stop 46 — no Underground ticket$/);
  });

  it('destinationList_withoutTicket_disablesThatMove', () => {
    renderList();
    const [taxi, bus, tube] = moveButtons();
    expect(taxi.disabled).toBe(false);
    expect(bus.disabled).toBe(false);
    expect(tube.disabled).toBe(true);
  });

  it('destinationList_whenSecretIsArmed_canUseAnEmptyTransportAndNamesTheSecretTicket', () => {
    const { onPick } = renderList({ secretArmed: true, tickets: { ...TICKETS, taxi: 0, secret: 1 } });
    const taxi = screen.getByRole('button', { name: /^Taxi to .*1 Secret ticket left$/ });
    expect(taxi).toHaveProperty('disabled', false);
    fireEvent.click(taxi);
    expect(onPick).toHaveBeenCalledWith(CONNECTIONS[1]);
  });

  it('destinationList_whenNotMyTurn_disablesAllMovesAndExplainsWhy', () => {
    renderList({ canMove: false });
    expect(moveButtons().every((b) => b.disabled)).toBe(true);
    expect(screen.getByText(/not your turn/i)).toBeTruthy();
  });

  it('destinationList_onMoveActivated_picksThatConnection', () => {
    const { onPick } = renderList();
    fireEvent.click(moveButtons()[1]);
    expect(onPick).toHaveBeenCalledWith(CONNECTIONS[0]);
  });

  it('destinationList_onMKey_focusesFirstPlayableMove', () => {
    renderList();
    fireEvent.keyDown(window, { key: 'm' });
    expect(document.activeElement).toBe(moveButtons()[0]);
  });

  it('destinationList_onMKeyWhileCollapsed_opensThenFocusesFirstMove', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: /moves/i }));
    expect(moveButtons()).toHaveLength(0);
    fireEvent.keyDown(window, { key: 'M' });
    expect(document.activeElement).toBe(moveButtons()[0]);
  });

  it('destinationList_onArrowKeys_walksPlayableMovesAndWraps', () => {
    renderList();
    const [taxi, bus] = moveButtons();
    taxi.focus();
    fireEvent.keyDown(taxi, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(bus);
    fireEvent.keyDown(bus, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(taxi);
    fireEvent.keyDown(taxi, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(bus);
  });

  it('destinationList_onEscape_closesAndReturnsFocusToTheToggle', () => {
    renderList();
    const [taxi] = moveButtons();
    taxi.focus();
    fireEvent.keyDown(taxi, { key: 'Escape' });
    expect(moveButtons()).toHaveLength(0);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /moves/i }));
  });

  it('destinationList_onFocusAndBlur_highlightsThenClearsTheVehicle', () => {
    const { onHighlight } = renderList();
    const [taxi] = moveButtons();
    fireEvent.focus(taxi);
    expect(onHighlight).toHaveBeenLastCalledWith(CONNECTIONS[1]);
    fireEvent.blur(taxi);
    expect(onHighlight).toHaveBeenLastCalledWith(null);
  });

  it('destinationList_onNarrowViewport_startsCollapsed', () => {
    installMatchMedia(true);
    renderList();
    expect(moveButtons()).toHaveLength(0);
    expect(screen.getByRole('button', { name: /moves/i }).getAttribute('aria-expanded')).toBe('false');
  });

  it('destinationList_withNoConnections_rendersNothing', () => {
    const { container } = render(
      <DestinationList
        connections={[]}
        tickets={TICKETS}
        canMove
        surface="fpv"
        touch
        onPick={jest.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

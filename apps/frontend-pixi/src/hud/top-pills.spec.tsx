/** @jest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useGameStateStore } from '../stores/game-state-store';
import { useRunnerStore, selectActiveSurface } from '../stores/runner-store';
import { TopPills } from './top-pills';

function seed(currentTurn: 'detective1' | 'detective2') {
  act(() => {
    useGameStateStore.setState({ status: 'active', currentTurn, moves: [], theme: 'classic' });
    useRunnerStore.setState({ myRole: 'detective1', viewingAs: null, viewMode: 'map' });
  });
}

describe('TopPills', () => {
  it('topPills_onMyTurn_announcesYourTurn', () => {
    seed('detective1');
    render(<TopPills />);
    expect(screen.getByRole('status').textContent).toBe('Your turn');
  });

  it('topPills_onAnotherPlayersTurn_namesThatPlayer', () => {
    seed('detective2');
    render(<TopPills />);
    expect(screen.getByRole('status').textContent).toBe("Detective 2's turn");
  });

  it('topPills_onSwitchActivated_togglesBetweenMapAndStreetView', () => {
    seed('detective1');
    render(<TopPills />);
    expect(selectActiveSurface(useRunnerStore.getState())).toBe('map');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to street view' }));
    expect(selectActiveSurface(useRunnerStore.getState())).toBe('fpv');

    fireEvent.click(screen.getByRole('button', { name: 'Switch to strategic map' }));
    expect(selectActiveSurface(useRunnerStore.getState())).toBe('map');
  });

  it('topPills_beforeFirstReveal_countsDownToIt', () => {
    seed('detective1');
    render(<TopPills />);
    expect(screen.getByText('Mr. X reveals in 3 rounds')).toBeTruthy();
  });
});

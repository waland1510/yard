/** @jest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { Intro } from './intro';

const enterButton = () => screen.getByRole('button', { name: /enter street view/i });

describe('Intro', () => {
  it('intro_onMouseDevice_showsPointerControlsAndFocusesTheEntryButton', () => {
    render(<Intro touch={false} onDismiss={jest.fn()} />);
    expect(screen.getByText('Esc')).toBeTruthy();
    expect(screen.getByText(/click outside this card to begin/i)).toBeTruthy();
    expect(document.activeElement).toBe(enterButton());
  });

  it('intro_onTouchDevice_showsTouchControlsInsteadOfMouseOnes', () => {
    render(<Intro touch onDismiss={jest.fn()} />);
    expect(screen.getByText('Drag')).toBeTruthy();
    expect(screen.queryByText('Esc')).toBeNull();
    expect(screen.queryByText(/click outside/i)).toBeNull();
  });

  it('intro_onEntryButtonActivated_entersStreetViewOnce', () => {
    const onDismiss = jest.fn();
    render(<Intro touch={false} onDismiss={onDismiss} />);
    fireEvent.click(enterButton());
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('intro_onBackdropClicked_entersStreetView', () => {
    const onDismiss = jest.fn();
    const { container } = render(<Intro touch={false} onDismiss={onDismiss} />);
    const backdrop = container.querySelector('.street-intro-backdrop');
    if (!backdrop) throw new Error('Expected the mouse backdrop');
    fireEvent.click(backdrop);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

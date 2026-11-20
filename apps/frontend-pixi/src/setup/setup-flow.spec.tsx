/** @jest-environment jsdom */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { SetupFlow } from './setup-flow';

jest.mock('react-router-dom', () => ({ useNavigate: () => jest.fn() }));

jest.mock('../net/rest-client', () => ({
  createGame: jest.fn().mockResolvedValue({ channel: 'abc123', players: [] }),
  getGame: jest.fn().mockResolvedValue(null),
  getGeo: jest.fn().mockResolvedValue(null),
  makeMockChannel: () => 'mock-test',
  recordVisit: jest.fn(),
  updatePlayer: jest.fn().mockResolvedValue(null),
}));

async function renderFlow() {
  const onStart = jest.fn();
  await act(async () => {
    render(<SetupFlow onStart={onStart} />);
  });
  return { onStart };
}

const button = (name: RegExp | string) => screen.getByRole('button', { name }) as HTMLButtonElement;
const heading = () => screen.getByRole('heading').textContent;
const pressEnterOnFocused = () => fireEvent.click(document.activeElement as HTMLElement);

async function advanceToRoleStep() {
  fireEvent.click(button(/begin|new game/i));
  fireEvent.click(button('Next'));
  fireEvent.change(screen.getByRole('textbox', { name: 'Player name' }), { target: { value: 'Val' } });
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Player name' }), { key: 'Enter' });
}

describe('SetupFlow', () => {
  it('setupFlow_onThemePicked_marksItSelectedAndMovesFocusToNext', async () => {
    await renderFlow();
    fireEvent.click(button(/begin|new game/i));
    expect(heading()).toBe('Choose your world');

    const barbie = button(/Barbie World/);
    expect(barbie.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(barbie);

    expect(barbie.getAttribute('aria-pressed')).toBe('true');
    expect(button(/^Classic/).getAttribute('aria-pressed')).toBe('false');
    expect(document.activeElement).toBe(button('Next'));
  });

  it('setupFlow_onNameStepWithEmptyName_blocksNextAndSaysWhy', async () => {
    await renderFlow();
    fireEvent.click(button(/begin|new game/i));
    fireEvent.click(button('Next'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Player name' }), { target: { value: '   ' } });

    expect(button('Next').disabled).toBe(true);
    expect(screen.getByText('Enter a name to continue')).toBeTruthy();

    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Player name' }), { key: 'Enter' });
    expect(heading()).toBe("What's your name?");
  });

  it('setupFlow_onEnterInNameField_advancesToRoleStep', async () => {
    await renderFlow();
    await advanceToRoleStep();
    expect(heading()).toBe('Pick your role');
  });

  it('setupFlow_onRoleStepBeforePicking_blocksNextAndSaysWhy', async () => {
    await renderFlow();
    await advanceToRoleStep();
    expect(button('Next').disabled).toBe(true);
    expect(screen.getByText('Pick a role to continue')).toBeTruthy();
  });

  it('setupFlow_onRolePicked_selectsItAndLetsEnterContinue', async () => {
    await renderFlow();
    await advanceToRoleStep();

    const detective = button(/Detective 2/);
    fireEvent.click(detective);

    expect(detective.getAttribute('aria-pressed')).toBe('true');
    expect(button(/Mr\. X/).getAttribute('aria-pressed')).toBe('false');
    await waitFor(() => expect(document.activeElement).toBe(button('Next')));

    pressEnterOnFocused();
    expect(heading()).toBe('Assemble your squad');
  });

  it('setupFlow_onBack_returnsToPreviousStepKeepingTheSelection', async () => {
    await renderFlow();
    await advanceToRoleStep();
    fireEvent.click(button(/Detective 2/));
    fireEvent.click(button('Next'));
    fireEvent.click(button('Back'));

    expect(heading()).toBe('Pick your role');
    expect(button(/Detective 2/).getAttribute('aria-pressed')).toBe('true');
  });

  it('setupFlow_onStart_handsOffTheChosenSession', async () => {
    const { onStart } = await renderFlow();
    await advanceToRoleStep();
    fireEvent.click(button(/Detective 2/));
    fireEvent.click(button('Next'));

    expect(document.activeElement).toBe(button('Start Game'));
    await act(async () => {
      pressEnterOnFocused();
    });

    await waitFor(() =>
      expect(onStart).toHaveBeenCalledWith({
        channel: 'abc123',
        role: 'detective2',
        name: 'Val',
        theme: 'classic',
      })
    );
  });
});

describe('SetupFlow progress', () => {
  it('setupFlow_onEachStep_marksTheCurrentStepAndCompletedOnes', async () => {
    await renderFlow();
    const current = () => document.querySelector('[aria-current="step"]')?.getAttribute('aria-label');
    expect(current()).toBe('Briefing');

    fireEvent.click(button(/start a new game/i));
    expect(current()).toBe('World');
    expect(screen.getByRole('listitem', { name: 'Briefing, done' })).toBeTruthy();
  });
});

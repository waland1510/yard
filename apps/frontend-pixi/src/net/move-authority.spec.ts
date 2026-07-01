import { MoveAuthority, type AuthorityInput } from './move-authority';

// A paired player: phone (fpv-companion) + desktop (map-primary), both on 'detective1',
// and it is detective1's turn.
const phone: AuthorityInput = {
  myClientId: 'phone',
  mySurface: 'fpv-companion',
  peerPresent: true,
  myRole: 'detective1',
  currentTurn: 'detective1',
};
const desktop: AuthorityInput = {
  myClientId: 'desktop',
  mySurface: 'map-primary',
  peerPresent: true,
  myRole: 'detective1',
  currentTurn: 'detective1',
};

describe('MoveAuthority', () => {
  it('moveAuthority_pairedOnTurn_exactlyOneCommitter', () => {
    const a = new MoveAuthority();
    const committers = [a.canCommit(phone), a.canCommit(desktop)].filter(Boolean);
    expect(committers).toHaveLength(1);
  });

  it('moveAuthority_default_fpvControllerCommits', () => {
    const a = new MoveAuthority();
    expect(a.canCommit(phone)).toBe(true); // fpv-companion is the default mover
    expect(a.canCommit(desktop)).toBe(false); // map viewer observes
  });

  it('moveAuthority_offTurn_neitherCommits', () => {
    const a = new MoveAuthority();
    const offTurn = { currentTurn: 'detective2' as const };
    expect(a.canCommit({ ...phone, ...offTurn })).toBe(false);
    expect(a.canCommit({ ...desktop, ...offTurn })).toBe(false);
  });

  it('moveAuthority_peerLost_survivorCommits', () => {
    const a = new MoveAuthority();
    // Desktop's phone dropped → desktop becomes the sole committer despite being the viewer.
    expect(a.canCommit({ ...desktop, peerPresent: false })).toBe(true);
  });

  it('moveAuthority_solo_alwaysCommitsOnTurn', () => {
    const a = new MoveAuthority();
    expect(a.canCommit({ ...phone, mySurface: null, peerPresent: false })).toBe(true);
  });

  it('moveAuthority_delegateTo_flipsCommitterDeterministically', () => {
    // The server delegates to the desktop; both devices apply the same delegation.
    const onPhone = new MoveAuthority();
    const onDesktop = new MoveAuthority();
    onPhone.delegateTo('desktop');
    onDesktop.delegateTo('desktop');
    expect(onPhone.canCommit(phone)).toBe(false);
    expect(onDesktop.canCommit(desktop)).toBe(true);
    // Still exactly one committer.
    expect([onPhone.canCommit(phone), onDesktop.canCommit(desktop)].filter(Boolean)).toHaveLength(1);
  });

  it('moveAuthority_companionCannotCommitWhilePrimaryHolds', () => {
    // With the phone as default committer, the desktop (viewer) must not commit.
    const a = new MoveAuthority();
    expect(a.canCommit(desktop)).toBe(false);
  });
});

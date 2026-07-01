import {
  deviceTypeFromProfile,
  resolveSurface,
  type DeviceProfile,
} from './device-surface';

const phoneProfile: DeviceProfile = {
  isCoarsePointer: true,
  isTouch: true,
  viewportWidth: 390,
};

const desktopProfile: DeviceProfile = {
  isCoarsePointer: false,
  isTouch: false,
  viewportWidth: 1680,
};

describe('deviceTypeFromProfile', () => {
  it('deviceTypeFromProfile_touchFirstNarrowViewport_returnsPhone', () => {
    expect(deviceTypeFromProfile(phoneProfile)).toBe('phone');
  });

  it('deviceTypeFromProfile_finePointerWideViewport_returnsDesktop', () => {
    expect(deviceTypeFromProfile(desktopProfile)).toBe('desktop');
  });

  it('deviceTypeFromProfile_touchscreenLaptopWideViewport_returnsDesktop', () => {
    // A touchscreen laptop is touch-capable but wide — keep it on the map-default path.
    expect(
      deviceTypeFromProfile({ isCoarsePointer: true, isTouch: true, viewportWidth: 1440 })
    ).toBe('desktop');
  });

  it('deviceTypeFromProfile_touchButFinePointerNarrow_returnsDesktop', () => {
    // Narrow window on a fine-pointer (mouse) device is still a desktop.
    expect(
      deviceTypeFromProfile({ isCoarsePointer: false, isTouch: true, viewportWidth: 600 })
    ).toBe('desktop');
  });
});

describe('resolveSurface', () => {
  it('resolveSurface_phoneAutoUnpaired_returnsFpv', () => {
    expect(resolveSurface({ deviceType: 'phone', viewMode: 'auto' })).toBe('fpv');
  });

  it('resolveSurface_desktopAutoUnpaired_returnsMap', () => {
    expect(resolveSurface({ deviceType: 'desktop', viewMode: 'auto' })).toBe('map');
  });

  it('resolveSurface_desktopOverrideFpv_returnsFpv', () => {
    // Manual override beats the device-class default.
    expect(resolveSurface({ deviceType: 'desktop', viewMode: 'fpv' })).toBe('fpv');
  });

  it('resolveSurface_phoneOverrideMap_returnsMap', () => {
    expect(resolveSurface({ deviceType: 'phone', viewMode: 'map' })).toBe('map');
  });

  it('resolveSurface_overrideBeatsPairingRole', () => {
    // Even a paired controller honours an explicit map override.
    expect(
      resolveSurface({
        deviceType: 'phone',
        viewMode: 'map',
        pairing: { surfaceRole: 'controller' },
      })
    ).toBe('map');
  });

  it('resolveSurface_pairedControllerAuto_returnsFpv', () => {
    expect(
      resolveSurface({
        deviceType: 'desktop',
        viewMode: 'auto',
        pairing: { surfaceRole: 'controller' },
      })
    ).toBe('fpv');
  });

  it('resolveSurface_pairedViewerAuto_returnsMap', () => {
    expect(
      resolveSurface({
        deviceType: 'phone',
        viewMode: 'auto',
        pairing: { surfaceRole: 'viewer' },
      })
    ).toBe('map');
  });

  it('resolveSurface_unpairedNullRoleAuto_fallsBackToDeviceClass', () => {
    expect(
      resolveSurface({ deviceType: 'phone', viewMode: 'auto', pairing: { surfaceRole: null } })
    ).toBe('fpv');
    expect(
      resolveSurface({ deviceType: 'desktop', viewMode: 'auto', pairing: { surfaceRole: null } })
    ).toBe('map');
  });
});

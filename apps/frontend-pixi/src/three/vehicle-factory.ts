import { createBus, createFerry, createTaxi, createUnderground, type VehicleHandle, type VehicleKind } from './vehicles';
import { createApparitionPoint, createFlooFireplace, createKnightBus, createPortkey } from './wizarding-vehicles';
import { createConvertible, createDreamCamper, createDreamSlide, createPinkYacht } from './barbie-vehicles';

type VehicleSet = Record<VehicleKind, (targetNodeId: number) => VehicleHandle>;

const LONDON: VehicleSet = {
  taxi: createTaxi,
  bus: createBus,
  underground: createUnderground,
  river: createFerry,
};

const VEHICLE_SETS: Record<string, VehicleSet> = {
  classic: LONDON,
  'harry-potter': {
    taxi: createApparitionPoint,
    bus: createKnightBus,
    underground: createFlooFireplace,
    river: createPortkey,
  },
  barbie: {
    taxi: createConvertible,
    bus: createDreamCamper,
    underground: createDreamSlide,
    river: createPinkYacht,
  },
};

/** The street vehicle for a transport in the given theme's world. */
export function createVehicle(kind: VehicleKind, targetNodeId: number, themeId: string): VehicleHandle {
  return (VEHICLE_SETS[themeId] ?? LONDON)[kind](targetNodeId);
}

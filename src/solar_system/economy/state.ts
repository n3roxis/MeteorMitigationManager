import { GameEconomyState } from './models';

const zeroFuel = { LEO: 0, DEPLOYED: 0 } as const;

export const economyState: GameEconomyState = {
  timeSec: 0,
  fundsBillion: 40,
  fuel: { ...zeroFuel },
  fuelReserved: { ...zeroFuel },
  researchUnlocked: new Set(),
  researchInProgress: new Set(),
  inventory: [],
  actions: [],
};

// Legacy migration helper: collapse any formerly enumerated Lagrange locations into DEPLOYED
export function migrateLegacyLocations() {
  for (const item of economyState.inventory) {
    if (item.location && item.location !== 'LEO' && item.location !== 'DEPLOYED') {
      item.location = 'DEPLOYED';
      if (item.transfer) {
        if (item.transfer.origin !== 'LEO') item.transfer.origin = 'DEPLOYED';
        if (item.transfer.destination !== 'LEO') item.transfer.destination = 'DEPLOYED';
      }
    }
  }
}

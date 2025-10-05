import { GameEconomyState } from './models';

// Central place to tweak starting funds for testing/balancing.
// Increase as needed during rapid iteration; reduce before final balancing pass.
export const INITIAL_FUNDS_BILLION = 500; // was 40

export const economyState: GameEconomyState = {
  timeSec: 0,
  fundsBillion: INITIAL_FUNDS_BILLION,
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

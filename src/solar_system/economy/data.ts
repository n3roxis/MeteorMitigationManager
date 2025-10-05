import { BuildableBlueprint, ResearchDef, BuildableType } from './models';

export const RESEARCH_DEFS: ResearchDef[] = [
  {
    id: 'small-kinetic',
    name: 'Small Kinetic Impactor',
    costFunds: 2,
    // Increased from 5 days to 4 weeks (~28 days)
    durationSec: 28 * 24 * 3600,
    unlocks: ['small-impactor']
  },
  {
    id: 'large-kinetic',
    name: 'Large Kinetic Impactor',
    costFunds: 5,
    // Increased from 10 days to ~2 months (60 days)
    durationSec: 60 * 24 * 3600,
    unlocks: ['large-impactor'],
    prereq: ['small-kinetic']
  },
  {
    id: 'space-laser',
    name: 'Space Laser Platform',
    costFunds: 12,
    // Increased from 14 days to ~3 months (90 days)
    durationSec: 90 * 24 * 3600,
    unlocks: ['laser-platform'],
    prereq: ['large-kinetic']
  },
  {
    id: 'tsunami-dams',
    name: 'Tsunami Mitigation Dams',
    costFunds: 6,
    // Large civil works research ~2 months
    durationSec: 60 * 24 * 3600,
    unlocks: ['tsunami-dam-module'],
    prereq: ['small-kinetic']
  },
  {
    id: 'giant-kinetic',
    name: 'Giant Kinetic Impactor',
    costFunds: 18,
    // Very long heavy program ~5 months (150 days)
    durationSec: 150 * 24 * 3600,
    unlocks: ['giant-impactor'],
    prereq: ['large-kinetic']
  }
];

export const BLUEPRINTS: BuildableBlueprint[] = [
  {
    type: 'small-impactor',
    name: 'Small Impactor Probe',
    buildCostFunds: 1.5,
    // Increased from 4 days to 14 days (2 weeks)
    buildDurationSec: 14 * 24 * 3600,
    massTons: 2,
    launchCostFunds: 0.4,
    activationFuelTons: 0.2,
    // Activation previously 6h -> now 7 days minimum baseline
    activationDurationSec: 7 * 24 * 3600
  },
  {
    type: 'large-impactor',
    name: 'Heavy Impactor Vehicle',
    buildCostFunds: 3.5,
    // 8 days -> 28 days (4 weeks)
    buildDurationSec: 28 * 24 * 3600,
    massTons: 6,
    launchCostFunds: 0.9,
    activationFuelTons: 0.5,
    // 8h -> 14 days
    activationDurationSec: 14 * 24 * 3600
  },
  {
    type: 'laser-platform',
    name: 'Orbital Laser Platform',
    buildCostFunds: 9,
    // 18 days -> 60 days (~2 months)
    buildDurationSec: 60 * 24 * 3600,
    massTons: 20,
    launchCostFunds: 2.5,
    activationFuelTons: 5,
    // 12h -> 30 days (1 month)
    activationDurationSec: 30 * 24 * 3600
  },
  {
    type: 'giant-impactor',
    name: 'Giant Impactor Vehicle',
    buildCostFunds: 15,
    // Long fabrication ~90 days
    buildDurationSec: 90 * 24 * 3600,
    massTons: 60,
    launchCostFunds: 5.5,
    activationFuelTons: 2,
    activationDurationSec: 30 * 24 * 3600
  },
  {
    type: 'tsunami-dam-module',
    name: 'Tsunami Dam Module',
    buildCostFunds: 4,
    buildDurationSec: 45 * 24 * 3600,
    massTons: 50,
    launchCostFunds: 3,
    // Civil module: no activation fuel
    activationDurationSec: 14 * 24 * 3600
  }
];

export const BLUEPRINT_INDEX = new Map(BLUEPRINTS.map(b => [b.type, b]));
export const RESEARCH_INDEX = new Map(RESEARCH_DEFS.map(r => [r.id, r]));

export function isUnlocked(unlocked: Set<string>, type: BuildableType): boolean {
  for (const r of RESEARCH_DEFS) {
    if (r.unlocks.includes(type)) {
      if (!unlocked.has(r.id)) return false;
    }
  }
  return true;
}

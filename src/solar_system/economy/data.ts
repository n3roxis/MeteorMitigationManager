import { BuildableBlueprint, ResearchDef, BuildableType } from './models';
// NOTE (2025-10-05): Simulation global tick rate slowed ~10x. All long-form research/build/activation durations
// have been compressed ~2.5x–3x (not full 10x) to keep strategic pacing while reducing idle waiting.
// Original values kept in comments for reference (e.g., 90d -> 36d).

// Research progression overview (2025-10-05 revision - telescope research reinstated):
//  - Root: space-telescope-tech (unlocks space telescope). After building & activating the telescope it gates:
//      * 'evacuation-routes' (civil defense chain start)
//      * 'small-kinetic' (initial kinetic program start)
//  - Civil Defense Chain ordering (shown first): evacuation-routes -> impact-bunkers -> tsunami-dams
//      * Dams require bunkers; bunkers require evacuation routes.
//  - Space / Kinetic Chain: small-kinetic -> orbital-tanker-tech -> large-kinetic -> (branches) space-laser & orbital-habitat-tech -> giant-kinetic
//  - Activation-based gating implemented via requiresActivationOf (ResearchDef) and filtered in UI.
//  - This allows early telescope deployment to drive both mitigation planning and kinetic readiness.

export const RESEARCH_DEFS: ResearchDef[] = [
  {
    id: 'space-telescope-tech',
    name: 'Space Telescope Program',
    costFunds: 8,
  // Moderate complexity optics originally ~70d -> shortened (sim slowed 10x) to ~28d
  durationSec: 10 * 24 * 3600,
    unlocks: ['space-telescope']
    // No prereq (root research)
  },
  // Civil defense chain placed first (requested ordering)
  {
    id: 'evacuation-routes',
    name: 'Evacuation Routes Planning',
    costFunds: 5,
  // Civil defense logistics 45d -> 20d
  durationSec: 20 * 24 * 3600,
    unlocks: [],
    // Requires the space telescope to have been activated at least once before planning is meaningful
    requiresActivationOf: ['space-telescope']
  },
  {
    id: 'impact-bunkers',
    name: 'Impact Bunkers Program',
    costFunds: 9,
  // Hardened shelter engineering 80d -> 32d
  durationSec: 32 * 24 * 3600,
    unlocks: ['impact-bunker'],
    prereq: ['evacuation-routes']
  },
  {
    id: 'tsunami-dams',
    name: 'Tsunami Mitigation Dams',
    costFunds: 6,
  // Large civil works 60d -> 26d
  durationSec: 26 * 24 * 3600,
    unlocks: ['tsunami-dam-module'],
    prereq: ['impact-bunkers']
  },
  // Space / kinetic chain follows:
  {
    id: 'small-kinetic',
    name: 'Small Kinetic Impactor',
    costFunds: 2,
  // 28d -> 12d
  durationSec: 12 * 24 * 3600,
    unlocks: ['small-impactor'],
    // Must first activate the space telescope (discovery / tracking requirement)
    requiresActivationOf: ['space-telescope']
  },
  {
    id: 'orbital-tanker-tech',
    name: 'Orbital Tanker Systems',
    costFunds: 10,
  // Tanker systems 75d -> 30d
  durationSec: 30 * 24 * 3600,
    unlocks: ['orbital-tanker'],
    prereq: ['small-kinetic']
  },
  {
    id: 'large-kinetic',
    name: 'Large Kinetic Impactor',
    costFunds: 5,
  // Large kinetic 60d -> 24d
  durationSec: 24 * 24 * 3600,
    unlocks: ['large-impactor'],
    prereq: ['orbital-tanker-tech']
  },
  {
    id: 'giant-kinetic',
    name: 'Giant Kinetic Impactor',
    costFunds: 18,
  // Giant kinetic 150d -> 55d
  durationSec: 55 * 24 * 3600,
    unlocks: ['giant-impactor'],
    prereq: ['large-kinetic']
  },
  {
    id: 'orbital-habitat-tech',
    name: 'Orbital Habitat Systems',
    costFunds: 14,
  // Habitat systems 100d -> 40d
  durationSec: 40 * 24 * 3600,
    unlocks: ['orbital-habitat'],
    prereq: ['orbital-tanker-tech']
  },
  {
    id: 'space-laser',
    name: 'Space Laser Platform',
    costFunds: 12,
  // Space laser 90d -> 36d
  durationSec: 36 * 24 * 3600,
    unlocks: ['laser-platform'],
    prereq: ['orbital-habitat-tech']
  }
];

export const BLUEPRINTS: BuildableBlueprint[] = [
    {
    type: 'space-telescope',
    name: 'Space Telescope',
    buildCostFunds: 7,
  buildDurationSec: 24 * 24 * 3600,
    massTons: 3, // reduced from 12 to 3 to enable reaching L2
    launchCostFunds: 2.0,
    // Instant, costless on/off toggle at L2
    activationDurationSec: 0
  },
  {
    type: 'impact-bunker',
    name: 'Impact Bunker Complex',
    buildCostFunds: 6,
  // Large underground construction 65d -> 26d
  buildDurationSec: 26 * 24 * 3600,
    massTons: 80,
    launchCostFunds: 0, // never launched (ground infrastructure)
    activationDurationSec: 0
  }
  ,{
    type: 'tsunami-dam-module',
    name: 'Tsunami Dam Module',
    buildCostFunds: 4,
  buildDurationSec: 20 * 24 * 3600,
    massTons: 50,
    launchCostFunds: 3,
    // Civil module: no activation fuel
    activationDurationSec: 14 * 24 * 3600
  }
  ,{
    type: 'small-impactor',
    name: 'Small Impactor Probe',
    buildCostFunds: 1.5,
  // Small impactor build 14d -> 6d
  buildDurationSec: 6 * 24 * 3600,
    massTons: 2,
    launchCostFunds: 0.4,
    activationFuelTons: 0.2,
  // Activation 7d -> 3d
  activationDurationSec: 3 * 24 * 3600
  },
  
   {
    type: 'orbital-tanker',
    name: 'Orbital Tanker Rocket',
    buildCostFunds: 8,
  // Fabrication 50d -> 22d
  buildDurationSec: 22 * 24 * 3600,
  massTons: 1, // reduced dry mass from 25 to 1 for balance tweak
    launchCostFunds: 2.2,
    // Tanker carries large internal fuel for redistribution; activation reserves fuel for prepping transfer manifolds
    activationFuelTons: 12,
  activationDurationSec: 8 * 24 * 3600
  },
  {
    type: 'large-impactor',
    name: 'Heavy Impactor Vehicle',
    buildCostFunds: 3.5,
  // Heavy impactor build 28d -> 11d
  buildDurationSec: 11 * 24 * 3600,
    massTons: 6,
    launchCostFunds: 0.9,
    activationFuelTons: 0.5,
  // Activation 14d -> 5d
  activationDurationSec: 5 * 24 * 3600
  },
  {
    type: 'giant-impactor',
    name: 'Giant Impactor Vehicle',
    buildCostFunds: 15,
  // Giant impactor build 90d -> 34d
  buildDurationSec: 34 * 24 * 3600,
    massTons: 60,
    launchCostFunds: 5.5,
    activationFuelTons: 2,
  activationDurationSec: 12 * 24 * 3600
  },
  {
    type: 'orbital-habitat',
    name: 'Orbital Habitat Module',
    buildCostFunds: 11,
  // Complex pressurized module 70d -> 28d
  buildDurationSec: 28 * 24 * 3600,
    massTons: 35,
    launchCostFunds: 3.2,
    // Should not store or show any fuel
    fuelCapacityTons: 0,
    // No activation; passive once in LEO
    activationDurationSec: 0
  },
  {
    type: 'laser-platform',
    name: 'Orbital Laser Platform',
    buildCostFunds: 9,
  // Laser platform build 60d -> 24d
  buildDurationSec: 24 * 24 * 3600,
    massTons: 20,
    launchCostFunds: 2.5,
    activationFuelTons: 5,
  // Activation 30d -> 12d
  activationDurationSec: 12 * 24 * 3600
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

// Unified mapping from inventory item location codes to entity IDs.
export const LOCATION_TO_ENTITY_ID: Record<string,string> = {
  'LEO': 'earth',
  'SE_L1': 'sun-earth-L1',
  'SE_L2': 'sun-earth-L2',
  'SE_L3': 'sun-earth-L3',
  'SE_L4': 'sun-earth-L4',
  'SE_L5': 'sun-earth-L5'
};

export function resolveOriginEntityId(loc?: string): string {
  if (!loc) return 'earth';
  return LOCATION_TO_ENTITY_ID[loc] || 'earth';
}

// A subset of the 200 London nodes get named landmarks for the FPV labels and paper map.
// Anything not in this table just shows as "Node #N" / "Junction #N".
// These are the famous Scotland Yard board landmark assignments (approximate).
export const LANDMARK_NAMES: Record<number, string> = {
  1: "Regent's Park",
  3: "Marylebone",
  13: 'Baker Street',
  46: "King's Cross",
  67: 'Oxford Circus',
  79: 'Piccadilly Circus',
  89: 'Leicester Square',
  111: 'Mile End',
  128: 'Tower Hill',
  140: 'St. Paul’s',
  153: 'Bank',
  159: 'Liverpool Street',
  165: 'Waterloo',
  185: 'Bond Street',
  199: 'Holborn',
};

export function nodeDisplayName(nodeId: number): string {
  const name = LANDMARK_NAMES[nodeId];
  if (name) return name;
  return `Junction #${nodeId}`;
}

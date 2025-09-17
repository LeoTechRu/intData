import type { Area } from './types';

export interface AreaOption {
  id: number;
  label: string;
  depth: number;
  isLeaf: boolean;
  color?: string | null;
}

export function buildAreaOptions(areas: Area[]): AreaOption[] {
  const sorted = [...areas].sort((a, b) => {
    const mpA = a.mp_path ?? '';
    const mpB = b.mp_path ?? '';
    if (mpA === mpB) {
      return a.name.localeCompare(b.name);
    }
    return mpA.localeCompare(mpB);
  });

  const parents = new Set<number>();
  for (const area of areas) {
    if (area.parent_id !== null && area.parent_id !== undefined) {
      parents.add(area.parent_id);
    }
  }

  return sorted.map((area) => {
    const depth = area.depth ?? 0;
    const prefix = depth > 0 ? `${'— '.repeat(depth)}` : '';
    return {
      id: area.id,
      label: `${prefix}${area.name}`,
      depth,
      isLeaf: !parents.has(area.id),
      color: area.color,
    };
  });
}

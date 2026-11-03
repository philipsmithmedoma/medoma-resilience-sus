// Test helpers: the data pack the store holds for each home pack, and a store reset into a given pack.
import { buildDataPack } from '@/data/packs/home-packs';
import { initialData, useStore } from '@/data/store';
import type { HomePackId } from '@/data/types';
import { setActiveRoadPack } from '@/lib/roadModel';

export const KAROLINSKA_PACK = buildDataPack('karolinska');
export const SUS_PACK = buildDataPack('sus');

/** Resets the store as a demo reset does, but into the given pack (without the log entry a pack switch writes). */
export function resetStoreTo(packId: HomePackId): void {
  setActiveRoadPack(packId);
  useStore.setState({ ...initialData(packId) });
}

import { HOME_LAYER_KEYS, type HomeLayerKey } from '@/data/store-home';
import { useStore } from '@/data/store';
import { t, tm } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// Dot colours match the layer tokens the map draws with (LAYER_TOKEN in HomeMapLayers).
const DOT_CLASS: Record<HomeLayerKey, string> = {
  patients: 'bg-text-muted',
  roads: 'bg-text-secondary',
  el: 'bg-olive',
  water: 'bg-teal',
};

/** Layer toggles above the map (SPEC.md § 11.6): patients, roads, electricity, water. Chips with a colour dot and a text label. */
export function LayerChips({ className }: { className?: string }) {
  const layers = useStore((s) => s.home.layers);
  const setHomeLayer = useStore((s) => s.setHomeLayer);
  const labels = tm('HOME.layers');
  return (
    <div role="group" aria-label={t('HOME.layersAria')} className={cn('flex flex-wrap items-center gap-2', className)}>
      {HOME_LAYER_KEYS.map((key) => {
        const on = layers[key];
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            onClick={() => setHomeLayer(key, !on)}
            className={cn(
              'inline-flex h-7 items-center gap-2 rounded-full border px-3 text-small whitespace-nowrap transition-colors duration-150',
              on ? 'border-chip-blue-border bg-chip-blue-bg text-chip-blue-text' : 'border-chip-grey-border bg-chip-grey-bg text-chip-grey-text hover:bg-bg-muted',
            )}
          >
            <span aria-hidden className={cn('size-2 rounded-full', DOT_CLASS[key], !on && 'opacity-50')} />
            {labels[key]}
          </button>
        );
      })}
    </div>
  );
}

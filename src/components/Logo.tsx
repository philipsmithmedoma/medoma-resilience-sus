import { cn } from '@/lib/utils';

/** The Medoma nav symbol as inline SVG with fill currentColor, so it follows the text colour of the theme (DESIGN-DARK.md § 4). */
export function Logo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="130 130 306 306" role="img" aria-label="Medoma" className={cn('size-6 text-text', className)} style={{ fill: 'currentColor' }}>
      <polygon points="262.8,219.39 226.18,219.39 226.18,304.03 141.54,304.03 141.54,340.65 226.18,340.65 226.18,425.3 262.8,425.3 262.8,340.65 347.45,340.65 347.45,304.03 262.8,304.03" />
      <polygon points="311.81,141.74 285.92,167.63 388.58,270.28 388.58,425.2 425.2,425.2 425.2,255.12" />
    </svg>
  );
}

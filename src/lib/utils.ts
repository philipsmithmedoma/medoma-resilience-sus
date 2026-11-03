import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// The DESIGN.md type-scale utilities (text-title, text-body, …) are font-size classes, not colours:
// without this, tailwind-merge would drop "text-body" when a "text-text-secondary" colour follows.
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': ['text-title', 'text-heading', 'text-nav', 'text-body', 'text-small', 'text-figure'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

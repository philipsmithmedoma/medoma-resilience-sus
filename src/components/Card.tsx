import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface IconTileProps {
  icon: LucideIcon;
  iconClass: string;
  tileClass: string;
  className?: string;
}

/** 40 px icon tile (radius 8, tinted background, 20 px coloured icon) – DESIGN.md § 4. */
export function IconTile({ icon: Icon, iconClass, tileClass, className }: IconTileProps) {
  return (
    <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', tileClass, className)} aria-hidden>
      <Icon className={cn('size-5', iconClass)} strokeWidth={1.5} />
    </span>
  );
}

interface CardProps {
  title: string;
  subtitle?: string;
  tile?: IconTileProps;
  titleRight?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  id?: string;
}

/** White card, 1 px border, radius 8, padding 20, soft shadow; header tile + 18/400 title. */
export function Card({ title, subtitle, tile, titleRight, children, action, className, id }: CardProps) {
  return (
    <section id={id} className={cn('flex flex-col rounded-lg border border-border bg-surface p-5 shadow-card', className)}>
      <div className="flex items-center gap-3">
        {tile ? <IconTile {...tile} /> : null}
        <h3 className="text-[18px] leading-7 font-normal">
          {title}
          {subtitle ? <span className="ml-2 text-body text-text-secondary">{subtitle}</span> : null}
        </h3>
        {titleRight ? <div className="ml-auto flex items-center gap-2">{titleRight}</div> : null}
      </div>
      {children ? <div className="mt-4 flex-1">{children}</div> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </section>
  );
}

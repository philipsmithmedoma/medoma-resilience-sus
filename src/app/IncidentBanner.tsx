import { Link } from 'react-router-dom';
import { useStore } from '@/data/store';
import { lt, t } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface IncidentBannerProps {
  onClose: () => void;
}

/** SPEC.md § 2 – shown under the nav whenever an incident is active; colour by beredskapsläge. */
export function IncidentBanner({ onClose }: IncidentBannerProps) {
  const incident = useStore((s) => s.incident);
  if (!incident) return null;
  const katastrof = incident.lage === 'Katastrofläge';
  return (
    <div
      role="status"
      className={cn(
        'flex h-10 items-center justify-between border-y px-6 text-body font-medium text-text',
        katastrof ? 'border-banner-red-border bg-banner-red-bg' : 'border-banner-orange-border bg-banner-orange-bg',
      )}
    >
      <span className="truncate">{t('LABELS.incidentBanner', { name: lt(incident.name), lage: t(`LAGE_LABELS.${incident.lage}`), at: incident.activatedAt, by: incident.activatedBy, commander: incident.commander })}</span>
      <span className="flex shrink-0 items-center gap-6 whitespace-nowrap">
        <Link to="/incident" className="text-primary-text hover:text-primary-hover hover:underline">
          {t('LABELS.openIncident')}
        </Link>
        <button type="button" onClick={onClose} className="text-primary-text hover:text-primary-hover hover:underline">
          {t('LABELS.closeIncident')}
        </button>
      </span>
    </div>
  );
}

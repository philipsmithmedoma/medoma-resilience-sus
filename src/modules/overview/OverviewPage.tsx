import { Link } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { PageTitle } from '@/components/PageTitle';

/** Översikt (SPEC.md § 10), the first page of preparedness mode. */
export function OverviewPage() {
  return (
    <div className="space-y-4">
      <PageTitle title={t('MODULES.overview')} />
      <p className="max-w-[640px]">{t('STUB.text')}</p>
      <Link to="/home" className="text-primary-text hover:text-primary-hover hover:underline">
        {t('STUB.link')}
      </Link>
    </div>
  );
}

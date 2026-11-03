import { Link } from 'react-router-dom';
import { t } from '@/lib/i18n';
import { PageTitle } from '@/components/PageTitle';

/** Beroenden (SPEC.md § 10), in preparedness mode. */
export function DependenciesPage() {
  return (
    <div className="space-y-4">
      <PageTitle title={t('MODULES.dependencies')} />
      <p className="max-w-[640px]">{t('STUB.text')}</p>
      <Link to="/home" className="text-primary-text hover:text-primary-hover hover:underline">
        {t('STUB.link')}
      </Link>
    </div>
  );
}

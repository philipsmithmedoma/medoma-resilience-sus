import { Link } from 'react-router-dom';
import type { ModuleDef } from '@/data/vocab';
import { t } from '@/lib/i18n';
import { PageTitle } from '@/components/PageTitle';

/** SPEC.md § 11.2 – a platform module that exists in Medoma today and is outside the prototype. */
export function PlatformStubPage({ module }: { module: ModuleDef }) {
  return (
    <div className="space-y-4">
      <PageTitle title={t(`MODULES.${module.key}`)} />
      <p className="max-w-[640px]">{t('STUB.text')}</p>
      <Link to="/home" className="text-primary-text hover:text-primary-hover hover:underline">
        {t('STUB.link')}
      </Link>
    </div>
  );
}

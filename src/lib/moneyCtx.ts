import { getFx } from './fx';
import { localeMeta, type Locale } from '../i18n/config';
import { useTranslations } from '../i18n';
import type { Currency, MoneyCtx } from './money';

/** Contexte de prix pour une langue : taux du jour, devise par défaut de la langue, libellés traduits. */
export async function getMoneyCtx(locale: Locale, target?: Currency): Promise<MoneyCtx & { date: string }> {
	const fx = await getFx();
	const t = useTranslations(locale);
	return {
		rate: fx.usdPerEur,
		date: fx.date,
		target: target ?? localeMeta[locale].currency,
		locale: localeMeta[locale].intl,
		labels: { seller: t.money.seller, converted: t.money.converted },
	};
}

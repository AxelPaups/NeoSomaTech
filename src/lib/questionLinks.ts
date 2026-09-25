import { listQuestions } from './content';
import { questionsLinkedTo } from './questionUtils';
import type { Locale } from '../i18n';

export type LinkedQuestion = { question: string; slug: string; reponse_courte: string | null };

/** Questions publiées rattachées à un article ou à un produit, dans la langue de la page. Jamais bloquant : en cas d'erreur, aucune question. */
export async function loadLinkedQuestions(
	locale: Locale,
	field: 'article_lie' | 'produit_lie',
	id: number | null | undefined,
	n = 6,
): Promise<LinkedQuestion[]> {
	if (!id) return [];
	try {
		const all = await listQuestions(locale, 'id,question,slug,reponse_courte,article_lie,produit_lie,date_publication');
		return questionsLinkedTo(all, field, id, n).map((q: any) => ({ question: q.question, slug: q.slug, reponse_courte: q.reponse_courte ?? null }));
	} catch {
		return [];
	}
}

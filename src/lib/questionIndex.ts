import { listQuestions, listArticles } from './content';
import { path, type Locale } from '../i18n';
import type { SearchDoc } from './questionSearch';

/** Questions publiées + articles d'une langue, sous la forme attendue par la recherche du navigateur. */
export async function buildSearchIndex(locale: Locale): Promise<SearchDoc[]> {
	const [questions, articles] = await Promise.all([
		listQuestions(locale),
		listArticles(locale, 'id,titre,slug,description_seo'),
	]);
	return [
		...questions.map((q: any): SearchDoc => ({
			type: 'question',
			slug: q.slug,
			title: q.question,
			url: path(locale, 'questions', q.slug),
			keywords: q.mots_cles ?? '',
			snippet: q.reponse_courte ?? '',
			category: q.categorie ?? undefined,
		})),
		...articles.filter((a: any) => a.slug && a.titre).map((a: any): SearchDoc => ({
			type: 'article',
			slug: a.slug,
			title: a.titre,
			url: path(locale, 'articles', a.slug),
			snippet: a.description_seo ?? '',
		})),
	];
}

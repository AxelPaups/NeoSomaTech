import { fetchDirectus } from './directus';
import { getQuestion, listQuestions, localizeArticle, localizeProduct } from './content';
import { relatedQuestions } from './questionUtils';
import { locales, path, type Locale } from '../i18n';

export async function loadQuestionPage(locale: Locale, slug: string | undefined) {
	let question: any = null;
	let errorMessage: string | null = null;
	let related: { question: string; slug: string; reponse_courte: string | null }[] = [];
	let article: { titre: string; slug: string } | null = null;
	let product: { name: string; slug: string } | null = null;

	try {
		question = await getQuestion(locale, slug ?? '');
		if (question) {
			const [all, rawArticle, rawProduct] = await Promise.all([
				listQuestions(locale, 'id,question,slug,reponse_courte,categorie,date_publication'),
				question.article_lie ? fetchDirectus(`/items/Articles/${question.article_lie}?fields=id,titre,slug,translations.*`) : null,
				question.produit_lie ? fetchDirectus(`/items/Produits/${question.produit_lie}?fields=id,Nom_du_produit,nom_court,slug,translations.*`) : null,
			]);
			related = relatedQuestions(all, question, 3).map((r: any) => ({ question: r.question, slug: r.slug, reponse_courte: r.reponse_courte ?? null }));

			// Pas de lien vers une page qui n'existe pas dans cette langue.
			const a = rawArticle ? localizeArticle(rawArticle, locale) : null;
			if (a?.slug && a?.titre) article = { titre: a.titre, slug: a.slug };
			const p = rawProduct ? localizeProduct(rawProduct, locale) : null;
			if (p?.slug && (p.nom_court || p.Nom_du_produit)) product = { name: p.nom_court || p.Nom_du_produit, slug: p.slug };
		}
	} catch (error: any) {
		console.error('Erreur Question:', error);
		errorMessage = error.message;
	}

	const alternates: Partial<Record<Locale, string>> = question
		? Object.fromEntries(locales.filter((l) => question.slugs?.[l]).map((l) => [l, path(l, 'questions', question.slugs[l])]))
		: {};

	return { question, related, article, product, alternates, errorMessage, notFound: !question && !errorMessage };
}

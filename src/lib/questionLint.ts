import { tokenize } from './questionSearch.ts';
import { stripHtml, wordCount } from './questionUtils.ts';

export type LintLocale = 'fr' | 'en';

export interface QuestionRecord {
	question: string;
	slug: string;
	reponse_courte: string;
	reponse: string;
	mots_cles: string;
	categorie?: string | null;
	article_lie?: number | null;
}

export interface LintIssue {
	level: 'error' | 'warning';
	code: string;
	message: string;
}

/** Source unique des limites : le skill et les tests s'y réfèrent. */
export const LIMITS = {
	titleChars: [25, 90],
	slugWords: [3, 10],
	slugChars: 80,
	shortWords: [40, 60],
	bodyWords: { fr: [450, 1000], en: [400, 1000] } as Record<LintLocale, [number, number]>,
	h2: [3, 6],
	sectionMinWords: 60,
	keywordLines: [8, 20],
	keywordMaxChars: 80,
	keywordLongWords: 4,
	keywordLongMin: 2,
	internalLinksMin: 2,
	duplicateJaccard: 0.6,
} as const;

const SOURCES_TITLE = /^(sources?|r[eé]f[eé]rences?)\b/i;
const HEALTH = /arthrose|arthritis|proth[eè]se|prosthe|chirurgi|surgery|m[eé]dic|medic|douleur|\bpain\b|pathologi|hernie|m[eé]nisque|meniscus|ligament/i;
const DISCLAIMER =
	/pas un avis m[eé]dical|ne constitue (pas|ni) un avis|ne remplace pas (un|l['’])\s?avis|not medical advice|not a substitute for (professional )?medical advice|does not (constitute|replace) (professional )?(medical )?advice/i;
// Les liens vers le site lui-même sont des liens internes, pas des sources externes.
const SITE = /^https?:\/\/(www\.)?neosomatech\.com/i;
const allHrefs = (html: string): string[] => [...html.matchAll(/href=(?:"([^"]*)"|'([^']*)')/g)].map((m) => m[1] ?? m[2]);
const FORBIDDEN: Record<LintLocale, RegExp[]> = {
	fr: [/nous avons (test[eé]|essay[eé])/i, /notre (test|essai)s?\b/i, /miracle/i, /100\s?%\s?(efficace|garanti|sans)/i, /garanti(e|s|es)? (sans|contre)/i],
	en: [/we (have )?tested/i, /our (test|tests|testing)\b/i, /miracle/i, /100\s?%\s?(effective|guaranteed)/i, /guaranteed (pain|relief)/i],
};

export const internalLinks = (html: string): string[] =>
	allHrefs(html)
		.map((h) => h.replace(SITE, ''))
		.filter((h) => h.startsWith('/') && !h.startsWith('//'));
const externalLinks = (html: string): string[] => allHrefs(html).filter((h) => /^https?:\/\//i.test(h) && !SITE.test(h));

function sectionsOf(html: string): { title: string; words: number }[] {
	return html
		.split(/<h2[^>]*>/i)
		.slice(1)
		.map((part) => {
			const [heading, ...rest] = part.split(/<\/h2>/i);
			return { title: stripHtml(heading), words: wordCount(stripHtml(rest.join(' '))) };
		});
}

export function lintQuestion(rec: QuestionRecord, locale: LintLocale): LintIssue[] {
	const issues: LintIssue[] = [];
	const error = (code: string, message: string) => issues.push({ level: 'error', code, message });
	const warning = (code: string, message: string) => issues.push({ level: 'warning', code, message });

	const title = (rec.question ?? '').trim();
	if (!title.endsWith('?')) error('TITLE_NO_QUESTION_MARK', 'Le titre doit se terminer par « ? »');
	if (title.length < LIMITS.titleChars[0] || title.length > LIMITS.titleChars[1])
		error('TITLE_LENGTH', `Titre de ${title.length} caractères (attendu ${LIMITS.titleChars[0]} à ${LIMITS.titleChars[1]})`);

	const slug = rec.slug ?? '';
	const slugWords = slug.split('-').length;
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slugWords < LIMITS.slugWords[0] || slugWords > LIMITS.slugWords[1] || slug.length > LIMITS.slugChars)
		error('SLUG_FORMAT', `Slug « ${slug} » invalide (minuscules sans accents, ${LIMITS.slugWords[0]} à ${LIMITS.slugWords[1]} mots, ${LIMITS.slugChars} caractères max)`);

	const shortText = rec.reponse_courte ?? '';
	if (/<[a-z/]/i.test(shortText)) error('SHORT_HTML', 'La réponse courte doit être du texte brut');
	const shortWords = wordCount(shortText);
	if (shortWords < LIMITS.shortWords[0] || shortWords > LIMITS.shortWords[1])
		error('SHORT_LENGTH', `Réponse courte de ${shortWords} mots (attendu ${LIMITS.shortWords[0]} à ${LIMITS.shortWords[1]})`);

	const body = rec.reponse ?? '';
	const [minWords, maxWords] = LIMITS.bodyWords[locale];
	const bodyWords = wordCount(stripHtml(body));
	if (bodyWords < minWords || bodyWords > maxWords) error('BODY_LENGTH', `Réponse de ${bodyWords} mots (attendu ${minWords} à ${maxWords})`);
	if (/<h1[\s>]/i.test(body)) error('BODY_H1', 'Aucun <h1> dans la réponse (le titre de la page est le H1)');

	const main = sectionsOf(body).filter((s) => !SOURCES_TITLE.test(s.title));
	if (main.length < LIMITS.h2[0] || main.length > LIMITS.h2[1]) error('H2_COUNT', `${main.length} sections H2 hors Sources (attendu ${LIMITS.h2[0]} à ${LIMITS.h2[1]})`);
	for (const s of main) if (s.words < LIMITS.sectionMinWords) error('SECTION_THIN', `Section « ${s.title} » : ${s.words} mots (minimum ${LIMITS.sectionMinWords})`);

	const lines = (rec.mots_cles ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
	if (lines.length < LIMITS.keywordLines[0] || lines.length > LIMITS.keywordLines[1])
		error('KEYWORDS_COUNT', `${lines.length} lignes de mots-clés (attendu ${LIMITS.keywordLines[0]} à ${LIMITS.keywordLines[1]})`);
	if (lines.some((l) => l.length > LIMITS.keywordMaxChars)) error('KEYWORDS_TOO_LONG', `Une ligne de mots-clés dépasse ${LIMITS.keywordMaxChars} caractères`);
	if (lines.filter((l) => l.split(/\s+/).length >= LIMITS.keywordLongWords).length < LIMITS.keywordLongMin)
		warning('KEYWORDS_LONG', `Ajouter au moins ${LIMITS.keywordLongMin} formulations complètes (${LIMITS.keywordLongWords} mots ou plus) dans les mots-clés`);

	if (locale === 'fr' && !rec.article_lie) error('ARTICLE_MISSING', 'article_lie est obligatoire');

	const internal = internalLinks(body);
	if (internal.length < LIMITS.internalLinksMin) error('LINKS_INTERNAL_MIN', `${internal.length} lien(s) interne(s) (minimum ${LIMITS.internalLinksMin})`);
	for (const href of internal) {
		const isEn = href.startsWith('/en/') || href === '/en';
		if (locale === 'fr' && isEn) error('LINK_LOCALE', `Lien anglais dans une réponse française : ${href}`);
		if (locale === 'en' && !isEn) error('LINK_LOCALE', `Lien français dans une réponse anglaise : ${href}`);
	}

	const all = `${title} ${shortText} ${stripHtml(body)}`;
	for (const re of FORBIDDEN[locale]) if (re.test(all)) error('FORBIDDEN_PHRASE', `Formulation interdite détectée (${re})`);

	const external = externalLinks(body);
	if (rec.categorie === 'sante-securite' && external.length === 0) error('SOURCES_REQUIRED', 'Au moins une source externe est obligatoire pour la santé et la sécurité');
	else if (external.length === 0 && (/%/.test(all) || /\b(étude|etude|study)\b/i.test(all))) warning('SOURCES_ADVISED', 'Chiffre ou étude cité sans source externe');

	if (HEALTH.test(all) && !DISCLAIMER.test(all)) {
		if (rec.categorie === 'sante-securite') error('DISCLAIMER_REQUIRED', 'Mention « ceci n\'est pas un avis médical » obligatoire');
		else warning('DISCLAIMER_ADVISED', 'Sujet de santé détecté : ajouter la mention « pas un avis médical »');
	}

	if (/[€$]\s?\d|\d\s?(€|\$|euros?|dollars?)/i.test(all)) warning('PRICE_CHECK', 'Prix cité : vérifier chaque montant dans le catalogue Directus');

	return issues;
}

export function findDuplicates(
	rec: { question: string; slug: string },
	others: { title: string; slug: string; kind: 'question' | 'article' }[],
	locale: LintLocale,
): LintIssue[] {
	const mine = new Set(tokenize(rec.question, locale));
	const issues: LintIssue[] = [];
	for (const o of others) {
		if (o.kind === 'question' && o.slug === rec.slug) continue;
		const theirs = new Set(tokenize(o.title, locale));
		const inter = [...mine].filter((t) => theirs.has(t)).length;
		const union = new Set([...mine, ...theirs]).size;
		if (union > 0 && inter / union >= LIMITS.duplicateJaccard)
			issues.push({ level: 'warning', code: 'DUPLICATE_SUSPECT', message: `Très proche de ${o.kind === 'article' ? "l'article" : 'la question'} « ${o.title} » (${o.slug}) : enrichir l'existant plutôt que créer ?` });
	}
	return issues;
}

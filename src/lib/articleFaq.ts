/**
 * Extrait les paires question/réponse de la section FAQ d'un article, pour alimenter
 * le schema FAQPage (déjà en place sur les fiches produit, jamais branché sur les articles
 * alors qu'une dizaine d'entre eux ont une vraie section "Questions fréquentes" rédigée).
 *
 * Trois formats rencontrés dans le contenu existant :
 *  - <h3>Question ?</h3><p>Réponse.</p>  (le plus courant, articles récents)
 *  - <p><strong>Question ?</strong></p><p>Réponse.</p>  (quelques anciens articles)
 *  - <p><strong>Question ?</strong> Réponse dans le même paragraphe.</p>  (autres anciens articles)
 */

// Les articles plus anciens encodent les accents en entités HTML (&eacute; plutôt que é) ;
// les plus récents utilisent l'UTF-8 direct. On décode tout en amont pour que le matching
// de l'intitulé FAQ et le texte final passé au schema soient fiables dans les deux cas.
const NAMED_ENTITIES: Record<string, string> = {
	eacute: 'é', egrave: 'è', ecirc: 'ê', euml: 'ë',
	agrave: 'à', acirc: 'â', auml: 'ä',
	icirc: 'î', iuml: 'ï',
	ocirc: 'ô', ograve: 'ò', ouml: 'ö',
	ucirc: 'û', ugrave: 'ù', uuml: 'ü',
	ccedil: 'ç', oelig: 'œ', aelig: 'æ',
	laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘',
	ldquo: '“', rdquo: '”',
	mdash: '—', ndash: '–', hellip: '…',
	nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
};
const decodeEntities = (html: string) =>
	html
		.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (full, code: string) => {
			if (code[0] === '#') {
				const cp = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
				return Number.isFinite(cp) ? String.fromCodePoint(cp) : full;
			}
			return NAMED_ENTITIES[code.toLowerCase()] ?? full;
		});

const stripTags = (html: string) => decodeEntities(html).replace(/<[^>]*>?/gm, '').replace(/\s+/g, ' ').trim();

// Repère l'intitulé de la section FAQ (FR ou EN), quels que soient ses attributs HTML,
// une éventuelle numérotation ("7. ") et du texte avant/après l'expression clé.
const FAQ_HEADING =
	/<h2[^>]*>\s*(?:\d+[.)]\s*)?[^<]*?(questions?\s+fr[eé]quentes?|frequently\s+asked\s+questions|foire\s+aux\s+questions|\bfaq\b)[^<]*<\/h2>/i;
// Bornes de fin de section : le prochain <h2>, un <hr>, ou la fin du contenu.
const SECTION_END = /(<h2[\s>]|<hr\s*\/?>)/i;

export function extractFaqFromHtml(rawHtml: string | null | undefined): { question: string; reponse: string }[] {
	if (!rawHtml) return [];
	const html = decodeEntities(rawHtml);

	const headingMatch = FAQ_HEADING.exec(html);
	if (!headingMatch) return [];

	const afterHeading = html.slice(headingMatch.index + headingMatch[0].length);
	const endMatch = SECTION_END.exec(afterHeading);
	const zone = endMatch ? afterHeading.slice(0, endMatch.index) : afterHeading;

	// Format 1 : <h3>Q</h3> ... <p>A</p> (une ou plusieurs réponses jusqu'au prochain <h3>)
	const h3Pairs: { question: string; reponse: string }[] = [];
	const h3Re = /<h3[^>]*>(.*?)<\/h3>([\s\S]*?)(?=<h3[\s>]|$)/gi;
	let m: RegExpExecArray | null;
	while ((m = h3Re.exec(zone))) {
		const question = stripTags(m[1]);
		const reponse = stripTags(m[2]);
		if (question && reponse) h3Pairs.push({ question, reponse });
	}
	if (h3Pairs.length > 0) return h3Pairs;

	// Format 2 (repli) : <p><strong>Q</strong></p><p>A</p> — question et réponse dans deux <p> distincts.
	const boldPairs: { question: string; reponse: string }[] = [];
	const boldRe = /<p>\s*<strong>(.*?)<\/strong>\s*<\/p>\s*<p>(.*?)<\/p>/gi;
	while ((m = boldRe.exec(zone))) {
		const question = stripTags(m[1]);
		const reponse = stripTags(m[2]);
		if (question && reponse) boldPairs.push({ question, reponse });
	}
	if (boldPairs.length > 0) return boldPairs;

	// Format 3 (repli) : <p><strong>Q</strong> réponse dans le même paragraphe</p>
	const inlinePairs: { question: string; reponse: string }[] = [];
	const inlineRe = /<p>\s*<strong>(.*?)<\/strong>\s*(.*?)<\/p>/gi;
	while ((m = inlineRe.exec(zone))) {
		const question = stripTags(m[1]);
		const reponse = stripTags(m[2]);
		if (question && reponse) inlinePairs.push({ question, reponse });
	}
	return inlinePairs;
}

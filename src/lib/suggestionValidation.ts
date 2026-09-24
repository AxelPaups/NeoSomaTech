export type SuggestionResult =
	| { status: 'ok'; value: { texte: string; email: string | null; langue: 'fr' | 'en' } }
	| { status: 'invalid'; message: string }
	| { status: 'bot' };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateSuggestion(payload: unknown): SuggestionResult {
	if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return { status: 'invalid', message: 'Requête invalide' };
	const p = payload as Record<string, unknown>;

	// Champ leurre : invisible pour un humain, rempli par les robots.
	if (typeof p.website === 'string' && p.website.trim() !== '') return { status: 'bot' };

	const texte = typeof p.texte === 'string' ? p.texte.replace(/\s+/g, ' ').trim() : '';
	if (texte.length < 10 || texte.length > 300) return { status: 'invalid', message: 'La question doit faire entre 10 et 300 caractères' };
	if (/https?:\/\/|www\./i.test(texte)) return { status: 'invalid', message: 'Les liens ne sont pas acceptés' };

	const emailRaw = typeof p.email === 'string' ? p.email.trim() : '';
	if (emailRaw && (emailRaw.length > 254 || !EMAIL.test(emailRaw))) return { status: 'invalid', message: 'Email invalide' };

	return { status: 'ok', value: { texte, email: emailRaw || null, langue: p.langue === 'en' ? 'en' : 'fr' } };
}

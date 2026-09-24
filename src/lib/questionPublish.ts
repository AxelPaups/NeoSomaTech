export interface ExistingQuestion {
	statut?: string | null;
	date_publication?: string | null;
}

/**
 * Champs de statut et de dates à écrire lors d'une publication par script.
 * Sans statut demandé, une question existante garde le sien (relancer le script ne dépublie jamais),
 * et la date de publication n'est fixée qu'au passage en « publié ».
 */
export function planWrite(existing: ExistingQuestion | null, requested: 'brouillon' | 'publie' | undefined, today: string) {
	const statut = requested ?? existing?.statut ?? 'brouillon';
	const becomesPublished = statut === 'publie' && existing?.statut !== 'publie';
	const date_publication = becomesPublished || !existing?.date_publication ? today : existing.date_publication;
	return { statut, date_publication, date_updated: today };
}

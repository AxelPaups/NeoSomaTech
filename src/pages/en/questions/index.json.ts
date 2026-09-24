import type { APIRoute } from 'astro';
import { buildSearchIndex } from '../../../lib/questionIndex';

export const GET: APIRoute = async () => {
	try {
		const docs = await buildSearchIndex('en');
		return new Response(JSON.stringify(docs), {
			headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300' },
		});
	} catch (error) {
		console.error('Index questions EN:', error);
		return new Response('[]', { status: 502, headers: { 'Content-Type': 'application/json' } });
	}
};

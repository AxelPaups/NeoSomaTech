import rss from '@astrojs/rss';
import { fetchDirectus } from '../lib/directus';

export async function GET(context) {
  const articles = await fetchDirectus(
    '/items/Articles?sort=-date_publication&fields=id,titre,slug,description_seo,date_publication,auteur'
  );

  return rss({
    title: 'NeoSomaTech - Les Articles sur les Exosquelettes',
    description: 'Actualités, guides et innovations dans le monde des exosquelettes.',
    site: context.site,
    items: articles.map((article) => ({
      title: article.titre,
      pubDate: new Date(article.date_publication),
      description: article.description_seo,
      link: `/articles/${article.slug}/`,
    })),
    customData: `<language>fr-fr</language>`,
  });
}

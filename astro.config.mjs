import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://neosomatech.com', // Remplacer par votre domaine final
  output: 'server',
  adapter: cloudflare(),
  integrations: [sitemap()],
});
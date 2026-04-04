import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  site: 'https://neosomatech.com',
  output: 'server',
  adapter: cloudflare(),
  integrations: [],
});
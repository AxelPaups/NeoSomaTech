import { defineConfig } from 'astro/config';
import cloudflare from '@astrojs/cloudflare';
import node from '@astrojs/node';

export default defineConfig({
  site: 'https://neosomatech.com',
  output: 'server',
  adapter: process.env.NODE_ENV === 'development' ? node({ mode: 'development' }) : cloudflare(),
  integrations: [],
});
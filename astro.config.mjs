import { defineConfig } from 'astro/config';
import node from '@astrojs/node'; // On ajoute le support pour le serveur

export default defineConfig({
  output: 'server', // <-- C'est CETTE ligne qui dit à Astro de ne plus demander getStaticPaths
  adapter: node({
    mode: 'standalone',
  }),
});
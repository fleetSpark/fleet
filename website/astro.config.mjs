import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

export default defineConfig({
  site: 'https://fleetspark.dev',
  integrations: [
    starlight({
      title: 'Fleet',
      logo: {
        src: './src/assets/logo.svg',
        alt: 'Fleet',
        replacesTitle: true,
      },
      favicon: '/favicon.svg',
      customCss: ['./src/styles/custom.css'],
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/fleetSpark/fleet' },
      ],
      sidebar: [
        { label: 'Getting Started', slug: 'getting-started' },
        {
          label: 'Concepts',
          items: [
            { label: 'Protocol', slug: 'protocol' },
            { label: 'Adapters', slug: 'adapters' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'Configuration', slug: 'configuration' },
          ],
        },
        { label: 'Contributing', slug: 'contributing' },
      ],
    }),
  ],
});

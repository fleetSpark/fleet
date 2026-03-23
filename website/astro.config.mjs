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
        { icon: 'open-book', label: 'Docs', href: 'https://fleetspark.dev/getting-started/' },
      ],
      sidebar: [
        { label: 'Getting Started', link: '/getting-started/' },
        {
          label: 'Concepts',
          items: [
            { label: 'Architecture', link: '/architecture/' },
            { label: 'Protocol', link: '/protocol/' },
            { label: 'Adapters', link: '/adapters/' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'CLI Commands', link: '/cli-reference/' },
            { label: 'Configuration', link: '/configuration/' },
          ],
        },
        { label: 'Contributing', link: '/contributing/' },
        { label: 'FAQ', link: '/faq/' },
      ],
    }),
  ],
});

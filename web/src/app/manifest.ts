import type { MetadataRoute } from 'next';

// Installable web app (non-functional requirement: check-in works as a PWA).
// Names and colours from the design system's brand foundations.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TEDxGUC',
    short_name: 'TEDxGUC',
    start_url: '/portal',
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: '/icons/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/app-icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

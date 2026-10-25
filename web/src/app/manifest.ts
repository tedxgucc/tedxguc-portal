import type { MetadataRoute } from 'next';
import { BASE_PATH } from '@/lib/env';

export const dynamic = 'force-static';

// Installable web app (non-functional requirement: check-in works as a PWA).
// Names and colours from the design system's brand foundations.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'TEDxGUC',
    short_name: 'TEDxGUC',
    start_url: `${BASE_PATH}/portal/`,
    scope: `${BASE_PATH}/`,
    display: 'standalone',
    background_color: '#000000',
    theme_color: '#000000',
    icons: [
      { src: `${BASE_PATH}/icons/app-icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: `${BASE_PATH}/icons/app-icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: `${BASE_PATH}/icons/app-icon-maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

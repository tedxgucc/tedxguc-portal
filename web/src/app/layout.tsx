import type { Metadata, Viewport } from 'next';
import { Anton, Inter, JetBrains_Mono } from 'next/font/google';
import '@/styles/globals.css';
import { ToastProvider } from '@/components/Toast';
import { SITE_DESCRIPTION, SITE_URL } from '@/lib/site';
import { BASE_PATH, DEMO } from '@/lib/env';

const anton = Anton({ weight: '400', subsets: ['latin'], variable: '--font-anton', display: 'swap' });
const inter = Inter({ weight: ['400', '500', '600', '700', '800'], subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const mono = JetBrains_Mono({ weight: '500', subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'TEDxGUC', template: '%s · TEDxGUC' },
  description: SITE_DESCRIPTION,
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL + '/') } : {}),
  openGraph: { type: 'website', locale: 'en_GB', siteName: 'TEDxGUC', title: 'TEDxGUC / Ideas worth spreading', description: SITE_DESCRIPTION, ...(SITE_URL ? { images: [{ url: SITE_URL + '/brand/tedxguc-lockup-black.png', width: 892, height: 143, alt: 'TEDxGUC' }] } : {}) },
  twitter: { card: 'summary', title: 'TEDxGUC', description: SITE_DESCRIPTION },
  robots: { index: !DEMO, follow: !DEMO },
  referrer: 'strict-origin-when-cross-origin',
  icons: {
    icon: [{ url: `${BASE_PATH}/icons/favicon.svg`, type: 'image/svg+xml' }, { url: `${BASE_PATH}/icons/favicon-32.png`, sizes: '32x32' }],
    apple: `${BASE_PATH}/icons/apple-touch-icon-180.png`,
  },
  appleWebApp: { capable: true, title: 'TEDxGUC', statusBarStyle: 'black' },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
  width: 'device-width',
  initialScale: 1,
};

// Runs before paint so the page never flashes the wrong theme
// (design system: "10 · Tokens as code → Theme switching").
const themeScript = `(function(){try{var s=localStorage.getItem('tx-theme');var t=s||(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.dataset.theme=t;if(localStorage.getItem('tx-nav')==='closed')document.documentElement.dataset.nav='closed';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

// Decide the homepage intro before paint; returning visits and reduced motion skip it.
const introScript = "(function(){try{var base="+JSON.stringify(BASE_PATH)+";var home=location.pathname.replace(/\\/+$/, '')===base.replace(/\\/+$/, '');if(home&&!sessionStorage.getItem('tx-intro-seen')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.documentElement.classList.add('intro-playing');}else{document.documentElement.classList.add('intro-done');}}catch(e){}})();" ;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" className={`${anton.variable} ${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script dangerouslySetInnerHTML={{ __html: introScript }} />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

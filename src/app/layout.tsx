import type { Metadata, Viewport } from 'next';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@/styles/globals.css';
import { Providers } from './providers';
import { THEME_INIT_SCRIPT } from '@/components/shell/ThemeProvider';

export const metadata: Metadata = {
  title: {
    default: 'nipponkayaku — Chemical Intelligence Platform',
    template: '%s · nipponkayaku',
  },
  description:
    'nipponkayaku is the Nippon Kayaku chemical intelligence platform — search chemicals by name, CAS or capability, and manage products, suppliers and manufacturing capacity in one place.',
  applicationName: 'nipponkayaku',
  robots: { index: false, follow: false }, // internal platform
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0f17' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" data-density="compact" suppressHydrationWarning>
      <head>
        {/* Stamps the stored theme before first paint — no flash of light
            theme for dark-mode users, and no hydration mismatch. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

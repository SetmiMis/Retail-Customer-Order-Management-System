import type { Metadata } from 'next';
import { Lato, Inter } from 'next/font/google';
import { ToastProvider } from '../components/ui/ToastProvider';
import { InlineScript } from '../components/InlineScript';
import Aurora from '../components/fx/Aurora';
import './globals.css';

const lato = Lato({ variable: '--font-heading', subsets: ['latin'], weight: ['700', '900'] });
const inter = Inter({ variable: '--font-body', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: 'SETMI INDIA — Order Management',
  description: 'Customer order portal + internal order operations',
};

// Runs before paint so the stored theme applies with no flash. Shares the
// 'fms-theme' key with the other SETMI apps. LIGHT is the default here (the
// public site setmiindia.com is light); dark is an explicit opt-in.
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('fms-theme');
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${lato.variable} ${inter.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={THEME_INIT_SCRIPT} />
      </head>
      <body className="min-h-full flex flex-col">
        <Aurora />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}

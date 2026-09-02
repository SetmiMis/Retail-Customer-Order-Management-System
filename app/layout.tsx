import type { Metadata } from 'next';
import { Chakra_Petch, Plus_Jakarta_Sans } from 'next/font/google';
import { ToastProvider } from '../components/ui/ToastProvider';
import { InlineScript } from '../components/InlineScript';
import Aurora from '../components/fx/Aurora';
import './globals.css';

const chakraPetch = Chakra_Petch({ variable: '--font-heading', subsets: ['latin'], weight: ['600', '700'] });
const plusJakarta = Plus_Jakarta_Sans({ variable: '--font-body', subsets: ['latin'], weight: ['400', '500', '600', '700', '800'] });

export const metadata: Metadata = {
  title: 'SETMI INDIA — Order Management',
  description: 'Customer order portal + internal order operations',
};

// Runs before paint so the stored theme applies with no flash. Shares the
// 'fms-theme' key with the Sales CRM and Purchase FMS. Dark is the default.
const THEME_INIT_SCRIPT = `
try {
  var t = localStorage.getItem('fms-theme');
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
} catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${chakraPetch.variable} ${plusJakarta.variable} h-full antialiased`}
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

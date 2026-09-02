import { redirect } from 'next/navigation';
import { getCustomer } from '../../../lib/auth/guard';
import PortalShell from '../../../components/layout/PortalShell';
import SmoothScroll from '../../../components/fx/SmoothScroll';
import PageTransition from '../../../components/fx/PageTransition';
import { CartProvider } from '../../../components/portal/CartProvider';

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer();
  if (!customer) redirect('/portal/login');
  return (
    <CartProvider>
      <SmoothScroll>
        <PortalShell customer={customer}>
          <PageTransition>{children}</PageTransition>
        </PortalShell>
      </SmoothScroll>
    </CartProvider>
  );
}

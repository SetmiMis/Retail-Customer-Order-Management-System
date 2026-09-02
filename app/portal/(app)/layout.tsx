import { redirect } from 'next/navigation';
import { getCustomer } from '../../../lib/auth/guard';
import PortalShell from '../../../components/layout/PortalShell';
import SmoothScroll from '../../../components/fx/SmoothScroll';
import PageTransition from '../../../components/fx/PageTransition';

export default async function PortalAppLayout({ children }: { children: React.ReactNode }) {
  const customer = await getCustomer();
  if (!customer) redirect('/portal/login');
  return (
    <SmoothScroll>
      <PortalShell customer={customer}>
        <PageTransition>{children}</PageTransition>
      </PortalShell>
    </SmoothScroll>
  );
}

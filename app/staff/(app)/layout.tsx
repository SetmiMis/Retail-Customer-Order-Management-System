import { redirect } from 'next/navigation';
import { getStaff } from '../../../lib/auth/guard';
import AppShell from '../../../components/layout/AppShell';
import PageTransition from '../../../components/fx/PageTransition';

export default async function StaffAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getStaff();
  if (!user) redirect('/staff/login');
  return (
    <AppShell user={user}>
      <PageTransition>{children}</PageTransition>
    </AppShell>
  );
}

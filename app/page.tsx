import { redirect } from 'next/navigation';
import { getStaff, getCustomer } from '../lib/auth/guard';

/** No landing page — route by whoever's signed in, else the customer login. */
export default async function Home() {
  if (await getStaff()) redirect('/staff/dashboard');
  if (await getCustomer()) redirect('/portal/dashboard');
  redirect('/portal/login');
}

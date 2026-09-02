'use client';

import { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';

function PortalLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setError(body.msg || 'Sign-in failed.');
        setBusy(false);
        return;
      }
      router.push(params.get('next') || '/portal/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong — please retry.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <label htmlFor="e">Email</label>
      <div className="pinwrap">
        <input id="e" type="email" autoFocus autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <label htmlFor="p" style={{ marginTop: 12 }}>Password</label>
      <div className="pinwrap">
        <input id="p" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="field-err" style={{ textAlign: 'center', marginTop: 10 }}>{error}</p>}
      <button type="submit" disabled={busy} className="btn" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
      <p style={{ textAlign: 'center', marginTop: 14, fontSize: 13 }} className="text-[var(--muted)]">
        New customer? <Link href="/portal/register" className="text-[var(--accent)] hover:underline">Create an account</Link>
      </p>
    </form>
  );
}

export default function PortalLoginPage() {
  return (
    <div className="gate">
      <motion.div
        className="gatebox card"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="logo" style={{ fontSize: 28, justifyContent: 'center' }}>SETMI <span className="in">INDIA</span></div>
        <p className="tagline" style={{ marginBottom: 18 }}>Customer Portal — sign in to place & track orders.</p>
        <Suspense>
          <PortalLoginForm />
        </Suspense>
      </motion.div>
    </div>
  );
}

'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';

function StaffLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/staff/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setError(body.msg || 'Sign-in failed.');
        setBusy(false);
        return;
      }
      router.push(params.get('next') || '/staff/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong — please retry.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full">
      <label htmlFor="u">Username</label>
      <div className="pinwrap">
        <input id="u" autoFocus autoComplete="username" required value={username} onChange={(e) => setUsername(e.target.value)} />
      </div>
      <label htmlFor="p" style={{ marginTop: 12 }}>Password</label>
      <div className="pinwrap">
        <input id="p" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="field-err" style={{ textAlign: 'center', marginTop: 10 }}>{error}</p>}
      <button type="submit" disabled={busy} className="btn" style={{ width: '100%', marginTop: 14, justifyContent: 'center' }}>
        {busy ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}

export default function StaffLoginPage() {
  return (
    <div className="gate">
      <motion.div
        className="gatebox card"
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="logo" style={{ fontSize: 28, justifyContent: 'center' }}>SETMI <span className="in">INDIA</span></div>
        <p className="tagline" style={{ marginBottom: 18 }}>Order Operations — staff sign-in.</p>
        <Suspense>
          <StaffLoginForm />
        </Suspense>
      </motion.div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';

export default function RegisterPage() {
  const router = useRouter();
  const [f, setF] = useState({ companyName: '', contactName: '', phone: '', whatsapp: '', email: '', password: '', gst: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/customer/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(f),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body.ok) {
        setError(body.msg || 'Could not create the account.');
        setBusy(false);
        return;
      }
      router.push('/portal/dashboard');
      router.refresh();
    } catch {
      setError('Something went wrong — please retry.');
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <motion.div
        className="gatebox card"
        style={{ maxWidth: 440 }}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="logo" style={{ fontSize: 26, justifyContent: 'center' }}>SETMI <span className="in">INDIA</span></div>
        <p className="tagline" style={{ marginBottom: 16 }}>Create your customer account.</p>
        <form onSubmit={submit} className="w-full grid gap-2">
          <div>
            <label htmlFor="company">Company / Firm name</label>
            <div className="pinwrap"><input id="company" required value={f.companyName} onChange={set('companyName')} /></div>
          </div>
          <div>
            <label htmlFor="contact">Your name</label>
            <div className="pinwrap"><input id="contact" required value={f.contactName} onChange={set('contactName')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label htmlFor="phone">Phone</label>
              <div className="pinwrap"><input id="phone" inputMode="tel" required value={f.phone} onChange={set('phone')} /></div>
            </div>
            <div>
              <label htmlFor="wa">WhatsApp <span className="text-[var(--muted)]">(optional)</span></label>
              <div className="pinwrap"><input id="wa" inputMode="tel" value={f.whatsapp} onChange={set('whatsapp')} /></div>
            </div>
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <div className="pinwrap"><input id="email" type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></div>
          </div>
          <div>
            <label htmlFor="pass">Password <span className="text-[var(--muted)]">(min 8 characters)</span></label>
            <div className="pinwrap"><input id="pass" type="password" autoComplete="new-password" required value={f.password} onChange={set('password')} /></div>
          </div>
          <div>
            <label htmlFor="gst">GST number <span className="text-[var(--muted)]">(optional)</span></label>
            <div className="pinwrap"><input id="gst" value={f.gst} onChange={set('gst')} /></div>
          </div>
          {error && <p className="field-err" style={{ textAlign: 'center' }}>{error}</p>}
          <button type="submit" disabled={busy} className="btn" style={{ width: '100%', marginTop: 8, justifyContent: 'center' }}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
          <p style={{ textAlign: 'center', marginTop: 6, fontSize: 13 }} className="text-[var(--muted)]">
            Already have one? <Link href="/portal/login" className="text-[var(--accent)] hover:underline">Sign in</Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowRight, PackageCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { Scene3D, ParticleField } from '../components/fx/lazy';
import Reveal from '../components/fx/Reveal';

const ease = [0.16, 1, 0.3, 1] as const;

export default function Home() {
  return (
    <main className="portal-shell">
      <section style={{ position: 'relative', overflow: 'hidden', minHeight: '92vh', display: 'flex', alignItems: 'center' }}>
        <ParticleField density={1} />
        <Scene3D />
        <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 1080, margin: '0 auto', padding: '80px 22px' }}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease }}
            className="glass-2"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', fontSize: 12, fontWeight: 700 }}
          >
            <Sparkles size={14} className="text-[var(--accent2)]" />
            SETMI INDIA · Retail Order Management
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease }}
            className="brand-heading"
            style={{ fontSize: 'clamp(38px, 6vw, 68px)', lineHeight: 1.05, margin: '20px 0 0', maxWidth: 820 }}
          >
            Order karo. <span className="gradient-text">Rate humse baat karo.</span> Baaki sab hum sambhaal lenge.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease }}
            style={{ marginTop: 18, fontSize: 17, color: 'var(--muted)', maxWidth: 620 }}
          >
            Ek jagah se poora order — product chuno, quantity daalo, submit karo. Koi rate/price nahi bharni.
            Hamari team aapse personally rate confirm karti hai, phir quantity check, packing aur dispatch hum handle karte hain.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease }}
            style={{ marginTop: 30, display: 'flex', gap: 12, flexWrap: 'wrap' }}
          >
            <Link href="/portal/register" className="btn primary shine" style={{ padding: '14px 26px', fontSize: 15 }}>
              Customer account banao <ArrowRight size={16} />
            </Link>
            <Link href="/portal/login" className="btn ghost" style={{ padding: '14px 24px', fontSize: 15 }}>
              Sign in
            </Link>
            <Link href="/staff/login" className="btn ghost" style={{ padding: '14px 24px', fontSize: 15 }}>
              Staff sign-in
            </Link>
          </motion.div>
        </div>
      </section>

      <section style={{ maxWidth: 1080, margin: '0 auto', padding: '10px 22px 80px', width: '100%' }}>
        <div className="grid3" style={{ gap: 18 }}>
          {[
            { icon: PackageCheck, title: 'No rate, no confusion', body: 'Customer screen par kahin price nahi. Rate phone / WhatsApp par personally tay hota hai.' },
            { icon: ShieldCheck, title: 'Har item ka hisaab', body: 'Ordered vs available quantity track hoti hai. Stock kam ho to requirement Purchase FMS mein chali jaati hai.' },
            { icon: Sparkles, title: 'Live tracking', body: 'Order Received → Confirmed → Preparing → Packing → Dispatched — sab aapki screen par.' },
          ].map((f, i) => (
            <Reveal key={f.title} delay={i * 0.08}>
              <div className="card lift shine" style={{ height: '100%' }}>
                <f.icon size={22} className="text-[var(--accent)]" />
                <h3 className="brand-heading" style={{ fontSize: 17, margin: '12px 0 6px' }}>{f.title}</h3>
                <p style={{ color: 'var(--muted)', fontSize: 13.5, margin: 0 }}>{f.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>
    </main>
  );
}

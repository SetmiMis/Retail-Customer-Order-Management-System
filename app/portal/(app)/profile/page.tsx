'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, patchJSON, postJSON } from '../../../../lib/client';
import { useToast } from '../../../../components/ui/ToastProvider';

interface Profile { companyName: string; contactName: string; phone: string; whatsapp: string; email: string; gst: string }
interface Addr { addressId: string; label: string; line1: string; line2: string; city: string; district: string; state: string; pincode: string; isDefault: boolean }

export default function ProfilePage() {
  const toast = useToast();
  const { data: pData, mutate: mutateP } = useSWR<{ profile: Profile }>('/api/portal/profile', fetcher);
  const { data: aData, mutate: mutateA } = useSWR<{ addresses: Addr[] }>('/api/portal/addresses', fetcher);

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 className="brand-heading" style={{ fontSize: 24, margin: '0 0 18px' }}>Profile</h1>
      {pData?.profile && <ProfileForm profile={pData.profile} onSaved={() => mutateP()} toast={toast} />}

      <h2 className="brand-heading" style={{ fontSize: 18, margin: '30px 0 12px' }}>Delivery addresses</h2>
      <div className="grid gap-2">
        {(aData?.addresses ?? []).map((a) => (
          <div key={a.addressId} className="card" style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>{a.label} {a.isDefault && <span className="pill">Default</span>}</div>
              <div style={{ color: 'var(--muted)' }}>{[a.line1, a.line2, a.city, a.district, a.state, a.pincode].filter(Boolean).join(', ')}</div>
            </div>
            {!a.isDefault && (
              <button
                className="btn ghost sm"
                onClick={async () => {
                  const r = await patchJSON(`/api/portal/addresses/${a.addressId}`, { isDefault: true });
                  r.ok ? mutateA() : toast.error(r.msg || 'Failed');
                }}
              >
                Make default
              </button>
            )}
          </div>
        ))}
      </div>
      <AddressForm onAdded={() => mutateA()} toast={toast} />
    </div>
  );
}

function ProfileForm({ profile, onSaved, toast }: { profile: Profile; onSaved: () => void; toast: ReturnType<typeof useToast> }) {
  const [f, setF] = useState(profile);
  const [pw, setPw] = useState({ currentPassword: '', password: '' });
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Profile) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function save() {
    setBusy(true);
    const body: Record<string, string> = {
      companyName: f.companyName, contactName: f.contactName, phone: f.phone, whatsapp: f.whatsapp, gst: f.gst,
    };
    if (pw.password) { body.password = pw.password; body.currentPassword = pw.currentPassword; }
    const r = await patchJSON('/api/portal/profile', body);
    setBusy(false);
    if (!r.ok) return toast.error(r.msg || 'Could not save.');
    toast.success('Profile saved.');
    setPw({ currentPassword: '', password: '' });
    onSaved();
  }

  return (
    <div className="card grid gap-2">
      <div><label>Company</label><input value={f.companyName} onChange={set('companyName')} /></div>
      <div><label>Contact name</label><input value={f.contactName} onChange={set('contactName')} /></div>
      <div className="grid2">
        <div><label>Phone</label><input value={f.phone} onChange={set('phone')} /></div>
        <div><label>WhatsApp</label><input value={f.whatsapp} onChange={set('whatsapp')} /></div>
      </div>
      <div><label>Email</label><input value={f.email} disabled /></div>
      <div><label>GST</label><input value={f.gst} onChange={set('gst')} /></div>
      <div className="form-section">
        <div className="form-subtitle">Change password</div>
        <div className="grid2">
          <div><label>Current password</label><input type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></div>
          <div><label>New password</label><input type="password" value={pw.password} onChange={(e) => setPw({ ...pw, password: e.target.value })} /></div>
        </div>
      </div>
      <button className="btn primary" style={{ justifyContent: 'center', marginTop: 6 }} disabled={busy} onClick={save}>
        {busy ? 'Saving…' : 'Save profile'}
      </button>
    </div>
  );
}

function AddressForm({ onAdded, toast }: { onAdded: () => void; toast: ReturnType<typeof useToast> }) {
  const empty = { label: 'Delivery', line1: '', line2: '', city: '', district: '', state: '', pincode: '', contactName: '', contactPhone: '', isDefault: false };
  const [f, setF] = useState(empty);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  async function add() {
    setBusy(true);
    const r = await postJSON('/api/portal/addresses', f);
    setBusy(false);
    if (!r.ok) return toast.error(r.msg || 'Could not add address.');
    toast.success('Address added.');
    setF(empty); setOpen(false); onAdded();
  }

  if (!open) return <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>+ Add address</button>;

  return (
    <div className="card grid gap-2" style={{ marginTop: 10 }}>
      <div className="grid2">
        <div><label>Label</label><input value={f.label} onChange={set('label')} /></div>
        <div><label>Pincode</label><input value={f.pincode} onChange={set('pincode')} /></div>
      </div>
      <div><label>Address line 1</label><input value={f.line1} onChange={set('line1')} /></div>
      <div><label>Address line 2</label><input value={f.line2} onChange={set('line2')} /></div>
      <div className="grid2">
        <div><label>City</label><input value={f.city} onChange={set('city')} /></div>
        <div><label>District</label><input value={f.district} onChange={set('district')} /></div>
      </div>
      <div><label>State</label><input value={f.state} onChange={set('state')} /></div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" style={{ width: 'auto' }} checked={f.isDefault} onChange={(e) => setF({ ...f, isDefault: e.target.checked })} />
        Set as default
      </label>
      <div className="actions">
        <button className="btn primary sm" disabled={busy} onClick={add}>{busy ? 'Adding…' : 'Add'}</button>
        <button className="btn ghost sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher, postJSON, patchJSON } from '../../../../lib/client';
import { OMS_ROLES } from '../../../../lib/oms/constants';
import { useToast } from '../../../../components/ui/ToastProvider';
import PageHeader from '../../../../components/ui/PageHeader';
import Modal from '../../../../components/ui/Modal';

interface U { userId: string; name: string; email: string; username: string; role: string; status: string; phone: string }
const BLANK = { name: '', email: '', username: '', password: '', role: 'SALES', phone: '', status: 'Active' };

export default function UsersPage() {
  const toast = useToast();
  const { data, mutate, isLoading } = useSWR<{ users: U[] }>('/api/staff/users', fetcher);
  const [edit, setEdit] = useState<(Partial<U> & { password?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setEdit((p) => ({ ...p, [k]: e.target.value }));

  async function save() {
    if (!edit) return;
    setBusy(true);
    const r = edit.userId ? await patchJSON(`/api/staff/users/${edit.userId}`, edit) : await postJSON('/api/staff/users', edit);
    setBusy(false);
    if (!r.ok) return toast.error(r.msg || 'Failed.');
    toast.success(r.msg || 'Saved.');
    setEdit(null); mutate();
  }

  return (
    <div>
      <PageHeader title="Users" subtitle="Internal staff accounts (5 roles)." actions={<button className="btn primary sm" onClick={() => setEdit({ ...BLANK })}>+ Add user</button>} />
      {isLoading ? <div className="skeleton" style={{ height: 200 }} /> : (
        <div className="tablecard"><table>
          <thead><tr><th>Name</th><th>Username</th><th>Email</th><th>Role</th><th>Status</th></tr></thead>
          <tbody>{(data?.users ?? []).map((u) => (
            <tr key={u.userId} onClick={() => setEdit({ ...u })}>
              <td><strong>{u.name}</strong></td><td>{u.username}</td><td>{u.email || '—'}</td>
              <td><span className="os os-accent">{u.role}</span></td>
              <td><span className={`os ${u.status === 'Active' ? 'os-success' : 'os-neutral'}`}>{u.status}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}

      {edit && (
        <Modal onClose={() => setEdit(null)}>
          <h3 className="sectitle">{edit.userId ? `Edit — ${edit.name}` : 'New user'}</h3>
          <div className="grid gap-2">
            <div><label>Name</label><input value={edit.name || ''} onChange={f('name')} /></div>
            {!edit.userId && <div><label>Username</label><input value={edit.username || ''} onChange={f('username')} /></div>}
            <div><label>Email</label><input value={edit.email || ''} onChange={f('email')} /></div>
            <div className="grid2">
              <div><label>Role</label><select value={edit.role || 'SALES'} onChange={f('role')}>{OMS_ROLES.map((r) => <option key={r}>{r}</option>)}</select></div>
              <div><label>Status</label><select value={edit.status || 'Active'} onChange={f('status')}><option>Active</option><option>Inactive</option></select></div>
            </div>
            <div><label>Phone</label><input value={edit.phone || ''} onChange={f('phone')} /></div>
            <div><label>{edit.userId ? 'Reset password (optional)' : 'Password'}</label><input type="password" value={edit.password || ''} onChange={f('password')} /></div>
            <div className="actions" style={{ marginTop: 6 }}>
              <button className="btn primary sm" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
              <button className="btn ghost sm" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

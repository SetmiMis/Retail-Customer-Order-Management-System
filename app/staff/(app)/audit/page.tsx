'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '../../../../lib/client';
import PageHeader from '../../../../components/ui/PageHeader';
import SearchInput from '../../../../components/ui/SearchInput';

interface E { timestamp: string; actorName: string; role: string; action: string; entity: string; entityId: string; oldValue: string; newValue: string; details: string }

export default function AuditPage() {
  const { data, isLoading } = useSWR<{ entries: E[] }>('/api/staff/audit?limit=400', fetcher);
  const [q, setQ] = useState('');
  const rows = (data?.entries ?? []).filter((e) =>
    !q || [e.actorName, e.action, e.entity, e.entityId, e.details].some((v) => String(v).toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every important action, append-only." />
      <div style={{ maxWidth: 280, marginBottom: 12 }}><SearchInput value={q} onChange={setQ} placeholder="Filter…" /></div>
      {isLoading ? <div className="skeleton" style={{ height: 300 }} /> : (
        <div className="tablecard"><table>
          <thead><tr><th>When</th><th>Who</th><th>Action</th><th>Entity</th><th>Change</th><th>Details</th></tr></thead>
          <tbody>{rows.map((e, i) => (
            <tr key={i}>
              <td style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{e.timestamp}</td>
              <td>{e.actorName}<div style={{ fontSize: 11, color: 'var(--muted)' }}>{e.role}</div></td>
              <td><span className="os os-accent">{e.action}</span></td>
              <td>{e.entity} {e.entityId}</td>
              <td style={{ fontSize: 12, color: 'var(--muted)' }}>{e.oldValue && `${e.oldValue} → `}{e.newValue}</td>
              <td style={{ fontSize: 12 }}>{e.details}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
    </div>
  );
}

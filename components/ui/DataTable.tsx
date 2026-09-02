'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import EmptyState from './EmptyState';
import { TableSkeleton } from './Skeleton';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  /** Column can be hidden via the "Columns" picker. Defaults to true. */
  hideable?: boolean;
  /** Defaults to visible. */
  defaultHidden?: boolean;
  width?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  pageSize?: number;
  selectable?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  renderBulkActions?: (selected: T[], clearSelection: () => void) => React.ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  maxHeight?: string;
  storageKey?: string;
}

export default function DataTable<T>({
  columns, rows, rowKey, onRowClick, loading, pageSize = 25, selectable, onSelectionChange,
  renderBulkActions, emptyTitle = 'No results', emptyDescription, maxHeight = '65vh', storageKey,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [hidden, setHidden] = useState<Set<string>>(() => {
    const initial = new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key));
    if (storageKey && typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(`dt-hidden:${storageKey}`);
        if (stored) return new Set(JSON.parse(stored));
      } catch { /* ignore */ }
    }
    return initial;
  });
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const colMenuRef = useRef<HTMLDivElement>(null);

  // Reset to page 1 whenever the row set changes (e.g. a filter changed) — done during render
  // rather than in an effect, per React's guidance for adjusting state on a prop change.
  const [prevRows, setPrevRows] = useState(rows);
  if (rows !== prevRows) {
    setPrevRows(rows);
    if (page !== 1) setPage(1);
  }

  useEffect(() => {
    if (!colMenuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setColMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [colMenuOpen]);

  function toggleColumn(key: string) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      if (storageKey) window.localStorage.setItem(`dt-hidden:${storageKey}`, JSON.stringify([...next]));
      return next;
    });
  }

  const visibleColumns = columns.filter((c) => !hidden.has(c.key));

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
      const av = col.sortValue!(a);
      const bv = col.sortValue!(b);
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return copy;
  }, [rows, sortKey, sortDir, columns]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize);

  function handleSort(col: DataTableColumn<T>) {
    if (!col.sortValue) return;
    if (sortKey === col.key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(col.key); setSortDir('asc'); }
  }

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = prev.size === pageRows.length ? new Set<string>() : new Set(pageRows.map(rowKey));
      onSelectionChange?.(rows.filter((r) => next.has(rowKey(r))));
      return next;
    });
  }

  function toggleRow(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      onSelectionChange?.(rows.filter((r) => next.has(rowKey(r))));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    onSelectionChange?.([]);
  }

  const selectedRows = rows.filter((r) => selected.has(rowKey(r)));

  if (loading) return <TableSkeleton />;

  if (rows.length === 0) {
    return <div className="card"><EmptyState title={emptyTitle} description={emptyDescription} /></div>;
  }

  return (
    <div>
      <div className="table-toolbar">
        <div className="sub">{rows.length} {rows.length === 1 ? 'result' : 'results'}</div>
        <div className="actions">
          {selectable && selected.size > 0 && renderBulkActions?.(selectedRows, clearSelection)}
          <div className="dropdown" ref={colMenuRef}>
            <button type="button" className="btn ghost sm" onClick={() => setColMenuOpen((o) => !o)}>
              ⚙ Columns
            </button>
            {colMenuOpen && (
              <div className="dropdown-menu">
                {columns.filter((c) => c.hideable !== false).map((c) => (
                  <label key={c.key} className="dropdown-item" style={{ cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={!hidden.has(c.key)}
                      onChange={() => toggleColumn(c.key)}
                      style={{ width: 'auto' }}
                    />
                    {c.header}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="tablecard" style={{ maxHeight }}>
        <table>
          <thead>
            <tr>
              {selectable && (
                <th className="checkbox-cell">
                  <input
                    type="checkbox"
                    checked={pageRows.length > 0 && selected.size === pageRows.length}
                    onChange={toggleSelectAll}
                    aria-label="Select all rows on this page"
                  />
                </th>
              )}
              {visibleColumns.map((c) => (
                <th
                  key={c.key}
                  style={{ width: c.width, cursor: c.sortValue ? 'pointer' : undefined, userSelect: 'none' }}
                  onClick={() => handleSort(c)}
                >
                  {c.header}
                  {sortKey === c.key && (sortDir === 'asc' ? ' ▲' : ' ▼')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row) => {
              const id = rowKey(row);
              return (
                <tr key={id} onClick={() => onRowClick?.(row)} style={onRowClick ? { cursor: 'pointer' } : undefined}>
                  {selectable && (
                    <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(id)} onChange={() => toggleRow(id)} aria-label="Select row" />
                    </td>
                  )}
                  {visibleColumns.map((c) => <td key={c.key}>{c.render(row)}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} type="button">‹ Prev</button>
          <span className="sub" style={{ margin: '0 8px' }}>Page {page} of {totalPages}</span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} type="button">Next ›</button>
        </div>
      )}
    </div>
  );
}

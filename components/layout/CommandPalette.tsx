'use client';

import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { sectionsForRole } from './nav';
import { useSession } from './SessionProvider';

export default function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { role } = useSession();
  const items = sectionsForRole(role).flatMap((s) => s.items);

  function go(href: string) {
    router.push(href);
    onClose();
  }

  return (
    <Command.Dialog open={open} onOpenChange={(o) => !o && onClose()} label="Command menu">
      <Command.Input placeholder="Type a command or search…" />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>
        <Command.Group heading="Navigate">
          {items.map((a) => (
            <Command.Item key={a.href} value={`${a.label} ${a.keywords ?? ''}`} onSelect={() => go(a.href)}>
              <a.icon size={15} />
              {a.label}
            </Command.Item>
          ))}
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

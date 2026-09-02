/**
 * Renders a <script> that runs synchronously during HTML parsing (before hydration) without
 * triggering React's dev-mode "script tag rendered" warning — per Next.js 16's documented pattern
 * (see node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md).
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

import Button from './Button';

/**
 * Never renders the raw technical error — callers pass a plain-language message; the actual
 * exception/stack is expected to already be console.error'd server-side by the API route.
 */
export default function ErrorState({
  title = 'Something went wrong',
  description = "We couldn't load this data.",
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="state-block">
      <div className="state-icon" aria-hidden>⚠️</div>
      <div className="state-title">{title}</div>
      <div className="state-desc">{description}</div>
      {onRetry && (
        <div className="state-actions">
          <Button size="sm" onClick={onRetry}>Try Again</Button>
        </div>
      )}
    </div>
  );
}

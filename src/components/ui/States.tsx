import { Button } from "./Button";

type Props = { title: string; body?: string; action?: { href: string; label: string }; secondary?: { href: string; label: string }; compact?: boolean };

/** Empty, error and unavailable states share one editorial layout. */
export function StateMessage({ title, body, action, secondary, compact }: Props) {
  return (
    <div className={compact ? "py-10" : "py-24 sm:py-32"}>
      <div className="thread-v mb-6 h-10 w-px" aria-hidden />
      <h2 className="text-h3 max-w-xl">{title}</h2>
      {body && <p className="mt-4 max-w-prose text-body text-ink-2">{body}</p>}
      {(action || secondary) && (
        <div className="mt-8 flex flex-wrap items-center gap-5">
          {action && <Button href={action.href}>{action.label}</Button>}
          {secondary && <Button href={secondary.href} variant="text">{secondary.label}</Button>}
        </div>
      )}
    </div>
  );
}

export function EmptyState(props: Props) {
  return <StateMessage {...props} />;
}

export function ErrorState({ title = "Something went wrong", body = "That didn't work. Try again, and if it keeps happening, let me know.", action }: Partial<Props>) {
  return <StateMessage title={title} body={body} action={action} />;
}

export function LoadingBlock({ className = "h-6 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden />;
}

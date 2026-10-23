import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  href?: string;
  variant?: "primary" | "secondary" | "text";
  size?: "md" | "lg";
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className">;

const base =
  "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-quick ease-quiet focus-visible:outline-offset-4 disabled:opacity-60 disabled:pointer-events-none";

const variants = {
  // `action` is ink on the main site and the brand action blue inside the Academy (.fa-root).
  primary: "bg-action text-on-action hover:bg-action-hover rounded",
  secondary: "border border-line-strong text-ink hover:border-ink/60 hover:bg-ink/[0.03] rounded",
  text: "text-ink",
};

export function Button({ href, variant = "primary", size = "md", className, children, ...rest }: Props) {
  // Text buttons keep their editorial look but still get a 44px touch target.
  const sizing = variant === "text" ? "min-h-[44px]" : size === "lg" ? "h-14 px-7 text-[1.0625rem]" : "h-12 px-6 text-[0.9375rem]";
  const cls = cn(base, variants[variant], sizing, className);
  const inner = (
    <>
      {variant === "text" ? <span className="link-line pb-1">{children}</span> : children}
      {variant === "primary" && (
        <span aria-hidden className="thread-solid absolute inset-x-0 bottom-0 h-px origin-left scale-x-0 transition-transform duration-base ease-quiet group-hover:scale-x-100" />
      )}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button className={cls} {...rest}>
      {inner}
    </button>
  );
}

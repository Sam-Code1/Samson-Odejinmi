import { isPreview } from "@/lib/cms";

/** Shown only to an admin who has switched on preview (draft mode). Drafts are never visible to anyone else. */
export async function PreviewBanner() {
  if (!(await isPreview())) return null;
  return (
    <div role="status" className="theme-night sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-canvas px-4 py-2 text-caption text-ink-2">
      <span aria-hidden className="thread-solid h-px w-6" />
      <span>Preview mode: you&apos;re seeing draft content that isn&apos;t public yet.</span>
      {/* A plain link (not next/link) so the route handler runs and clears the preview cookie. */}
      <a href="/api/preview/exit" className="font-semibold text-ink underline underline-offset-4">Exit preview</a>
    </div>
  );
}

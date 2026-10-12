export type VideoProvider = "none" | "youtube" | "bunny" | "mux" | "cloudflare";

/**
 * Provider-agnostic, VIEW-ONLY player.
 *
 * - Lessons store (provider, opaque id). Adding a provider means adding one entry to `embeds`.
 * - YouTube is temporary infrastructure and uses the privacy-enhanced domain.
 * - The id/URL is never shown in the UI. There is no download, share, copy-link or "Watch on YouTube" control here.
 * - The iframe is sandboxed WITHOUT popups/top-navigation, so YouTube's own logo/title links cannot open YouTube.
 * - This reduces casual copying; it is NOT DRM. A learner who can watch can still screen-record.
 */
const embeds: Partial<Record<VideoProvider, (id: string) => string | null>> = {
  youtube: (id) => (/^[A-Za-z0-9_-]{11}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&cc_load_policy=0&fs=1` : null),
};

export function VideoPlayer({ provider, id, title, enabled = true }: { provider: VideoProvider; id?: string | null; title: string; enabled?: boolean }) {
  const src = enabled && provider !== "none" && id ? embeds[provider]?.(id) ?? null : null;
  const unsupported = enabled && provider !== "none" && !embeds[provider];

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-line bg-surface">
      {src ? (
        <iframe
          src={src}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-presentation"
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full border-0"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <span aria-hidden className="thread-v h-8 w-px" />
          <p className="text-h4">{unsupported ? "This video isn't available yet" : "Video coming soon"}</p>
          <p className="max-w-xs text-body-sm text-ink-3">{unsupported ? "The video provider for this lesson isn't connected yet." : "This lesson's video hasn't been added yet."}</p>
        </div>
      )}
    </div>
  );
}

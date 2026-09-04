import { cn } from "@/lib/utils";

export function VideoFrame({
  src,
  poster,
  caption,
  className,
  overlay,
}: {
  src: string;
  poster?: string;
  caption?: string;
  className?: string;
  overlay?: React.ReactNode;
}) {
  return (
    <figure className={cn("relative overflow-hidden rounded-xl border border-border bg-black shadow-[var(--shadow-panel)]", className)}>
      <video
        className="aspect-video h-full w-full object-cover"
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
      />
      {overlay ? <div className="pointer-events-none absolute inset-0">{overlay}</div> : null}
      {caption ? (
        <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 py-3 text-sm text-fg">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

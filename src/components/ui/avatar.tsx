export function Avatar({
  src,
  name,
  size = "md",
  decorative = false,
}: {
  src: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  decorative?: boolean;
}) {
  const sizes = {
    sm: "size-10 text-sm",
    md: "size-14 text-lg",
    lg: "size-24 text-3xl",
  };
  const pixels = { sm: 40, md: 56, lg: 96 };
  const className = `${sizes[size]} border-strong bg-surface-raised inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-bold`;
  return src ? (
    // Public avatar derivatives are already trusted, cropped, and immutable.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`${className} object-cover`}
      src={src}
      width={pixels[size]}
      height={pixels[size]}
      alt={decorative ? "" : `${name}'s avatar`}
    />
  ) : (
    <span
      className={className}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : `${name}'s initials`}
    >
      {name.trim().slice(0, 1).toUpperCase() || "J"}
    </span>
  );
}

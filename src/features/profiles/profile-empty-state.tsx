import type { IconType } from "react-icons";

export function ProfileEmptyState({
  Icon,
  title,
  message,
}: {
  Icon: IconType;
  title: string;
  message: string;
}) {
  return (
    <div className="dash-card rounded-card border-subtle flex min-h-48 flex-col items-start justify-center border border-dashed p-5 sm:p-6">
      <span
        aria-hidden="true"
        className="border-subtle bg-surface/70 text-muted grid size-10 place-items-center rounded-full border text-lg"
      >
        <Icon />
      </span>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="text-muted mt-2 max-w-[38ch] text-sm leading-relaxed">
        {message}
      </p>
    </div>
  );
}

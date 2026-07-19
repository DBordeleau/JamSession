"use client";

import Link from "next/link";
import { useState, type ComponentProps } from "react";

export type IntentPrefetchLinkProps = Omit<
  ComponentProps<typeof Link>,
  "prefetch"
>;

export function IntentPrefetchLink({
  onFocus,
  onMouseEnter,
  onPointerEnter,
  ...props
}: IntentPrefetchLinkProps) {
  const [intent, setIntent] = useState(false);

  return (
    <Link
      {...props}
      prefetch={intent ? null : false}
      onFocus={(event) => {
        onFocus?.(event);
        setIntent(true);
      }}
      onMouseEnter={(event) => {
        onMouseEnter?.(event);
        setIntent(true);
      }}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        setIntent(true);
      }}
    />
  );
}

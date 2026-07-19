import type { IconType } from "react-icons";
import { FiAward, FiHeart, FiStar } from "react-icons/fi";
import { z } from "zod";

const presentationCodeSchema = z.enum(["trophy", "favorite", "placement"]);

export type CatalogPresentation = {
  Icon: IconType;
  iconClassName: string;
  frameClassName: string;
};

const presentations: Record<
  z.infer<typeof presentationCodeSchema>,
  CatalogPresentation
> = {
  trophy: {
    Icon: FiAward,
    iconClassName: "text-accent-2",
    frameClassName: "border-accent-2 bg-surface-raised",
  },
  favorite: {
    Icon: FiHeart,
    iconClassName: "text-accent",
    frameClassName: "border-accent bg-surface-raised",
  },
  placement: {
    Icon: FiStar,
    iconClassName: "text-accent-2",
    frameClassName: "border-subtle bg-surface-soft",
  },
};

export function getCatalogPresentation(
  input: unknown,
): CatalogPresentation | null {
  const parsed = presentationCodeSchema.safeParse(input);
  return parsed.success ? presentations[parsed.data] : null;
}

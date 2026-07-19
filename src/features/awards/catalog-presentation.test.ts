import { describe, expect, it } from "vitest";
import { getCatalogPresentation } from "./catalog-presentation";

describe("badge catalog presentation", () => {
  it.each(["trophy", "favorite", "placement"])(
    "maps the bounded %s presentation",
    (code) => {
      const presentation = getCatalogPresentation(code);
      expect(presentation?.Icon).toBeTypeOf("function");
      expect(presentation?.iconClassName).toMatch(/^text-/);
      expect(presentation?.frameClassName).toContain("border-");
    },
  );

  it.each(["crown", "<svg />", { code: "trophy" }, null])(
    "fails closed for malformed catalog data",
    (value) => expect(getCatalogPresentation(value)).toBeNull(),
  );
});

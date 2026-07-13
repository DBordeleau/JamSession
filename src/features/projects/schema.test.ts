import { describe, expect, it } from "vitest";
import { projectInputSchema } from "./schema";

const valid = {
  title: "New song",
  description: "",
  bpm: "120.125",
  musicalKey: "c-major",
  timeSignatureNumerator: "4",
  timeSignatureDenominator: "4",
  licenseCode: "all-rights-reserved",
  genreIds: [],
  primaryGenreId: "",
  tagIds: [],
};
describe("projectInputSchema", () => {
  it("normalizes optional values", () =>
    expect(projectInputSchema.parse({ ...valid, bpm: "" })).toMatchObject({
      description: null,
      bpm: null,
      primaryGenreId: null,
    }));
  it("rejects exponent BPM and excess precision", () => {
    expect(projectInputSchema.safeParse({ ...valid, bpm: "1e2" }).success).toBe(
      false,
    );
    expect(
      projectInputSchema.safeParse({ ...valid, bpm: "120.1234" }).success,
    ).toBe(false);
  });
  it("requires the primary genre to be selected", () =>
    expect(
      projectInputSchema.safeParse({
        ...valid,
        primaryGenreId: "10000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false));
});

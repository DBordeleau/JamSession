import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Container } from "@/components/layout/container";
import { MidiLibraryListingManager } from "@/features/midi-library/listing-manager.client";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  listMidiLibraryOptions,
  listOwnedMidiLibraryVersions,
} from "@/server/repositories/midi-library";

export const metadata: Metadata = {
  title: "List MIDI",
  description:
    "Explicitly list one exact MIDI pattern version with a rights attestation.",
};
export default async function ManageMidiLibraryPage() {
  const db = await createSupabaseServerClient();
  const { data, error } = await db.auth.getClaims();
  if (error || !data?.claims?.sub)
    redirect("/sign-in?next=%2Flibrary%2Fmanage");
  const [versions, options] = await Promise.all([
    listOwnedMidiLibraryVersions(),
    listMidiLibraryOptions(),
  ]);
  return (
    <main id="main-content">
      <Container className="py-14 sm:py-20">
        <header className="max-w-3xl">
          <p className="text-accent-2 font-mono text-xs tracking-[.2em] uppercase">
            Creator listing
          </p>
          <h1 className="mt-4 text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Share one exact version, with the{" "}
            <em className="text-accent font-serif font-medium">rights</em> made
            clear.
          </h1>
          <p className="text-muted mt-5 text-lg">
            Library publication is always explicit. Covers, recreations, and
            uncertain-rights material stay private—even when marked
            reference-only.
          </p>
        </header>
        <div className="mt-10">
          <MidiLibraryListingManager versions={versions} options={options} />
        </div>
      </Container>
    </main>
  );
}

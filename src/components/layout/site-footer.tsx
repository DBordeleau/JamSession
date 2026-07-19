import Link from "next/link";
import { AuthAwareLink } from "@/features/auth/auth-aware-link.client";
import { Container } from "./container";

export function SiteFooter() {
  return (
    <footer className="border-subtle border-t py-8">
      <Container className="text-muted flex flex-col gap-4 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p>
          <span className="text-ink font-semibold">OpenMIDI</span> — make music
          with the right people.
        </p>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2">
          <Link className="hover:text-ink" href="/" prefetch={false}>
            Home
          </Link>
          <Link className="hover:text-ink" href="/explore" prefetch={false}>
            Explore
          </Link>
          <Link className="hover:text-ink" href="/challenges" prefetch={false}>
            Challenges
          </Link>
          <Link className="hover:text-ink" href="/projects" prefetch={false}>
            My projects
          </Link>
          <Link
            className="hover:text-ink"
            href="/projects/new"
            prefetch={false}
          >
            New project
          </Link>
          <Link
            className="hover:text-ink"
            href="/contributions"
            prefetch={false}
          >
            Contributions
          </Link>
          <Link
            className="hover:text-ink"
            href="/community-rules"
            prefetch={false}
          >
            Community rules
          </Link>
          <Link className="hover:text-ink" href="/reports" prefetch={false}>
            Reports
          </Link>
          <AuthAwareLink
            signedOut={{ href: "/sign-in", label: "Sign in" }}
            signedIn={{ href: "/settings/profile", label: "Account" }}
            className="hover:text-ink"
            prefetch={false}
          />
        </nav>
      </Container>
    </footer>
  );
}

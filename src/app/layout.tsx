import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Aurora } from "@/components/layout/aurora.client";
import { ConditionalFooter } from "@/components/layout/conditional-footer.client";
import { ConditionalHeader } from "@/components/layout/conditional-header.client";
import { ConditionalMobileNav } from "@/components/layout/conditional-mobile-nav.client";
import { SkipLink } from "@/components/layout/skip-link";
import { ViewerIdentityProvider } from "@/components/layout/viewer-identity-provider.client";
import { DetailNavigationPresentation } from "@/features/discovery/detail-navigation-presentation.client";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "OpenMIDI",
    template: "%s | OpenMIDI",
  },
  description:
    "OpenMIDI is where MIDI ideas become shared arrangements, with every contributor credited.",
};

export default function RootLayout({
  children,
  modal,
}: Readonly<{ children: ReactNode; modal: ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      {/* dvh, not vh: mobile browser chrome expands and collapses, and the
          fixed tab bar has to sit against the real bottom of the viewport. */}
      <body className="min-h-dvh">
        <Aurora />
        <ViewerIdentityProvider>
          <div data-app-shell className="relative z-10 flex min-h-dvh flex-col">
            <SkipLink />
            <ConditionalHeader />
            <div className="flex-1">{children}</div>
            <ConditionalFooter />
            <ConditionalMobileNav />
            <DetailNavigationPresentation />
          </div>
          {/* The route template fades every parallel route through opacity,
              which temporarily creates its own stacking context. Give that
              entire context permanent root-level authority above the app
              shell so intercepted overlays cannot begin behind landing
              animations and then snap forward when the fade completes. */}
          <div data-intercepted-overlay-root className="relative z-50">
            {modal}
          </div>
        </ViewerIdentityProvider>
      </body>
    </html>
  );
}

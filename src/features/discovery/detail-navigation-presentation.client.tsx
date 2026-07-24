"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import { PublicProjectDetailLoading } from "@/features/discovery/public-project-detail-loading";
import { MidiLibraryDetailLoading } from "@/features/midi-library/midi-library-detail-loading";

type DetailKind = "project" | "pattern";
type PendingDetail = {
  kind: DetailKind;
  fromPathname: string;
  toPathname: string;
};

const PROJECT_DETAIL_PATH =
  /^\/projects\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PATTERN_DETAIL_PATH =
  /^\/library\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function DetailNavigationPresentation() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingDetail, setPendingDetail] = useState<PendingDetail | null>(
    null,
  );

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (pathname.startsWith("/studio")) return;
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target =
        event.target instanceof Element ? event.target.closest("a") : null;
      if (
        !target ||
        target.target === "_blank" ||
        target.hasAttribute("download")
      ) {
        return;
      }
      const destination = new URL(target.href, window.location.href);
      if (destination.origin !== window.location.origin) return;
      if (destination.pathname === pathname) return;
      let nextDetail: DetailKind | null = null;
      if (PROJECT_DETAIL_PATH.test(destination.pathname)) {
        nextDetail = "project";
      } else if (PATTERN_DETAIL_PATH.test(destination.pathname)) {
        nextDetail = "pattern";
      }
      if (!nextDetail) {
        setPendingDetail(null);
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      flushSync(() =>
        setPendingDetail({
          kind: nextDetail,
          fromPathname: pathname,
          toPathname: destination.pathname,
        }),
      );
      window.requestAnimationFrame(() => {
        router.push(
          `${destination.pathname}${destination.search}${destination.hash}`,
        );
      });
    };
    document.documentElement.dataset.detailNavigationReady = "true";
    document.addEventListener("click", handleClick, true);
    return () => {
      delete document.documentElement.dataset.detailNavigationReady;
      document.removeEventListener("click", handleClick, true);
    };
  }, [pathname, router]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setPendingDetail((current) =>
        current && pathname !== current.fromPathname ? null : current,
      );
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (!pendingDetail) return;
    const timeout = window.setTimeout(() => setPendingDetail(null), 15_000);
    return () => window.clearTimeout(timeout);
  }, [pendingDetail]);

  const detailKind =
    pendingDetail?.fromPathname === pathname ? pendingDetail.kind : null;
  if (!detailKind) return null;
  return (
    <div
      className="bg-canvas fixed inset-0 isolate z-50 overflow-y-auto overscroll-contain"
      data-detail-navigation-overlay={pendingDetail?.toPathname}
    >
      {detailKind === "project" ? (
        <PublicProjectDetailLoading overlay />
      ) : (
        <MidiLibraryDetailLoading overlay />
      )}
    </div>
  );
}

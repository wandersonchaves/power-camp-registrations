"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type EnrollmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

type EnrollmentStatusResponse = {
  enrollment?: { status?: EnrollmentStatus | null } | null;
  initialPayment?: { paidAt?: string | null } | null;
};

export function AutoRefreshPayment({
  enrollmentId,
  enabled,
  intervalMs = 4000,
  maxMs = 60_000,
}: {
  enrollmentId: string;
  enabled: boolean;
  intervalMs?: number;
  maxMs?: number;
}) {
  const router = useRouter();

  React.useEffect(() => {
    if (!enabled) return;

    let stopped = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();

    async function tick() {
      if (stopped) return;

      try {
        const res = await fetch(`/api/enrollments/${enrollmentId}/status`, {
          cache: "no-store",
        });

        if (res.ok) {
          const data: EnrollmentStatusResponse =
            (await res.json()) as EnrollmentStatusResponse;

          const paidAt = data?.initialPayment?.paidAt ?? null;
          const status = data?.enrollment?.status ?? null;

          if (paidAt || status === "CONFIRMED") {
            router.refresh();
            stopped = true;
            return;
          }
        }
      } catch {
        // ignora falhas temporárias de rede
      }

      if (Date.now() - startedAt < maxMs) {
        timeoutId = setTimeout(tick, intervalMs);
      }
    }

    timeoutId = setTimeout(tick, 800);

    return () => {
      stopped = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [enabled, enrollmentId, intervalMs, maxMs, router]);

  return null;
}

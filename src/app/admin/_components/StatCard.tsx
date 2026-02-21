import type { ReactNode } from "react";

export function StatCard(props: {
  title: string;
  value: string;
  subtitle?: string;
  right?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-gray-600">{props.title}</div>
          <div className="mt-2 text-2xl font-semibold">{props.value}</div>
          {props.subtitle ? (
            <div className="mt-1 text-xs text-gray-600">{props.subtitle}</div>
          ) : null}
        </div>
        {props.right ? <div className="pt-1">{props.right}</div> : null}
      </div>
    </div>
  );
}

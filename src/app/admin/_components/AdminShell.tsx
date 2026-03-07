import type { ReactNode } from "react";
import Link from "next/link";

export function AdminShell(props: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-gray-900" />
            <div>
              <div className="text-sm font-semibold">PowerCamp 2027</div>
              <div className="text-xs text-gray-600">Admin</div>
            </div>
          </div>

          <nav className="flex items-center gap-4 text-sm">
            <Link
              className="text-gray-700 hover:text-gray-900"
              href="/admin/race"
            >
              Placar
            </Link>
            <Link
              className="text-gray-700 hover:text-gray-900"
              href="/admin/participants"
            >
              Participantes
            </Link>
            <Link
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-blue-50 hover:text-gray-900"
              href="/admin/teams/AGUIA"
            >
              <span className="text-lg">🦅</span> Águia
            </Link>
            <Link
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium text-gray-700 transition-colors hover:bg-red-50 hover:text-gray-900"
              href="/admin/teams/LEAO"
            >
              <span className="text-lg">🦁</span> Leão
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{props.children}</main>
    </div>
  );
}

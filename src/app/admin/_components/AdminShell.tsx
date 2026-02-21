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
              className="text-gray-700 hover:text-gray-900"
              href="/admin/teams/AGUIA"
            >
              Águia
            </Link>
            <Link
              className="text-gray-700 hover:text-gray-900"
              href="/admin/teams/LEAO"
            >
              Leão
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{props.children}</main>
    </div>
  );
}

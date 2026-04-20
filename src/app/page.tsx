import { ArrowRight, Trophy, Users, Zap } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/auth-options";
import { PublicShell } from "@/components/layouts/PublicShell";
import { Button } from "@/components/ui/button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role === "ADMIN") {
    redirect("/admin/race");
  }

  return (
    <PublicShell>
      <main className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1.5 text-sm font-bold text-blue-600">
          <Zap className="size-4" />
          PowerCamp 2025
        </div>

        <h1 className="mb-6 max-w-3xl text-5xl font-black tracking-tight md:text-7xl">
          Acelere sua <span className="text-blue-600">Equipe</span> rumo ao
          topo.
        </h1>

        <p className="mb-10 max-w-2xl text-xl leading-relaxed text-gray-600">
          O portal definitivo para inscrições e acompanhamento em tempo real da
          corrida de performance entre equipes.
        </p>

        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-14 rounded-2xl px-8 text-lg font-bold shadow-xl shadow-blue-100 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Link href="/enroll" className="flex items-center gap-2">
              Quero me Inscrever <ArrowRight className="size-5" />
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            size="lg"
            className="h-14 rounded-2xl border-2 px-8 text-lg font-bold transition-all hover:bg-gray-50"
          >
            <Link href="/admin/race">Painel de Controle</Link>
          </Button>
        </div>

        <div className="mt-24 grid w-full max-w-6xl grid-cols-1 gap-8 md:grid-cols-3">
          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-left shadow-sm">
            <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-blue-50">
              <Trophy className="size-6 text-blue-600" />
            </div>
            <h3 className="mb-3 text-xl font-bold">Corrida dos 50</h3>
            <p className="text-gray-600">
              Acompanhe qual equipe atinge primeiro o marco de 50 inscrições
              confirmadas.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-left shadow-sm">
            <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-amber-50">
              <Zap className="size-6 text-amber-600" />
            </div>
            <h3 className="mb-3 text-xl font-bold">PIX Automático</h3>
            <p className="text-gray-600">
              Pagamentos simplificados e recorrentes via EFI, com total
              transparência e segurança.
            </p>
          </div>

          <div className="rounded-3xl border border-gray-100 bg-white p-8 text-left shadow-sm">
            <div className="mb-6 flex size-12 items-center justify-center rounded-2xl bg-green-50">
              <Users className="size-6 text-green-600" />
            </div>
            <h3 className="mb-3 text-xl font-bold">Gestão de Equipes</h3>
            <p className="text-gray-600">
              Liderança estratégica para Águia e Leão, com controle total sobre
              as inscrições.
            </p>
          </div>
        </div>
      </main>
    </PublicShell>
  );
}

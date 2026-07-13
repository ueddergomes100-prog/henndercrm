import { SupabaseRestClient } from "@/infrastructure/supabase/supabase-rest-client";

export const dynamic = "force-dynamic";

type SyncRow = {
  id: string;
  origem: string;
  status: "iniciada" | "concluida" | "erro";
  inicio: string;
  fim: string | null;
  total_lidos: number;
  total_importados: number;
  total_ignorados: number;
  erro: string | null;
};
type IgnoredSaleRow = {
  id: string;
  uniplus_venda_id: number | null;
  motivo: string;
  dados: unknown;
  created_at: string;
};
type SaleRow = {
  id: string;
  uniplus_id: number;
  data_venda: string;
  updated_at: string;
};

export async function GET() {
  const client = new SupabaseRestClient();
  const { from, to } = todayWindow();
  const { today, tomorrow } = todayDateWindow();

  try {
    const [syncRows, recentSyncRows, ignoredSales, todaySales, latestSales] = await Promise.all([
      client.select<SyncRow>("crm_sincronizacoes", {
        select: "id,origem,status,inicio,fim,total_lidos,total_importados,total_ignorados,erro",
        inicio: `gte.${from}`,
        order: "inicio.desc",
      }),
      client.select<SyncRow>("crm_sincronizacoes", {
        select: "id,origem,status,inicio,fim,total_lidos,total_importados,total_ignorados,erro",
        origem: "eq.uniplus",
        order: "inicio.desc",
        limit: 7,
      }),
      client.select<IgnoredSaleRow>("crm_vendas_ignoradas", {
        select: "id,uniplus_venda_id,motivo,dados,created_at",
        created_at: `gte.${from}`,
        order: "created_at.desc",
      }),
      client.select<SaleRow>("crm_vendas", {
        select: "id,uniplus_id,data_venda,updated_at",
        and: `(data_venda.gte.${today},data_venda.lt.${tomorrow})`,
        order: "updated_at.desc",
      }),
      client.select<SaleRow>("crm_vendas", {
        select: "id,uniplus_id,data_venda,updated_at",
        order: "data_venda.desc,uniplus_id.desc",
        limit: 1,
      }),
    ]);

    const todaySyncRows = syncRows.filter((row) => row.inicio < to);
    const todayIgnoredSales = ignoredSales.filter((row) => row.created_at < to);
    const latest = todaySyncRows[0] ?? null;
    const errored = todaySyncRows.filter((row) => row.status === "erro");
    const completed = todaySyncRows.filter((row) => row.status === "concluida");
    const totals = completed.reduce(
      (accumulator, row) => ({
        read: accumulator.read + row.total_lidos,
        imported: accumulator.imported + row.total_importados,
        ignored: accumulator.ignored + row.total_ignorados,
      }),
      { read: 0, imported: 0, ignored: 0 },
    );

    return Response.json({
      date: from.slice(0, 10),
      window: { from, to },
      latest,
      summary: {
        status: resolveDailyStatus(latest, errored.length, todayIgnoredSales.length),
        runs: todaySyncRows.length,
        completedRuns: completed.length,
        errorRuns: errored.length,
        read: totals.read,
        imported: totals.imported,
        ignored: totals.ignored,
      },
      sales: {
        todayImported: todaySales.length,
        todayLatest:
          todaySales
            .slice()
            .sort((left, right) => right.uniplus_id - left.uniplus_id)[0] ?? null,
        latest: latestSales[0] ?? null,
      },
      recentRuns: recentSyncRows,
      errors: [
        ...errored.map((row) => ({
          id: row.id,
          type: "sync_error",
          at: row.fim ?? row.inicio,
          saleId: null,
          reason: "falha_execucao",
          message: row.erro ?? "Falha nao informada.",
        })),
        ...todayIgnoredSales.map((row) => ({
          id: row.id,
          type: "ignored_sale",
          at: row.created_at,
          saleId: row.uniplus_venda_id,
          reason: row.motivo,
          message: describeIgnoredSale(row),
        })),
      ],
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao carregar logs de sincronizacao.",
      },
      { status: 500 },
    );
  }
}

function todayWindow() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
}

function todayDateWindow() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return {
    today: formatDateOnly(today),
    tomorrow: formatDateOnly(tomorrow),
  };
}

function formatDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function resolveDailyStatus(
  latest: SyncRow | null,
  errorRuns: number,
  ignoredSales: number,
) {
  if (errorRuns > 0) return "erro";
  if (ignoredSales > 0) return "atencao";
  if (latest?.status === "concluida") return "ok";
  if (latest?.status === "iniciada") return "em_execucao";
  return "sem_execucao";
}

function describeIgnoredSale(row: IgnoredSaleRow) {
  const sale = row.uniplus_venda_id ? `Venda ${row.uniplus_venda_id}` : "Venda sem ID";
  return `${sale}: ${row.motivo}`;
}

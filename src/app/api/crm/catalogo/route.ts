import { cookies } from "next/headers";
import { SupabaseRestClient } from "@/infrastructure/supabase/supabase-rest-client";
import { buildCatalogSearchFilter } from "@/lib/catalog-search";
import { CRM_SESSION_COOKIE, readSessionToken } from "@/lib/crm-auth";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

type CatalogRow = {
  id: string;
  uniplus_id: number;
  codigo: string | null;
  nome: string;
  estoque: number | string | null;
  preco_venda: number | string | null;
  inativo: boolean;
  sincronizado_em: string;
};

type LegacyProductRow = {
  id: string;
  uniplus_id: number;
  codigo: string | null;
  nome: string;
  preco: number | string | null;
};

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const user = readSessionToken(cookieStore.get(CRM_SESSION_COOKIE)?.value);
  if (!user) return Response.json({ error: "Sessao expirada." }, { status: 401 });

  const url = new URL(request.url);
  const page = positiveInteger(url.searchParams.get("page"), 1);
  const pageSize = Math.min(
    positiveInteger(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const search = url.searchParams.get("q")?.trim() ?? "";
  const offset = (page - 1) * pageSize;
  const client = new SupabaseRestClient();

  try {
    const searchFilter = buildCatalogSearchFilter(search);
    const result = await client.selectPage<CatalogRow>("crm_catalogo_produtos", {
      select: "id,uniplus_id,codigo,nome,estoque,preco_venda,inativo,sincronizado_em",
      order: "nome.asc",
      limit: pageSize,
      offset,
      ...(searchFilter ? { and: searchFilter } : {}),
    });

    return Response.json({
      items: result.data.map(mapCatalogRow),
      page,
      pageSize,
      total: result.total,
      totalPages: Math.max(1, Math.ceil(result.total / pageSize)),
      catalogComplete: true,
      syncedAt: result.data[0]?.sincronizado_em ?? null,
    });
  } catch (error) {
    if (!isMissingCatalogTable(error)) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Falha ao consultar o catalogo." },
        { status: 500 },
      );
    }

    // Keeps the route usable before the catalog migration reaches an environment.
    const legacyFilter = buildCatalogSearchFilter(search, "nome");
    const fallback = await client.selectPage<LegacyProductRow>("crm_produtos", {
      select: "id,uniplus_id,codigo,nome,preco",
      order: "nome.asc",
      limit: pageSize,
      offset,
      ...(legacyFilter ? { and: legacyFilter } : {}),
    });

    return Response.json({
      items: fallback.data.map((row) => ({
        id: row.id,
        uniplusId: row.uniplus_id,
        code: row.codigo ?? "",
        name: row.nome,
        stock: null,
        salePrice: nullableNumber(row.preco),
        inactive: false,
      })),
      page,
      pageSize,
      total: fallback.total,
      totalPages: Math.max(1, Math.ceil(fallback.total / pageSize)),
      catalogComplete: false,
      syncedAt: null,
    });
  }
}

function mapCatalogRow(row: CatalogRow) {
  return {
    id: row.id,
    uniplusId: row.uniplus_id,
    code: row.codigo ?? "",
    name: row.nome,
    stock: nullableNumber(row.estoque),
    salePrice: nullableNumber(row.preco_venda),
    inactive: row.inativo,
  };
}

function nullableNumber(value: number | string | null) {
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function positiveInteger(value: string | null, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isMissingCatalogTable(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("crm_catalogo_produtos") && (
    message.includes("PGRST205") ||
    message.includes("42P01") ||
    message.toLocaleLowerCase("pt-BR").includes("not find")
  );
}

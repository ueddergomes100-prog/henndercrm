"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  LoaderCircle,
  PackageSearch,
  Search,
  X,
} from "lucide-react";

const PAGE_SIZE = 20;

type CatalogItem = {
  id: string;
  uniplusId: number;
  code: string;
  name: string;
  stock: number | null;
  salePrice: number | null;
  inactive: boolean;
};

type CatalogResponse = {
  items: CatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  catalogComplete: boolean;
  syncedAt: string | null;
  error?: string;
};

export default function CatalogClient() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [page, setPage] = useState(1);
  const requestKey = `${page}:${debouncedQuery}`;
  const [requestState, setRequestState] = useState<{
    key: string;
    result: CatalogResponse | null;
    error: string;
  }>({ key: "", result: null, error: "" });
  const result = requestState.result;
  const loading = requestState.key !== requestKey;
  const error = requestState.key === requestKey ? requestState.error : "";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(PAGE_SIZE),
      ...(debouncedQuery ? { q: debouncedQuery } : {}),
    });

    fetch(`/api/crm/catalogo?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as CatalogResponse;
        if (!response.ok) throw new Error(body.error || "Nao foi possivel consultar o catalogo.");
        return body;
      })
      .then((response) => setRequestState({ key: requestKey, result: response, error: "" }))
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setRequestState((current) => ({
          key: requestKey,
          result: current.result,
          error: requestError instanceof Error ? requestError.message : "Falha ao consultar o catalogo.",
        }));
      });

    return () => controller.abort();
  }, [debouncedQuery, page, requestKey]);

  const range = useMemo(() => {
    if (!result?.total) return "0 itens";
    const from = (result.page - 1) * result.pageSize + 1;
    const to = Math.min(result.page * result.pageSize, result.total);
    return `${from}-${to} de ${result.total.toLocaleString("pt-BR")} itens`;
  }, [result]);

  return (
    <main className="min-h-screen bg-[#f6f7fb] text-[#181227]">
      <header className="border-b border-[#e7e2ef] bg-white">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/"
              aria-label="Voltar ao CRM"
              title="Voltar ao CRM"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#ded7ea] text-[#541ea6] transition hover:bg-[#f5f0fe]"
            >
              <ArrowLeft size={19} />
            </Link>
            <Image
              src="/brand/hennder-lockup.png"
              alt="Hennder Company"
              width={154}
              height={42}
              priority
              className="h-9 w-auto object-contain"
            />
          </div>
          <p className="truncate text-sm font-semibold text-[#6f6788]">Consulta pública</p>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col gap-5 border-b border-[#ded7ea] pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-black uppercase text-[#7a35e8]">Uniplus</p>
            <h1 className="mt-1 text-2xl font-black text-[#181227] sm:text-3xl">Catálogo de estoque</h1>
            <p className="mt-2 text-sm text-[#6f6788]">Estoque atual e preço de venda sincronizados.</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-[#6f6788]">
            <PackageSearch size={18} className="text-[#7a35e8]" />
            <span className="font-semibold">{result?.total?.toLocaleString("pt-BR") ?? "-"} produtos</span>
          </div>
        </div>

        <section className="py-6" aria-label="Pesquisa do catálogo">
          <label htmlFor="catalog-search" className="sr-only">Buscar produto</label>
          <div className="relative max-w-2xl">
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#7a35e8]" size={20} />
            <input
              id="catalog-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ração+20kg+quatree"
              autoComplete="off"
              className="h-12 w-full rounded-lg border border-[#d8d0e5] bg-white pl-12 pr-12 text-base font-semibold text-[#181227] shadow-sm outline-none placeholder:font-normal placeholder:text-[#9b8fb5] focus:border-[#7a35e8] focus:ring-4 focus:ring-[#7a35e8]/10"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Limpar pesquisa"
                title="Limpar pesquisa"
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#6f6788] hover:bg-[#f5f0fe] hover:text-[#541ea6]"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </section>

        {!result?.catalogComplete && !loading && !error && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <CircleAlert className="mt-0.5 shrink-0" size={18} />
            <p>O catálogo completo ainda aguarda a primeira sincronização de estoque do Uniplus.</p>
          </div>
        )}

        <section className="overflow-hidden rounded-lg border border-[#e1dbea] bg-white shadow-sm" aria-busy={loading}>
          <div className="flex min-h-12 items-center justify-between gap-4 border-b border-[#ece7f3] px-4">
            <p className="text-sm font-bold text-[#4a4363]">{range}</p>
            {loading && <LoaderCircle className="animate-spin text-[#7a35e8]" size={19} />}
          </div>

          {error ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <CircleAlert size={30} className="text-red-500" />
              <p className="mt-3 font-bold text-[#181227]">Falha na consulta</p>
              <p className="mt-1 max-w-lg text-sm text-[#6f6788]">{error}</p>
            </div>
          ) : !loading && result?.items.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
              <PackageSearch size={32} className="text-[#9a68f1]" />
              <p className="mt-3 font-bold text-[#181227]">Nenhum produto encontrado</p>
            </div>
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <thead className="bg-[#faf8fe] text-xs font-black uppercase text-[#6f6788]">
                    <tr>
                      <th className="w-36 px-4 py-3">Código</th>
                      <th className="px-4 py-3">Produto</th>
                      <th className="w-36 px-4 py-3 text-right">Estoque</th>
                      <th className="w-44 px-4 py-3 text-right">Preço de venda</th>
                    </tr>
                  </thead>
                  <tbody className={loading ? "opacity-55" : undefined}>
                    {(result?.items ?? []).map((item) => (
                      <tr key={item.id} className="border-t border-[#f0edf5] hover:bg-[#faf8fe]">
                        <td className="px-4 py-3 font-mono text-xs font-bold text-[#6f6788]">{item.code || item.uniplusId}</td>
                        <td className="px-4 py-3 font-bold text-[#252935]">{item.name}</td>
                        <td className="px-4 py-3 text-right font-black text-[#252935]">{formatStock(item.stock)}</td>
                        <td className="px-4 py-3 text-right font-black text-[#541ea6]">{formatPrice(item.salePrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className={`divide-y divide-[#ece7f3] md:hidden ${loading ? "opacity-55" : ""}`}>
                {(result?.items ?? []).map((item) => (
                  <article key={item.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words font-bold text-[#252935]">{item.name}</p>
                        <p className="mt-1 font-mono text-xs font-bold text-[#7b718e]">{item.code || item.uniplusId}</p>
                      </div>
                      <p className="shrink-0 font-black text-[#541ea6]">{formatPrice(item.salePrice)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between border-t border-[#f0edf5] pt-3 text-sm">
                      <span className="text-[#6f6788]">Estoque</span>
                      <span className="font-black text-[#252935]">{formatStock(item.stock)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}

          <footer className="flex min-h-14 items-center justify-between gap-3 border-t border-[#ece7f3] px-4">
            <p className="text-sm font-bold text-[#6f6788]">Página {result?.page ?? page} de {result?.totalPages ?? 1}</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={loading || page <= 1}
                aria-label="Página anterior"
                title="Página anterior"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d0e5] text-[#541ea6] transition hover:bg-[#f5f0fe] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(result?.totalPages ?? current, current + 1))}
                disabled={loading || page >= (result?.totalPages ?? 1)}
                aria-label="Próxima página"
                title="Próxima página"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-[#d8d0e5] text-[#541ea6] transition hover:bg-[#f5f0fe] disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </footer>
        </section>
      </div>
    </main>
  );
}

function formatPrice(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatStock(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 }).format(value);
}

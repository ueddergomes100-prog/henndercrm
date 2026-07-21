import "server-only";

type QueryValue = string | number | boolean;

const DEFAULT_PAGE_SIZE = 1000;
const MAX_PARALLEL_PAGE_REQUESTS = 6;

export class SupabaseRestClient {
  constructor(
    private readonly baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    private readonly secretKey =
      process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY,
  ) {
    if (!baseUrl || !secretKey) {
      throw new Error(
        "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SECRET_KEY.",
      );
    }
  }

  async select<T>(
    table: string,
    query: Record<string, QueryValue> = {},
  ): Promise<T[]> {
    if (query.limit !== undefined) {
      return this.request<T[]>(table, { query });
    }

    const firstPage = await this.requestWithMetadata<T[]>(table, {
      query: { ...query, limit: DEFAULT_PAGE_SIZE, offset: 0 },
      prefer: "count=exact",
    });
    const totalRows = readContentRangeTotal(firstPage.headers.get("content-range"));

    if (totalRows === undefined) {
      const rows = [...firstPage.data];
      for (let offset = DEFAULT_PAGE_SIZE; firstPage.data.length === DEFAULT_PAGE_SIZE; offset += DEFAULT_PAGE_SIZE) {
        const page = await this.request<T[]>(table, {
          query: { ...query, limit: DEFAULT_PAGE_SIZE, offset },
        });
        rows.push(...page);
        if (page.length < DEFAULT_PAGE_SIZE) break;
      }
      return rows;
    }

    const offsets = Array.from(
      { length: Math.max(0, Math.ceil(totalRows / DEFAULT_PAGE_SIZE) - 1) },
      (_, index) => (index + 1) * DEFAULT_PAGE_SIZE,
    );
    const pages: T[][] = [];

    for (let index = 0; index < offsets.length; index += MAX_PARALLEL_PAGE_REQUESTS) {
      const batch = offsets.slice(index, index + MAX_PARALLEL_PAGE_REQUESTS);
      pages.push(
        ...(await Promise.all(
          batch.map((offset) =>
            this.request<T[]>(table, {
              query: { ...query, limit: DEFAULT_PAGE_SIZE, offset },
            }),
          ),
        )),
      );
    }

    return [firstPage.data, ...pages].flat();
  }

  async insert<T>(table: string, rows: unknown[], returnRepresentation = true): Promise<T[]> {
    return this.request<T[]>(table, {
      method: "POST",
      body: rows,
      prefer: returnRepresentation ? "return=representation" : "return=minimal",
    });
  }

  async upsert<T>(table: string, rows: unknown[], conflictColumn: string): Promise<T[]> {
    return this.request<T[]>(table, {
      method: "POST",
      query: { on_conflict: conflictColumn },
      body: rows,
      prefer: "resolution=merge-duplicates,return=representation",
    });
  }

  async update<T>(table: string, filters: Record<string, QueryValue>, values: unknown): Promise<T[]> {
    const query = Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [key, `eq.${value}`]),
    );
    return this.request<T[]>(table, {
      method: "PATCH",
      query,
      body: values,
      prefer: "return=representation",
    });
  }

  async delete(table: string, filters: Record<string, QueryValue>): Promise<void> {
    const query = Object.fromEntries(
      Object.entries(filters).map(([key, value]) => [key, `eq.${value}`]),
    );
    await this.request<unknown[]>(table, {
      method: "DELETE",
      query,
      prefer: "return=minimal",
    });
  }

  async deleteMany(
    table: string,
    column: string,
    values: Array<string | number>,
  ): Promise<void> {
    const batchSize = 100;
    const batches = Array.from(
      { length: Math.ceil(values.length / batchSize) },
      (_, index) => values.slice(index * batchSize, (index + 1) * batchSize),
    );
    await Promise.all(
      batches.map((batch) =>
        this.request<unknown[]>(table, {
          method: "DELETE",
          query: { [column]: `in.(${batch.join(",")})` },
          prefer: "return=minimal",
        }),
      ),
    );
  }

  private async request<T>(
    table: string,
    options: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      query?: Record<string, QueryValue>;
      body?: unknown;
      prefer?: string;
    } = {},
  ): Promise<T> {
    return (await this.requestWithMetadata<T>(table, options)).data;
  }

  private async requestWithMetadata<T>(
    table: string,
    options: {
      method?: "GET" | "POST" | "PATCH" | "DELETE";
      query?: Record<string, QueryValue>;
      body?: unknown;
      prefer?: string;
    } = {},
  ): Promise<{ data: T; headers: Headers }> {
    const url = new URL(`/rest/v1/${table}`, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        apikey: this.secretKey as string,
        ...(isJwt(this.secretKey) ? { authorization: `Bearer ${this.secretKey}` } : {}),
        "content-type": "application/json",
        ...(options.prefer ? { prefer: options.prefer } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });

    const responseText = await response.text();

    if (!response.ok) {
      const detail = responseText;
      throw new Error(`Supabase ${response.status}: ${detail}`);
    }

    if (response.status === 204 || responseText.length === 0) {
      return { data: [] as T, headers: response.headers };
    }
    return { data: JSON.parse(responseText) as T, headers: response.headers };
  }
}

function readContentRangeTotal(contentRange: string | null) {
  const total = contentRange?.match(/\/(\d+)$/)?.[1];
  if (!total) return undefined;
  const parsed = Number.parseInt(total, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isJwt(value?: string) {
  return Boolean(value && value.split(".").length === 3);
}

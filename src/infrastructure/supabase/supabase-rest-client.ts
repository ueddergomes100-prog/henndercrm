import "server-only";

type QueryValue = string | number | boolean;

export class SupabaseRestClient {
  constructor(
    private readonly baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL,
    private readonly serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY,
  ) {
    if (!baseUrl || !serviceRoleKey) {
      throw new Error(
        "Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.",
      );
    }
  }

  async select<T>(
    table: string,
    query: Record<string, QueryValue> = {},
  ): Promise<T[]> {
    return this.request<T[]>(table, { query });
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

  private async request<T>(
    table: string,
    options: {
      method?: "GET" | "POST" | "PATCH";
      query?: Record<string, QueryValue>;
      body?: unknown;
      prefer?: string;
    } = {},
  ): Promise<T> {
    const url = new URL(`/rest/v1/${table}`, this.baseUrl);
    for (const [key, value] of Object.entries(options.query ?? {})) {
      url.searchParams.set(key, String(value));
    }

    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers: {
        apikey: this.serviceRoleKey as string,
        authorization: `Bearer ${this.serviceRoleKey}`,
        "content-type": "application/json",
        ...(options.prefer ? { prefer: options.prefer } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Supabase ${response.status}: ${detail}`);
    }

    if (response.status === 204) return [] as T;
    return response.json() as Promise<T>;
  }
}

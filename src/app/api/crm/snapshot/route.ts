import { SupabaseCrmSnapshotRepository } from "@/infrastructure/supabase/supabase-crm-snapshot-repository";

export async function GET() {
  try {
    return Response.json(await new SupabaseCrmSnapshotRepository().getSnapshot());
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Falha ao carregar snapshot do Supabase.",
      },
      { status: 500 },
    );
  }
}

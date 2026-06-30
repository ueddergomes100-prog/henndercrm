export function GET() {
  return Response.json({
    ok: true,
    service: "hennder-crm",
    timestamp: new Date().toISOString(),
  });
}

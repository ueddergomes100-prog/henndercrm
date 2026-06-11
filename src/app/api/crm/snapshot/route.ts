import { crmDemoService } from "@/services/crm-demo-service";

export async function GET() {
  return Response.json(crmDemoService.getSnapshot());
}

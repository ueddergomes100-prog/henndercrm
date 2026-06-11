import {
  MOCK_REFERENCE_DATE,
  mockUniplusProducts,
  mockUniplusSaleItems,
  mockUniplusSellers,
} from "@/data/mock-uniplus";
import type { CrmSnapshot } from "@/domain/crm/types";
import {
  AgendaService,
  AlertaRecompraService,
  ClienteService,
  OportunidadeService,
  ProdutoService,
  RelatorioService,
  VendaService,
  VendedorService,
} from "./crm-services";

export class CrmDemoService {
  constructor(
    private readonly vendaService = new VendaService(),
    private readonly clienteService = new ClienteService(),
    private readonly produtoService = new ProdutoService(),
    private readonly alertaService = new AlertaRecompraService(),
    private readonly vendedorService = new VendedorService(),
    private readonly oportunidadeService = new OportunidadeService(),
    private readonly agendaService = new AgendaService(),
    private readonly relatorioService = new RelatorioService(),
  ) {}

  getSnapshot(): CrmSnapshot {
    const sourceSales = this.vendaService.getValidSourceSales();
    const sales = this.vendaService.getSales(sourceSales);
    const saleItems = this.vendaService.getSaleItems(sourceSales);
    const customers = this.clienteService.getCustomers(sourceSales);
    const products = this.produtoService.getProducts();
    const alerts = this.alertaService.getAlerts(
      sourceSales,
      customers,
      undefined,
      MOCK_REFERENCE_DATE,
      mockUniplusProducts,
      mockUniplusSellers,
      mockUniplusSaleItems,
    );
    const sellers = this.vendedorService.getSellers(mockUniplusSellers, customers, alerts);
    const opportunities = this.oportunidadeService.getOpportunities(customers, products);
    const agenda = this.agendaService.getAgenda(alerts, customers);
    const dashboard = this.relatorioService.getDashboard(customers, alerts);

    return {
      referenceDate: MOCK_REFERENCE_DATE,
      dashboard,
      customers,
      sellers,
      products,
      sales,
      saleItems,
      alerts,
      opportunities,
      agenda,
    };
  }
}

export const crmDemoService = new CrmDemoService();

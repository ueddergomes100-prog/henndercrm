export type AttendanceEvaluationStatus = "respondido" | "pendente" | "resolvido" | "oculto";

export type AttendanceEvaluationSource =
  | "link_publico"
  | "whatsapp"
  | "email"
  | "sms"
  | "qr_code";

export type AttendanceEvaluation = {
  id: string;
  customerId: string;
  customerName: string;
  sellerId: string;
  rating: number;
  comment: string;
  createdAt: string;
  source: AttendanceEvaluationSource;
  status: AttendanceEvaluationStatus;
  response?: string;
  respondedAt?: string;
  serviceDurationMinutes?: number;
};

export type AttendanceEvaluationDataset = {
  evaluations: AttendanceEvaluation[];
  updatedAt: string | null;
  sourceConnected: boolean;
};

export type AttendanceEvaluationQueryDto = {
  from?: string;
  to?: string;
  sellerId?: string;
  customerId?: string;
  rating?: number;
  status?: AttendanceEvaluationStatus;
};

export type AttendanceEvaluationUpdateDto = {
  id: string;
  status?: AttendanceEvaluationStatus;
  response?: string;
};

export type AttendanceEvaluationSubmissionDto = {
  saleId: string;
  customerId: string;
  sellerId: string;
  rating: number;
  comment?: string;
  source: AttendanceEvaluationSource;
};

export type AttendanceEvaluationFilters = {
  period:
    | "hoje"
    | "ontem"
    | "7_dias"
    | "30_dias"
    | "90_dias"
    | "mes_atual"
    | "mes_anterior"
    | "ano"
    | "personalizado";
  sellerId: string;
  store: string;
  department: string;
  role: string;
  customerQuery: string;
  cityQuery: string;
  rating: string;
  minimumReviews: number;
  from: string;
  to: string;
};

export type SellerEvaluationPerformance = {
  sellerId: string;
  sellerName: string;
  initials: string;
  role: string;
  department: string;
  rating: number | null;
  reviewCount: number;
  salesCount: number;
  revenue: number;
  averageTicket: number;
  customerCount: number;
  repeatPurchaseRate: number;
  lastSaleAt: string | null;
  lastReviewAt: string | null;
  averageServiceMinutes: number | null;
  rankingPosition: number;
  badge:
    | "Top Performer"
    | "Excelente"
    | "Muito Bom"
    | "Bom"
    | "Regular"
    | "Necessita Atenção"
    | "Aguardando avaliações";
};

export type AttendanceEvaluationExportRow = {
  vendedor: string;
  nota: string;
  avaliacoes: number;
  vendas: number;
  faturamento: number;
  ticketMedio: number;
  clientes: number;
  taxaRecompra: number;
};

"use client";

import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileDown,
  Filter,
  Gauge,
  MessageSquareText,
  RefreshCcw,
  Search,
  Settings2,
  Star,
  Store,
  TrendingUp,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CrmProduct,
  CrmSale,
  CrmSaleItem,
  CrmSeller,
} from "@/domain/crm/types";
import { cn } from "@/lib/utils";
import {
  type CustomerViewModel,
  formatCurrency,
} from "@/services/crm-view-service";
import {
  average,
  buildMonthlyEvaluationSeries,
  buildRatingDistribution,
  buildSellerEvaluationPerformance,
  filterAttendanceEvaluations,
  filterCommercialSales,
  formatCompactDate,
  normalizeText,
} from "./analytics";
import type {
  AttendanceEvaluation,
  AttendanceEvaluationExportRow,
  AttendanceEvaluationFilters,
  SellerEvaluationPerformance,
} from "./types";
import { useAttendanceEvaluations } from "./use-attendance-evaluations";

type AttendanceEvaluationsModuleProps = {
  sellers: CrmSeller[];
  sales: CrmSale[];
  saleItems: CrmSaleItem[];
  products: CrmProduct[];
  customers: CustomerViewModel[];
  referenceDate: string;
};

type DashboardTab = "visao-geral" | "comentarios" | "administracao";
type DrawerKind = "filters" | "settings" | "seller" | null;

const evaluationVisualTokens = {
  "--background": "Canvas",
  "--foreground": "CanvasText",
  "--card": "color-mix(in srgb, Canvas 98%, CanvasText 2%)",
  "--popover": "Canvas",
  "--popover-foreground": "CanvasText",
  "--muted": "color-mix(in srgb, CanvasText 5%, Canvas)",
  "--muted-foreground": "color-mix(in srgb, CanvasText 58%, Canvas)",
  "--border": "color-mix(in srgb, CanvasText 12%, Canvas)",
  "--primary": "light-dark(var(--color-blue-700), var(--color-cyan-400))",
  "--secondary": "light-dark(var(--color-emerald-700), var(--color-emerald-400))",
  "--accent": "light-dark(var(--color-cyan-700), var(--color-blue-400))",
  "--destructive": "light-dark(var(--color-red-700), var(--color-red-400))",
  "--ring": "var(--primary)",
} as CSSProperties;

const defaultFilters: AttendanceEvaluationFilters = {
  period: "30_dias",
  sellerId: "todos",
  store: "Shopping Rural",
  department: "todos",
  role: "todos",
  customerQuery: "",
  cityQuery: "",
  rating: "",
  minimumReviews: 0,
  from: "",
  to: "",
};

const periodOptions: Array<{
  value: AttendanceEvaluationFilters["period"];
  label: string;
}> = [
  { value: "hoje", label: "Hoje" },
  { value: "ontem", label: "Ontem" },
  { value: "7_dias", label: "Últimos 7 dias" },
  { value: "30_dias", label: "Últimos 30 dias" },
  { value: "90_dias", label: "Últimos 90 dias" },
  { value: "mes_atual", label: "Este mês" },
  { value: "mes_anterior", label: "Mês passado" },
  { value: "ano", label: "Ano" },
  { value: "personalizado", label: "Período personalizado" },
];

const commentPageSize = 10;

export default function AttendanceEvaluationsModule({
  sellers,
  sales,
  saleItems,
  products,
  customers,
  referenceDate,
}: AttendanceEvaluationsModuleProps) {
  const {
    evaluations,
    sourceConnected,
    updatedAt,
    loading,
    refreshing,
    error,
    refresh,
  } = useAttendanceEvaluations();
  const [filters, setFilters] =
    useState<AttendanceEvaluationFilters>(defaultFilters);
  const [tab, setTab] = useState<DashboardTab>("visao-geral");
  const [drawer, setDrawer] = useState<DrawerKind>(null);
  const [selectedSellerId, setSelectedSellerId] = useState("");
  const [commentSearch, setCommentSearch] = useState("");
  const [commentPage, setCommentPage] = useState(1);

  const customersById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );
  const filteredSales = useMemo(
    () =>
      filterCommercialSales(
        sales,
        filters,
        referenceDate,
        customersById,
      ),
    [customersById, filters, referenceDate, sales],
  );
  const filteredEvaluations = useMemo(
    () =>
      filterAttendanceEvaluations(
        evaluations,
        filters,
        referenceDate,
        customersById,
      ),
    [customersById, evaluations, filters, referenceDate],
  );
  const sellerPerformance = useMemo(() => {
    const rows = buildSellerEvaluationPerformance({
      sellers,
      sales: filteredSales,
      evaluations: filteredEvaluations,
    });
    return rows.filter(
      (row) =>
        row.reviewCount >= filters.minimumReviews &&
        (filters.department === "todos" ||
          row.department === filters.department) &&
        (filters.role === "todos" || row.role === filters.role),
    );
  }, [
    filteredEvaluations,
    filteredSales,
    filters.department,
    filters.minimumReviews,
    filters.role,
    sellers,
  ]);
  const selectedSeller =
    sellerPerformance.find((seller) => seller.sellerId === selectedSellerId) ??
    null;
  const monthlySeries = useMemo(
    () => buildMonthlyEvaluationSeries(filteredEvaluations, referenceDate),
    [filteredEvaluations, referenceDate],
  );
  const ratingDistribution = useMemo(
    () => buildRatingDistribution(filteredEvaluations),
    [filteredEvaluations],
  );
  const filteredComments = useMemo(() => {
    const query = normalizeText(commentSearch);
    if (!query) return filteredEvaluations;
    return filteredEvaluations.filter((evaluation) => {
      const seller = sellers.find(
        (item) => item.id === evaluation.sellerId,
      );
      return [
        evaluation.customerName,
        evaluation.comment,
        seller?.name ?? "",
      ].some((value) => normalizeText(value).includes(query));
    });
  }, [commentSearch, filteredEvaluations, sellers]);
  const commentPages = Math.max(
    1,
    Math.ceil(filteredComments.length / commentPageSize),
  );
  const visibleComments = filteredComments.slice(
    (Math.min(commentPage, commentPages) - 1) * commentPageSize,
    Math.min(commentPage, commentPages) * commentPageSize,
  );

  const evaluatedCustomerIds = new Set(
    filteredEvaluations.map((evaluation) => evaluation.customerId),
  );
  const commercialCustomerIds = new Set(
    filteredSales.map((sale) => sale.customerId),
  );
  const clientsWithoutReview = [...commercialCustomerIds].filter(
    (customerId) => !evaluatedCustomerIds.has(customerId),
  ).length;
  const generalRating = filteredEvaluations.length
    ? average(filteredEvaluations.map((evaluation) => evaluation.rating))
    : null;
  const answeredReviews = filteredEvaluations.filter(
    (evaluation) =>
      evaluation.status === "respondido" ||
      evaluation.status === "resolvido",
  ).length;
  const responseRate = filteredEvaluations.length
    ? (answeredReviews / filteredEvaluations.length) * 100
    : 0;
  const ratedSellers = sellerPerformance.filter(
    (seller) => seller.rating !== null,
  );
  const bestSeller = ratedSellers[0] ?? null;
  const attentionSeller =
    [...ratedSellers]
      .filter((seller) => (seller.rating ?? 5) < 4)
      .sort((left, right) => (left.rating ?? 0) - (right.rating ?? 0))[0] ??
    null;

  const openSeller = (sellerId: string) => {
    setSelectedSellerId(sellerId);
    setDrawer("seller");
  };

  const updateFilters = (
    patch: Partial<AttendanceEvaluationFilters>,
  ) => {
    setFilters((current) => ({ ...current, ...patch }));
    setCommentPage(1);
  };

  const exportRows = sellerPerformance.map(
    (seller): AttendanceEvaluationExportRow => ({
      vendedor: seller.sellerName,
      nota: seller.rating === null ? "Sem avaliações" : seller.rating.toFixed(2),
      avaliacoes: seller.reviewCount,
      vendas: seller.salesCount,
      faturamento: seller.revenue,
      ticketMedio: seller.averageTicket,
      clientes: seller.customerCount,
      taxaRecompra: seller.repeatPurchaseRate,
    }),
  );

  return (
    <div
      className="space-y-5 text-[var(--foreground)]"
      style={evaluationVisualTokens}
    >
      <EvaluationHeader
        sourceConnected={sourceConnected}
        updatedAt={updatedAt}
        refreshing={refreshing}
        onRefresh={() => void refresh()}
        onExportPdf={() => window.print()}
        onExportExcel={() => exportEvaluationCsv(exportRows)}
        onOpenFilters={() => setDrawer("filters")}
        onOpenSettings={() => setDrawer("settings")}
      />

      {error ? (
        <Card className="border-[var(--destructive)]">
          <CardContent className="flex items-start gap-3">
            <AlertCircle
              className="mt-0.5 size-5 shrink-0 text-[var(--destructive)]"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">Falha ao atualizar avaliações</p>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                {error}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <DashboardTabs value={tab} onChange={setTab} />

      {loading ? (
        <EvaluationSkeleton />
      ) : tab === "visao-geral" ? (
        <div className="space-y-5">
          <section
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
            aria-label="Indicadores de avaliação"
          >
            <MetricCard
              icon={Star}
              label="Avaliação geral"
              value={generalRating === null ? "Sem dados" : `${generalRating.toFixed(1)} / 5`}
              detail={
                filteredEvaluations.length
                  ? `${filteredEvaluations.length} respostas no período`
                  : "Aguardando a primeira avaliação"
              }
              progress={generalRating === null ? 0 : generalRating * 20}
            />
            <MetricCard
              icon={MessageSquareText}
              label="Total de avaliações"
              value={String(filteredEvaluations.length)}
              detail={
                sourceConnected
                  ? "Fonte conectada e atualizada"
                  : "Fonte ainda não conectada"
              }
            />
            <MetricCard
              icon={CheckCircle2}
              label="Taxa de resposta"
              value={`${responseRate.toFixed(0)}%`}
              detail={`${answeredReviews} avaliações tratadas`}
              progress={responseRate}
            />
            <MetricCard
              icon={UsersRound}
              label="Clientes sem avaliar"
              value={String(clientsWithoutReview)}
              detail={`${commercialCustomerIds.size} clientes compraram no período`}
            />
            <PeopleMetricCard
              icon={Trophy}
              label="Melhor vendedor"
              seller={bestSeller}
              emptyText="Aguardando avaliações"
            />
            <PeopleMetricCard
              icon={AlertCircle}
              label="Necessita atenção"
              seller={attentionSeller}
              emptyText="Nenhum alerta de qualidade"
              destructive={Boolean(attentionSeller)}
            />
          </section>

          <SectionHeading
            title="Ranking de vendedores"
            description="Qualidade de atendimento combinada com os resultados comerciais reais do período."
            icon={Trophy}
          />
          {sellerPerformance.length ? (
            <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
              {sellerPerformance.map((seller, index) => (
                <SellerRankingCard
                  key={seller.sellerId}
                  seller={seller}
                  index={index}
                  onOpen={() => openSeller(seller.sellerId)}
                />
              ))}
            </section>
          ) : (
            <EmptyReviewsState
              title="Nenhum vendedor encontrado"
              description="Ajuste os filtros para visualizar a performance da equipe."
              icon={UsersRound}
            />
          )}

          <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader className="items-start justify-between">
                <div>
                  <CardTitle>Evolução das avaliações</CardTitle>
                  <CardDescription>
                    Nota média e volume mensal nos últimos 12 meses.
                  </CardDescription>
                </div>
                <BarChart3
                  className="size-5 text-[var(--primary)]"
                  aria-hidden="true"
                />
              </CardHeader>
              <CardContent>
                {filteredEvaluations.length ? (
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={monthlySeries}>
                        <defs>
                          <linearGradient
                            id="evaluationRatingGradient"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor="var(--primary)"
                              stopOpacity={0.32}
                            />
                            <stop
                              offset="95%"
                              stopColor="var(--primary)"
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="var(--border)"
                          strokeDasharray="4 4"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="month"
                          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          domain={[0, 5]}
                          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<EvaluationChartTooltip />} />
                        <Area
                          type="monotone"
                          dataKey="rating"
                          name="Nota média"
                          stroke="var(--primary)"
                          strokeWidth={3}
                          fill="url(#evaluationRatingGradient)"
                          connectNulls
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <ChartEmptyState />
                )}
              </CardContent>
            </Card>

            <RatingDistributionCard
              evaluations={filteredEvaluations}
              distribution={ratingDistribution}
            />
          </section>

          <Card>
            <CardHeader className="items-start justify-between">
              <div>
                <CardTitle>Volume de avaliações</CardTitle>
                <CardDescription>
                  Quantidade de respostas recebidas em cada mês.
                </CardDescription>
              </div>
              <TrendingUp
                className="size-5 text-[var(--secondary)]"
                aria-hidden="true"
              />
            </CardHeader>
            <CardContent>
              {filteredEvaluations.length ? (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlySeries}>
                      <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="4 4"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="month"
                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        allowDecimals={false}
                        tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip content={<EvaluationChartTooltip />} />
                      <Bar
                        dataKey="reviews"
                        name="Avaliações"
                        fill="var(--secondary)"
                        radius={[6, 6, 0, 0]}
                        maxBarSize={42}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <ChartEmptyState />
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <CommentsWorkspace
          evaluations={visibleComments}
          sellers={sellers}
          search={commentSearch}
          onSearch={(value) => {
            setCommentSearch(value);
            setCommentPage(1);
          }}
          currentPage={Math.min(commentPage, commentPages)}
          pages={commentPages}
          total={filteredComments.length}
          onPrevious={() =>
            setCommentPage((current) => Math.max(1, current - 1))
          }
          onNext={() =>
            setCommentPage((current) => Math.min(commentPages, current + 1))
          }
          administrative={tab === "administracao"}
          sourceConnected={sourceConnected}
          onOpenFilters={() => setDrawer("filters")}
        />
      )}

      <AnimatePresence>
        {drawer ? (
          <EvaluationDrawer
            title={
              drawer === "filters"
                ? "Filtros avançados"
                : drawer === "settings"
                  ? "Configurações de avaliações"
                  : selectedSeller?.sellerName ?? "Detalhes do vendedor"
            }
            description={
              drawer === "filters"
                ? "Refine indicadores, ranking e comentários."
                : drawer === "settings"
                  ? "Arquitetura preparada para os próximos canais de coleta."
                  : "Visão individual de qualidade e performance comercial."
            }
            wide={drawer === "seller"}
            onClose={() => setDrawer(null)}
          >
            {drawer === "filters" ? (
              <EvaluationFilters
                filters={filters}
                sellers={sellers}
                onChange={updateFilters}
                onClear={() => {
                  setFilters(defaultFilters);
                  setCommentPage(1);
                }}
                onApply={() => setDrawer(null)}
              />
            ) : drawer === "settings" ? (
              <EvaluationSettings sourceConnected={sourceConnected} />
            ) : selectedSeller ? (
              <SellerDetail
                seller={selectedSeller}
                evaluations={filteredEvaluations.filter(
                  (evaluation) =>
                    evaluation.sellerId === selectedSeller.sellerId,
                )}
                sales={filteredSales.filter(
                  (sale) => sale.sellerId === selectedSeller.sellerId,
                )}
                saleItems={saleItems}
                products={products}
                customers={customers}
                companyAverage={generalRating}
                bestRating={bestSeller?.rating ?? null}
                referenceDate={referenceDate}
              />
            ) : null}
          </EvaluationDrawer>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function EvaluationHeader({
  sourceConnected,
  updatedAt,
  refreshing,
  onRefresh,
  onExportPdf,
  onExportExcel,
  onOpenFilters,
  onOpenSettings,
}: {
  sourceConnected: boolean;
  updatedAt: string | null;
  refreshing: boolean;
  onRefresh: () => void;
  onExportPdf: () => void;
  onExportExcel: () => void;
  onOpenFilters: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <header className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">Qualidade comercial</Badge>
          <Badge variant={sourceConnected ? "secondary" : "muted"}>
            {sourceConnected ? "Dados em tempo real" : "Integração preparada"}
          </Badge>
        </div>
        <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
          Avaliações de Atendimento
        </h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)] sm:text-base">
          Monitore em tempo real a satisfação dos clientes com cada vendedor.
        </p>
        <p className="mt-2 text-xs text-[var(--muted-foreground)]">
          {updatedAt
            ? `Atualizado em ${formatCompactDate(updatedAt)}`
            : "Aguardando conexão com a fonte de avaliações"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton icon={FileDown} label="Exportar PDF" onClick={onExportPdf} />
        <ActionButton icon={Download} label="Exportar Excel" onClick={onExportExcel} />
        <ActionButton
          icon={RefreshCcw}
          label="Atualizar dados"
          onClick={onRefresh}
          iconClassName={refreshing ? "animate-spin" : ""}
          disabled={refreshing}
        />
        <ActionButton icon={Filter} label="Filtros" onClick={onOpenFilters} />
        <ActionButton
          icon={Settings2}
          label="Configurações"
          onClick={onOpenSettings}
        />
      </div>
    </header>
  );
}

function DashboardTabs({
  value,
  onChange,
}: {
  value: DashboardTab;
  onChange: (value: DashboardTab) => void;
}) {
  const tabs: Array<{ value: DashboardTab; label: string }> = [
    { value: "visao-geral", label: "Visão geral" },
    { value: "comentarios", label: "Comentários" },
    { value: "administracao", label: "Administração" },
  ];
  return (
    <nav
      className="flex w-full gap-1 overflow-x-auto rounded-lg border border-[var(--border)] bg-[var(--muted)] p-1 sm:w-fit"
      aria-label="Seções de avaliações"
    >
      {tabs.map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => onChange(item.value)}
          className={cn(
            "min-h-9 shrink-0 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]",
            value === item.value
              ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
          )}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  progress,
}: {
  icon: typeof Star;
  label: string;
  value: string;
  detail: string;
  progress?: number;
}) {
  return (
    <Card className="transition-transform hover:-translate-y-0.5">
      <CardContent className="flex h-full min-h-40 flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {label}
          </p>
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]">
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        <div className="mt-4">
          <p className="text-2xl font-semibold">{value}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">{detail}</p>
          {typeof progress === "number" ? (
            <Progress value={progress} className="mt-3" />
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function PeopleMetricCard({
  icon: Icon,
  label,
  seller,
  emptyText,
  destructive = false,
}: {
  icon: typeof Trophy;
  label: string;
  seller: SellerEvaluationPerformance | null;
  emptyText: string;
  destructive?: boolean;
}) {
  return (
    <Card className="transition-transform hover:-translate-y-0.5">
      <CardContent className="flex h-full min-h-40 flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-[var(--muted-foreground)]">
            {label}
          </p>
          <span
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--muted)]",
              destructive
                ? "text-[var(--destructive)]"
                : "text-[var(--primary)]",
            )}
          >
            <Icon className="size-4" aria-hidden="true" />
          </span>
        </div>
        {seller ? (
          <div className="mt-4 flex min-w-0 items-center gap-3">
            <Avatar>
              <AvatarFallback>{seller.initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{seller.sellerName}</p>
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {seller.rating?.toFixed(1)} / 5 · {seller.rankingPosition}º lugar
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <p className="text-base font-semibold">{emptyText}</p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Sem avaliação suficiente no período.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SellerRankingCard({
  seller,
  index,
  onOpen,
}: {
  seller: SellerEvaluationPerformance;
  index: number;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.18) }}
      onClick={onOpen}
      className="min-w-0 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      style={{ contentVisibility: "auto" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-11">
            <AvatarFallback>{seller.initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate font-semibold">{seller.sellerName}</p>
            <p className="text-xs text-[var(--muted-foreground)]">
              {seller.role} · {seller.department}
            </p>
          </div>
        </div>
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--muted)] text-xs font-semibold text-[var(--primary)]">
          {seller.rankingPosition}º
        </span>
      </div>
      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold">
            {seller.rating === null ? "—" : seller.rating.toFixed(1)}
          </p>
          <RatingStars rating={seller.rating} />
        </div>
        <PerformanceBadge seller={seller} />
      </div>
      <Progress
        value={seller.rating === null ? 0 : seller.rating * 20}
        className="mt-4"
        indicatorClassName={getRatingIndicatorClass(seller.rating)}
      />
      <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-[var(--border)] pt-4 sm:grid-cols-3">
        <SellerStat label="Avaliações" value={String(seller.reviewCount)} />
        <SellerStat label="Vendas" value={String(seller.salesCount)} />
        <SellerStat label="Valor vendido" value={formatCurrency(seller.revenue)} />
        <SellerStat label="Ticket médio" value={formatCurrency(seller.averageTicket)} />
        <SellerStat label="Clientes" value={String(seller.customerCount)} />
        <SellerStat
          label="Recompra"
          value={`${seller.repeatPurchaseRate.toFixed(0)}%`}
        />
      </div>
      <div className="mt-4 grid gap-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted-foreground)] sm:grid-cols-2">
        <span>Última venda: {formatCompactDate(seller.lastSaleAt)}</span>
        <span>Última avaliação: {formatCompactDate(seller.lastReviewAt)}</span>
        <span>
          Atendimento:{" "}
          {seller.averageServiceMinutes === null
            ? "Sem registro"
            : `${seller.averageServiceMinutes.toFixed(0)} min`}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-[var(--primary)]">
          Ver desempenho
          <ChevronRight className="size-3.5" aria-hidden="true" />
        </span>
      </div>
    </motion.button>
  );
}

function RatingDistributionCard({
  evaluations,
  distribution,
}: {
  evaluations: AttendanceEvaluation[];
  distribution: ReturnType<typeof buildRatingDistribution>;
}) {
  return (
    <Card>
      <CardHeader className="items-start justify-between">
        <div>
          <CardTitle>Distribuição das notas</CardTitle>
          <CardDescription>Percentual por quantidade de estrelas.</CardDescription>
        </div>
        <Star className="size-5 text-[var(--primary)]" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        {evaluations.length ? (
          <>
            <div className="mx-auto h-48 max-w-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="count"
                    nameKey="rating"
                    innerRadius={50}
                    outerRadius={76}
                    paddingAngle={3}
                  >
                    {distribution.map((entry, index) => (
                      <Cell
                        key={entry.rating}
                        fill={
                          index === 0
                            ? "var(--primary)"
                            : index === 1
                              ? "var(--secondary)"
                              : "var(--muted-foreground)"
                        }
                        opacity={Math.max(0.35, 1 - index * 0.12)}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<EvaluationChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-3">
              {distribution.map((entry) => (
                <div key={entry.rating} className="grid grid-cols-[4rem_1fr_3rem] items-center gap-3">
                  <span className="flex items-center gap-1 text-xs font-medium">
                    {entry.rating}
                    <Star className="size-3 fill-current text-[var(--primary)]" />
                  </span>
                  <Progress value={entry.percentage} />
                  <span className="text-right text-xs text-[var(--muted-foreground)]">
                    {entry.percentage.toFixed(0)}%
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <ChartEmptyState compact />
        )}
      </CardContent>
    </Card>
  );
}

function CommentsWorkspace({
  evaluations,
  sellers,
  search,
  onSearch,
  currentPage,
  pages,
  total,
  onPrevious,
  onNext,
  administrative,
  sourceConnected,
  onOpenFilters,
}: {
  evaluations: AttendanceEvaluation[];
  sellers: CrmSeller[];
  search: string;
  onSearch: (value: string) => void;
  currentPage: number;
  pages: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  administrative: boolean;
  sourceConnected: boolean;
  onOpenFilters: () => void;
}) {
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
  return (
    <Card>
      <CardHeader className="flex-col items-stretch justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <CardTitle>
            {administrative ? "Gestão de avaliações" : "Comentários dos clientes"}
          </CardTitle>
          <CardDescription>
            {administrative
              ? "Área preparada para responder, resolver e moderar comentários."
              : "Feedback recebido por vendedor, origem e situação."}
          </CardDescription>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="relative min-w-0 sm:min-w-72">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Buscar cliente, vendedor ou comentário"
              className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
            />
          </label>
          <ActionButton icon={Filter} label="Filtros" onClick={onOpenFilters} />
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {!sourceConnected ? (
          <div className="border-b border-[var(--border)] bg-[var(--muted)] px-5 py-3 text-xs text-[var(--muted-foreground)]">
            A fonte de avaliações ainda não está conectada. A tela já está pronta
            para receber dados reais.
          </div>
        ) : null}
        {evaluations.length ? (
          <>
            <div className="hidden lg:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[16%]">Cliente</TableHead>
                    <TableHead className="w-[15%]">Vendedor</TableHead>
                    <TableHead className="w-[9%]">Nota</TableHead>
                    <TableHead className="w-[27%]">Comentário</TableHead>
                    <TableHead className="w-[11%]">Data</TableHead>
                    <TableHead className="w-[10%]">Origem</TableHead>
                    <TableHead className="w-[12%]">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {evaluations.map((evaluation) => (
                    <TableRow key={evaluation.id}>
                      <TableCell className="font-medium">
                        <span className="line-clamp-2">
                          {evaluation.customerName}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-2">
                          {sellerById.get(evaluation.sellerId)?.name ??
                            "Vendedor não identificado"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 font-semibold">
                          {evaluation.rating.toFixed(1)}
                          <Star className="size-3.5 fill-current text-[var(--primary)]" />
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="line-clamp-3 text-[var(--muted-foreground)]">
                          {evaluation.comment || "Sem comentário"}
                        </span>
                      </TableCell>
                      <TableCell>{formatCompactDate(evaluation.createdAt)}</TableCell>
                      <TableCell>
                        <Badge variant="muted">
                          {formatEvaluationSource(evaluation.source)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={evaluation.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="divide-y divide-[var(--border)] lg:hidden">
              {evaluations.map((evaluation) => (
                <article key={evaluation.id} className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{evaluation.customerName}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {sellerById.get(evaluation.sellerId)?.name ??
                          "Vendedor não identificado"}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 font-semibold">
                      {evaluation.rating.toFixed(1)}
                      <Star className="size-3.5 fill-current text-[var(--primary)]" />
                    </span>
                  </div>
                  <p className="text-sm text-[var(--muted-foreground)]">
                    {evaluation.comment || "Sem comentário"}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={evaluation.status} />
                    <Badge>{formatEvaluationSource(evaluation.source)}</Badge>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {formatCompactDate(evaluation.createdAt)}
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyReviewsState
            icon={MessageSquareText}
            title="Nenhum comentário recebido"
            description={
              sourceConnected
                ? "Não existem avaliações para os filtros selecionados."
                : "Quando a integração for conectada, as avaliações reais aparecerão aqui automaticamente."
            }
            embedded
          />
        )}
        <div className="flex flex-col gap-3 border-t border-[var(--border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--muted-foreground)]">
            {total} avaliação(ões) · página {currentPage} de {pages}
          </p>
          <div className="flex items-center gap-2">
            <IconButton
              icon={ChevronLeft}
              label="Página anterior"
              onClick={onPrevious}
              disabled={currentPage <= 1}
            />
            <IconButton
              icon={ChevronRight}
              label="Próxima página"
              onClick={onNext}
              disabled={currentPage >= pages}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EvaluationFilters({
  filters,
  sellers,
  onChange,
  onClear,
  onApply,
}: {
  filters: AttendanceEvaluationFilters;
  sellers: CrmSeller[];
  onChange: (patch: Partial<AttendanceEvaluationFilters>) => void;
  onClear: () => void;
  onApply: () => void;
}) {
  return (
    <div className="space-y-5">
      <FilterField label="Período">
        <SelectControl
          value={filters.period}
          onChange={(value) =>
            onChange({
              period: value as AttendanceEvaluationFilters["period"],
            })
          }
          options={periodOptions}
        />
      </FilterField>
      {filters.period === "personalizado" ? (
        <div className="grid grid-cols-2 gap-3">
          <FilterField label="De">
            <InputControl
              type="date"
              value={filters.from}
              onChange={(value) => onChange({ from: value })}
            />
          </FilterField>
          <FilterField label="Até">
            <InputControl
              type="date"
              value={filters.to}
              onChange={(value) => onChange({ to: value })}
            />
          </FilterField>
        </div>
      ) : null}
      <FilterField label="Loja">
        <SelectControl
          value={filters.store}
          onChange={(value) => onChange({ store: value })}
          options={[{ value: "Shopping Rural", label: "Shopping Rural" }]}
        />
      </FilterField>
      <FilterField label="Vendedor">
        <SelectControl
          value={filters.sellerId}
          onChange={(value) => onChange({ sellerId: value })}
          options={[
            { value: "todos", label: "Todos os vendedores" },
            ...sellers
              .filter((seller) => !seller.inactive)
              .map((seller) => ({
                value: seller.id,
                label: seller.name,
              })),
          ]}
        />
      </FilterField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterField label="Departamento">
          <SelectControl
            value={filters.department}
            onChange={(value) => onChange({ department: value })}
            options={[
              { value: "todos", label: "Todos" },
              { value: "Comercial", label: "Comercial" },
            ]}
          />
        </FilterField>
        <FilterField label="Cargo">
          <SelectControl
            value={filters.role}
            onChange={(value) => onChange({ role: value })}
            options={[
              { value: "todos", label: "Todos" },
              { value: "Vendedor", label: "Vendedor" },
              { value: "Supervisor", label: "Supervisor" },
            ]}
          />
        </FilterField>
      </div>
      <FilterField label="Cliente">
        <InputControl
          value={filters.customerQuery}
          onChange={(value) => onChange({ customerQuery: value })}
          placeholder="Nome do cliente"
        />
      </FilterField>
      <FilterField label="Cidade">
        <InputControl
          value={filters.cityQuery}
          onChange={(value) => onChange({ cityQuery: value })}
          placeholder="Nome da cidade"
        />
      </FilterField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FilterField label="Nota">
          <SelectControl
            value={filters.rating}
            onChange={(value) => onChange({ rating: value })}
            options={[
              { value: "", label: "Todas" },
              { value: "5", label: "5 estrelas" },
              { value: "4", label: "4 estrelas" },
              { value: "3", label: "3 estrelas" },
              { value: "2", label: "2 estrelas" },
              { value: "1", label: "1 estrela" },
            ]}
          />
        </FilterField>
        <FilterField label="Mínimo de avaliações">
          <InputControl
            type="number"
            min={0}
            value={String(filters.minimumReviews)}
            onChange={(value) =>
              onChange({ minimumReviews: Math.max(0, Number(value) || 0) })
            }
          />
        </FilterField>
      </div>
      <div className="flex flex-col-reverse gap-2 border-t border-[var(--border)] pt-5 sm:flex-row sm:justify-end">
        <SecondaryButton label="Limpar filtros" onClick={onClear} />
        <PrimaryButton label="Aplicar filtros" onClick={onApply} />
      </div>
    </div>
  );
}

function EvaluationSettings({
  sourceConnected,
}: {
  sourceConnected: boolean;
}) {
  const integrations = [
    { icon: MessageSquareText, name: "WhatsApp", detail: "Envio após a venda" },
    { icon: FileDown, name: "E-mail", detail: "Pesquisa por link" },
    { icon: Clock3, name: "SMS", detail: "Lembrete de avaliação" },
    { icon: Gauge, name: "QR Code", detail: "Coleta no ponto de venda" },
  ];
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-4">
        <div className="flex items-start gap-3">
          <CircleHelp
            className="mt-0.5 size-5 shrink-0 text-[var(--primary)]"
            aria-hidden="true"
          />
          <div>
            <p className="font-semibold">Fonte de avaliações</p>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {sourceConnected
                ? "A fonte está conectada e atualiza automaticamente."
                : "A interface está pronta, sem dados fictícios. A conexão será feita quando o canal de coleta for definido."}
            </p>
          </div>
        </div>
      </div>
      <section>
        <h3 className="text-sm font-semibold">Integrações futuras</h3>
        <div className="mt-3 divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {integrations.map(({ icon: Icon, name, detail }) => (
            <div key={name} className="flex items-center gap-3 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-[var(--muted)] text-[var(--primary)]">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{name}</p>
                <p className="text-xs text-[var(--muted-foreground)]">{detail}</p>
              </div>
              <Badge variant="muted">Planejado</Badge>
            </div>
          ))}
        </div>
      </section>
      <PublicSurveyPreview />
    </div>
  );
}

function PublicSurveyPreview() {
  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Página pública preparada</h3>
          <p className="text-xs text-[var(--muted-foreground)]">
            Prévia estrutural, ainda sem rota pública ou envio.
          </p>
        </div>
        <Badge variant="primary">Prévia</Badge>
      </div>
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--background)] p-5 text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-lg bg-[var(--primary)] text-[var(--background)]">
          <Store className="size-5" aria-hidden="true" />
        </div>
        <p className="mt-4 font-semibold">Como foi seu atendimento?</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          Sua opinião ajuda o Shopping Rural a atender cada vez melhor.
        </p>
        <div className="mt-4 flex justify-center gap-1 text-[var(--primary)]">
          {Array.from({ length: 5 }, (_, index) => (
            <Star key={index} className="size-6" aria-hidden="true" />
          ))}
        </div>
        <div className="mt-4 h-20 rounded-lg border border-[var(--border)] bg-[var(--card)]" />
        <button
          type="button"
          disabled
          className="mt-3 h-10 w-full rounded-lg bg-[var(--primary)] text-sm font-semibold text-[var(--background)] opacity-70"
        >
          Enviar avaliação
        </button>
      </div>
    </section>
  );
}

function SellerDetail({
  seller,
  evaluations,
  sales,
  saleItems,
  products,
  customers,
  companyAverage,
  bestRating,
  referenceDate,
}: {
  seller: SellerEvaluationPerformance;
  evaluations: AttendanceEvaluation[];
  sales: CrmSale[];
  saleItems: CrmSaleItem[];
  products: CrmProduct[];
  customers: CustomerViewModel[];
  companyAverage: number | null;
  bestRating: number | null;
  referenceDate: string;
}) {
  const saleIds = new Set(sales.map((sale) => sale.id));
  const productTotals = new Map<string, { name: string; quantity: number }>();
  for (const item of saleItems) {
    if (!saleIds.has(item.saleId)) continue;
    const productName =
      products.find((product) => product.id === item.productId)?.name ||
      item.productName ||
      "Produto não identificado";
    const current = productTotals.get(productName) ?? {
      name: productName,
      quantity: 0,
    };
    current.quantity += item.quantity;
    productTotals.set(productName, current);
  }
  const topProducts = [...productTotals.values()]
    .sort((left, right) => right.quantity - left.quantity)
    .slice(0, 5);
  const sellerCustomers = customers.filter(
    (customer) => customer.preferredSellerId === seller.sellerId,
  );
  const lostCustomers = sellerCustomers.filter(
    (customer) =>
      customer.activityStatus === "perdido" ||
      customer.activityStatus === "risco",
  ).length;
  const recurringCustomers = sellerCustomers.filter(
    (customer) => customer.totalPurchases > 1,
  ).length;
  const monthlySeries = buildMonthlyEvaluationSeries(evaluations, referenceDate);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--muted)] p-5 sm:flex-row sm:items-center">
        <Avatar className="size-16">
          <AvatarFallback className="text-base">{seller.initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">{seller.sellerName}</h3>
            <PerformanceBadge seller={seller} />
          </div>
          <p className="text-sm text-[var(--muted-foreground)]">
            {seller.role} · {seller.department}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <RatingStars rating={seller.rating} />
            <span className="text-sm font-semibold">
              {seller.rating === null
                ? "Sem avaliações"
                : `${seller.rating.toFixed(1)} / 5`}
            </span>
            <Badge variant="primary">{seller.rankingPosition}º no ranking</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <CompactStat label="Vendas" value={String(seller.salesCount)} />
        <CompactStat label="Valor vendido" value={formatCurrency(seller.revenue)} />
        <CompactStat label="Ticket médio" value={formatCurrency(seller.averageTicket)} />
        <CompactStat label="Clientes" value={String(seller.customerCount)} />
        <CompactStat label="Clientes recorrentes" value={String(recurringCustomers)} />
        <CompactStat label="Clientes em risco" value={String(lostCustomers)} />
        <CompactStat
          label="Tempo médio"
          value={
            seller.averageServiceMinutes === null
              ? "Sem dados"
              : `${seller.averageServiceMinutes.toFixed(0)} min`
          }
        />
        <CompactStat label="Meta" value="Não configurada" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ComparisonRow
          label="Média da empresa"
          value={companyAverage}
          sellerRating={seller.rating}
        />
        <ComparisonRow
          label="Melhor vendedor"
          value={bestRating}
          sellerRating={seller.rating}
        />
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Evolução individual</CardTitle>
            <CardDescription>Nota média nos últimos 12 meses.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {evaluations.length ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySeries}>
                  <CartesianGrid
                    stroke="var(--border)"
                    strokeDasharray="4 4"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 5]}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip content={<EvaluationChartTooltip />} />
                  <Area
                    dataKey="rating"
                    name="Nota média"
                    stroke="var(--primary)"
                    fill="var(--muted)"
                    strokeWidth={3}
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <ChartEmptyState compact />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Produtos mais vendidos</CardTitle>
              <CardDescription>Itens reais das vendas do período.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {topProducts.length ? (
              <div className="space-y-3">
                {topProducts.map((product, index) => (
                  <div
                    key={product.name}
                    className="flex items-center gap-3 border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                  >
                    <span className="grid size-7 shrink-0 place-items-center rounded-md bg-[var(--muted)] text-xs font-semibold">
                      {index + 1}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-sm font-medium">
                      {product.name}
                    </p>
                    <Badge variant="secondary">{product.quantity} un.</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <SmallEmpty text="Sem itens vendidos no período." />
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Últimas avaliações</CardTitle>
              <CardDescription>Comentários mais recentes.</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {evaluations.length ? (
              <div className="space-y-3">
                {evaluations.slice(0, 5).map((evaluation) => (
                  <article
                    key={evaluation.id}
                    className="border-b border-[var(--border)] pb-3 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold">
                        {evaluation.customerName}
                      </p>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold">
                        {evaluation.rating.toFixed(1)}
                        <Star className="size-3 fill-current text-[var(--primary)]" />
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--muted-foreground)]">
                      {evaluation.comment || "Sem comentário"}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <SmallEmpty text="Nenhuma avaliação recebida para este vendedor." />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Mapa de calor</CardTitle>
            <CardDescription>
              Distribuição de avaliações por dia e horário.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <EvaluationHeatmap evaluations={evaluations} />
        </CardContent>
      </Card>
    </div>
  );
}

function EvaluationHeatmap({
  evaluations,
}: {
  evaluations: AttendanceEvaluation[];
}) {
  const cells = useMemo(() => {
    const counts = new Map<string, number>();
    for (const evaluation of evaluations) {
      const date = new Date(evaluation.createdAt);
      const period =
        date.getHours() < 12 ? "Manhã" : date.getHours() < 18 ? "Tarde" : "Noite";
      const key = `${date.getDay()}-${period}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const max = Math.max(1, ...counts.values());
    return { counts, max };
  }, [evaluations]);
  const days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const periods = ["Manhã", "Tarde", "Noite"];

  if (!evaluations.length) {
    return <SmallEmpty text="O mapa será exibido após as primeiras avaliações." />;
  }

  return (
    <div className="grid grid-cols-[3.5rem_repeat(7,minmax(2rem,1fr))] gap-2">
      <span />
      {days.map((day) => (
        <span
          key={day}
          className="text-center text-[10px] text-[var(--muted-foreground)]"
        >
          {day}
        </span>
      ))}
      {periods.map((period) => (
        <div key={period} className="contents">
          <span className="self-center text-[10px] text-[var(--muted-foreground)]">
            {period}
          </span>
          {days.map((_, dayIndex) => {
            const count = cells.counts.get(`${dayIndex}-${period}`) ?? 0;
            return (
              <span
                key={`${period}-${dayIndex}`}
                title={`${count} avaliação(ões)`}
                className="aspect-square rounded-md bg-[var(--primary)]"
                style={{ opacity: count ? 0.2 + (count / cells.max) * 0.8 : 0.06 }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function EvaluationDrawer({
  title,
  description,
  onClose,
  wide = false,
  children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <motion.div
      className="fixed inset-0 z-[90] bg-[color-mix(in_srgb,var(--foreground)_28%,transparent)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <motion.aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 320, damping: 32 }}
        className={cn(
          "ml-auto flex h-full w-full flex-col border-l border-[var(--border)] bg-[var(--background)] shadow-xl",
          wide ? "max-w-4xl" : "max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] p-5">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{title}</h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {description}
            </p>
          </div>
          <IconButton icon={X} label="Fechar painel" onClick={onClose} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
          {children}
        </div>
      </motion.aside>
    </motion.div>
  );
}

function EmptyReviewsState({
  title,
  description,
  icon: Icon,
  embedded = false,
}: {
  title: string;
  description: string;
  icon: typeof MessageSquareText;
  embedded?: boolean;
}) {
  const content = (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-xl bg-[var(--muted)] text-[var(--primary)]">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-[var(--muted-foreground)]">
        {description}
      </p>
    </div>
  );
  return embedded ? content : <Card>{content}</Card>;
}

function ChartEmptyState({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "min-h-48" : "min-h-80",
      )}
    >
      <BarChart3 className="size-8 text-[var(--muted-foreground)]" aria-hidden="true" />
      <p className="mt-3 text-sm font-semibold">Gráfico aguardando avaliações</p>
      <p className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
        Nenhum valor foi simulado. O gráfico será preenchido com respostas reais.
      </p>
    </div>
  );
}

function EvaluationSkeleton() {
  return (
    <div className="space-y-5" aria-label="Carregando avaliações">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-40 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]"
          />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-72 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--muted)]"
          />
        ))}
      </div>
    </div>
  );
}

function SectionHeading({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Trophy;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">
          {description}
        </p>
      </div>
      <Icon className="size-5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
  iconClassName,
}: {
  icon: typeof Download;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  iconClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 text-sm font-medium transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Icon className={cn("size-4", iconClassName)} aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}

function PrimaryButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {label}
    </button>
  );
}

function SecondaryButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-10 rounded-lg border border-[var(--border)] bg-[var(--card)] px-4 text-sm font-medium hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
    >
      {label}
    </button>
  );
}

function IconButton({
  icon: Icon,
  label,
  onClick,
  disabled = false,
}: {
  icon: typeof X;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--card)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function InputControl({
  value,
  onChange,
  type = "text",
  placeholder,
  min,
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      min={min}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
    />
  );
}

function SelectControl({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--ring)]"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

function SellerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] uppercase text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function CompactStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border)] bg-[var(--card)] p-3">
      <p className="text-[10px] uppercase text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold">{value}</p>
    </div>
  );
}

function ComparisonRow({
  label,
  value,
  sellerRating,
}: {
  label: string;
  value: number | null;
  sellerRating: number | null;
}) {
  const difference =
    value === null || sellerRating === null ? null : sellerRating - value;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <p className="text-xl font-semibold">
          {value === null ? "Sem dados" : value.toFixed(1)}
        </p>
        <Badge variant={difference !== null && difference >= 0 ? "secondary" : "muted"}>
          {difference === null
            ? "Aguardando"
            : `${difference >= 0 ? "+" : ""}${difference.toFixed(1)}`}
        </Badge>
      </div>
    </div>
  );
}

function RatingStars({ rating }: { rating: number | null }) {
  return (
    <div
      className="flex items-center gap-0.5"
      aria-label={rating === null ? "Sem avaliação" : `Nota ${rating.toFixed(1)} de 5`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "size-3.5",
            rating !== null && rating >= index + 1
              ? "fill-current text-[var(--primary)]"
              : "text-[var(--border)]",
          )}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

function PerformanceBadge({
  seller,
}: {
  seller: SellerEvaluationPerformance;
}) {
  return (
    <Badge
      variant={
        seller.rating !== null && seller.rating >= 4.5
          ? "secondary"
          : seller.rating !== null && seller.rating < 4
            ? "muted"
            : "primary"
      }
      className={
        seller.rating !== null && seller.rating < 4
          ? "text-[var(--destructive)]"
          : undefined
      }
    >
      {seller.badge}
    </Badge>
  );
}

function StatusBadge({
  status,
}: {
  status: AttendanceEvaluation["status"];
}) {
  const labels = {
    respondido: "Respondido",
    pendente: "Pendente",
    resolvido: "Resolvido",
    oculto: "Oculto",
  };
  return (
    <Badge
      variant={
        status === "resolvido"
          ? "secondary"
          : status === "respondido"
            ? "primary"
            : "muted"
      }
      className={
        status === "pendente" ? "text-[var(--destructive)]" : undefined
      }
    >
      {labels[status]}
    </Badge>
  );
}

function SmallEmpty({ text }: { text: string }) {
  return (
    <div className="flex min-h-32 flex-col items-center justify-center text-center">
      <CircleHelp className="size-6 text-[var(--muted-foreground)]" aria-hidden="true" />
      <p className="mt-2 text-xs text-[var(--muted-foreground)]">{text}</p>
    </div>
  );
}

function EvaluationChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: string | number;
    color?: string;
  }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--popover)] p-3 text-[var(--popover-foreground)] shadow-md">
      <p className="text-xs font-semibold">{label}</p>
      <div className="mt-2 space-y-1">
        {payload.map((item) => (
          <p key={item.name} className="text-xs text-[var(--muted-foreground)]">
            {item.name}:{" "}
            <strong className="text-[var(--foreground)]">{item.value ?? 0}</strong>
          </p>
        ))}
      </div>
    </div>
  );
}

function getRatingIndicatorClass(rating: number | null) {
  if (rating === null) return "bg-[var(--muted-foreground)]";
  if (rating >= 4.8) return "bg-[var(--secondary)]";
  if (rating >= 4.5) return "bg-[var(--primary)]";
  if (rating >= 4) return "bg-[var(--accent)]";
  return "bg-[var(--destructive)]";
}

function formatEvaluationSource(source: AttendanceEvaluation["source"]) {
  const labels: Record<AttendanceEvaluation["source"], string> = {
    link_publico: "Link público",
    whatsapp: "WhatsApp",
    email: "E-mail",
    sms: "SMS",
    qr_code: "QR Code",
  };
  return labels[source];
}

function exportEvaluationCsv(rows: AttendanceEvaluationExportRow[]) {
  const header = [
    "Vendedor",
    "Nota",
    "Avaliações",
    "Vendas",
    "Faturamento",
    "Ticket médio",
    "Clientes",
    "Taxa de recompra",
  ];
  const values = rows.map((row) => [
    row.vendedor,
    row.nota,
    row.avaliacoes,
    row.vendas,
    row.faturamento.toFixed(2),
    row.ticketMedio.toFixed(2),
    row.clientes,
    `${row.taxaRecompra.toFixed(2)}%`,
  ]);
  const csv = [header, ...values]
    .map((line) =>
      line
        .map((value) => `"${String(value).replaceAll('"', '""')}"`)
        .join(";"),
    )
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "avaliacoes-atendimento.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

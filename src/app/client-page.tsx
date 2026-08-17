"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Database,
  Filter,
  Download,
  Eye,
  EyeOff,
  FileText,
  LineChart,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Menu,
  MessageCircle,
  Moon,
  MoreHorizontal,
  Pencil,
  Phone,
  PieChart,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Target,
  Trophy,
  Trash2,
  UserRound,
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
  PieChart as RePieChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  AppInlineLoading,
  AppLoadingMark,
  AppLoadingScreen,
  useAppLoading,
} from "@/components/ui/app-loading";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge as UiBadge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { normalizeBrazilianWhatsAppNumber } from "@/domain/crm/rules";
import type {
  CrmAgendaEvent,
  CrmDashboard,
  ContactChannel,
  ContactOutcome,
  CrmContactRecord,
  CrmContactSaveResult,
  CrmOpportunity,
  CrmDashboardInsights,
  CrmProduct,
  CrmRepurchaseAlert,
  CrmSale,
  CrmSaleItem,
  CrmSessionUser,
  CrmSeller,
  CrmSnapshot,
  CrmUserRole,
  CrmWorkspace,
  RepurchaseAlertStatus,
} from "@/domain/crm/types";
import {
  type AlertViewModel,
  type CrmViewModel,
  type CustomerViewModel,
  formatCurrency,
  crmViewService,
} from "@/services/crm-view-service";
import { buildCrmAttributionSummary, type CrmAttributedSale } from "@/services/crm-attribution-service";
import { resolveWhatsAppGreeting } from "@/services/crm-whatsapp-message-service";

type View =
  | "dashboard"
  | "resultados"
  | "avaliacoes"
  | "clientes"
  | "vendas"
  | "produtos"
  | "perfil"
  | "recuperacao"
  | "recompra"
  | "alerta-manual"
  | "carteira"
  | "vendedores"
  | "saude"
  | "atividades"
  | "campanhas"
  | "oportunidades"
  | "agenda"
  | "ia"
  | "relatorios"
  | "motor-recompra"
  | "sincronizacao"
  | "configuracoes";

type ContactRecord = CrmContactRecord;
type Theme = "light" | "dark";
type CustomerRow = CustomerViewModel;
type AlertRow = AlertViewModel;
type SaleRow = CrmSale;
type SaleItemRow = CrmSaleItem;
type ProductRow = CrmProduct;
type SellerRow = CrmSeller;
type QuickAction = "manual-alert" | "manual-customer" | "opportunity" | "agenda" | "contact";
type ProductCampaign = {
  id: string;
  name: string;
  productIds: string[];
  productQuery: string;
  messageTemplate: string;
  imageName?: string;
  imageDataUrl?: string;
  active: boolean;
  createdAt: string;
};
const LIST_PAGE_SIZE = 20;
const OPPORTUNITY_PAGE_SIZE = 20;
const SESSION_IDLE_TIMEOUT_MS = 60 * 60 * 1000;
const SESSION_IDLE_WARNING_MS = 2 * 60 * 1000;
const SESSION_IDLE_CHECK_INTERVAL_MS = 5 * 1000;
const DASHBOARD_FULL_SNAPSHOT_DELAY_MS = 15 * 1000;
const DASHBOARD_SNAPSHOT_TIMEOUT_MS = 30 * 1000;
const FULL_SNAPSHOT_TIMEOUT_MS = 45 * 1000;
const AUTOMATIC_CONTACT_FOLLOW_UP_DAYS = 7;
const REPURCHASE_ALERT_DAYS_FILTER_STORAGE_KEY = "henndercrm-repurchase-alert-days-filter";
const REPURCHASE_ALERT_PRODUCT_FILTER_STORAGE_KEY = "henndercrm-repurchase-alert-product-filter";
const PRODUCT_CAMPAIGNS_STORAGE_KEY = "henndercrm-product-campaigns";
const PRODUCT_CAMPAIGN_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = [
  "{saudacao}! Tudo bem? Aqui é o {vendedor} do Shopping Rural 🤠.",
  "",
  "Passei aqui porque lembrei de você e vi que já tem um tempinho que não passa por aqui…",
  "Fico à disposição para te atender, está precisando de algo?",
].join("\n");
const AttendanceEvaluationsModule = dynamic(
  () =>
    import(
      "@/features/attendance-evaluations/attendance-evaluations-module"
    ),
  {
    loading: () => (
      <div className="min-h-80">
        <AppInlineLoading label="Carregando avaliações de atendimento" />
      </div>
    ),
  },
);
const crmResultsVisualTokens = {
  "--background": "Canvas",
  "--foreground": "CanvasText",
  "--card": "color-mix(in srgb, Canvas 98%, CanvasText 2%)",
  "--muted": "color-mix(in srgb, CanvasText 5%, Canvas)",
  "--muted-foreground": "color-mix(in srgb, CanvasText 58%, Canvas)",
  "--border": "color-mix(in srgb, CanvasText 12%, Canvas)",
  "--popover": "Canvas",
  "--primary": "light-dark(var(--color-blue-700), var(--color-cyan-400))",
  "--primary-foreground": "light-dark(var(--color-white), var(--color-neutral-950))",
  "--secondary": "light-dark(var(--color-emerald-700), var(--color-emerald-400))",
  "--accent": "light-dark(var(--color-cyan-700), var(--color-blue-400))",
  "--destructive": "light-dark(var(--color-red-700), var(--color-red-400))",
  "--ring": "var(--primary)",
} as CSSProperties & Record<`--${string}`, string>;
const crmResultsMixColors = [
  "var(--primary)",
  "var(--accent)",
  "var(--secondary)",
  "var(--muted-foreground)",
] as const;
type ChatMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
};
type ManagedCrmUser = {
  id: string;
  name: string;
  email: string;
  role: CrmUserRole;
  sellerId?: string | null;
  active: boolean;
  whatsAppMessage?: string;
};
type ManualCustomerSaveResult = {
  id: string;
  uniplusId: number | null;
  name: string;
  phone: string;
  whatsapp: string;
  city: string;
  category: string;
  purchaseCycleDays: number;
  qualityScore: number;
  qualityStatus: CustomerRow["qualityStatus"];
  sellerId?: string;
  sellerName?: string;
};
type CrmNotification = {
  id: string;
  title: string;
  description: string;
  tone: "red" | "amber" | "cyan" | "emerald";
  customerId?: string;
  view?: View;
  source?: "local" | "remote";
};
type NotificationApiResponse = {
  notifications?: CrmNotification[];
  process?: {
    ok: boolean;
    schemaReady: boolean;
    error?: string;
  };
  push?: {
    configured: boolean;
    publicKey: string;
  };
  error?: string;
};
type SyncLogResponse = {
  date: string;
  window?: {
    from: string;
    to: string;
  };
  latest: {
    id: string;
    status: "iniciada" | "concluida" | "erro";
    inicio: string;
    fim: string | null;
    total_lidos: number;
    total_importados: number;
    total_ignorados: number;
    erro: string | null;
  } | null;
  summary: {
    status: "ok" | "atencao" | "erro" | "em_execucao" | "sem_execucao";
    runs: number;
    completedRuns: number;
    errorRuns: number;
    read: number;
    imported: number;
    ignored: number;
  };
  sales?: {
    todayImported: number;
    todayLatest: {
      id: string;
      uniplus_id: number;
      data_venda: string;
      updated_at: string;
    } | null;
    latest: {
      id: string;
      uniplus_id: number;
      data_venda: string;
      updated_at: string;
    } | null;
  };
  recentRuns?: Array<{
    id: string;
    status: "iniciada" | "concluida" | "erro";
    inicio: string;
    fim: string | null;
    total_lidos: number;
    total_importados: number;
    total_ignorados: number;
    erro: string | null;
  }>;
  errors: Array<{
    id: string;
    type: "sync_error" | "ignored_sale";
    at: string;
    saleId: number | null;
    reason: string;
    message: string;
  }>;
};
type CustomerContactUpdate = {
  customerId: string;
  phone: string;
  whatsapp: string;
  customerName?: string;
  invalidatedContactIds?: string[];
};
type CustomerContactUpdateOptions = {
  retryWhatsApp?: boolean;
};

const contactOutcomeLabels: Record<ContactOutcome, string> = {
  not_interested: "Cliente não quis",
  follow_up: "Pediu contato mais tarde",
  no_answer: "Não respondeu",
  interested: "Demonstrou interesse",
  invalid_number: "Número inválido",
};

const emptyDashboard: CrmDashboard = {
  activeCustomers: 0,
  attentionCustomers: 0,
  riskCustomers: 0,
  lostCustomers: 0,
  alertsToday: 0,
  recoverableRevenue: 0,
  potentialLost: 0,
  averageRegistrationQuality: 0,
};
const emptySnapshot: CrmSnapshot = {
  referenceDate: new Date().toISOString().slice(0, 10),
  dashboard: emptyDashboard,
  customers: [],
  sellers: [],
  products: [],
  sales: [],
  saleItems: [],
  alerts: [],
  opportunities: [],
  agenda: [],
};
let crmViewModel = crmViewService.getViewModel(emptySnapshot);
let { snapshot, customers, alerts } = crmViewModel;
let { sellers, sales, saleItems, dashboard } = snapshot;
let crmReferenceDate = snapshot.referenceDate;

function setRuntimeViewModel(next: CrmViewModel) {
  crmViewModel = next;
  ({ snapshot, customers, alerts } = crmViewModel);
  ({ sellers, sales, saleItems, dashboard } = snapshot);
  crmReferenceDate = snapshot.referenceDate;
}

type NavItem = { id: View; label: string; description: string; icon: typeof Activity };
type NavGroup = { title: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    title: "Visão Geral",
    items: [
      { id: "dashboard", label: "Dashboard", description: "Resumo dos principais indicadores comerciais.", icon: BarChart3 },
      { id: "resultados", label: "Resultados do CRM", description: "Impacto financeiro, recuperação e ROI comercial.", icon: LineChart },
    ],
  },
  {
    title: "Comercial",
    items: [
      { id: "clientes", label: "Clientes", description: "Consulte a carteira e o histórico dos clientes.", icon: UsersRound },
      { id: "recuperacao", label: "Clientes sem compra", description: "Fila de clientes parados, potencial e ações de recuperação.", icon: AlertTriangle },
      { id: "vendas", label: "Vendas", description: "Vendas importadas, itens e rastreabilidade do ERP.", icon: ShoppingBag },
      { id: "produtos", label: "Produtos", description: "Produtos, recompra ativa e potencial recorrente.", icon: ClipboardList },
      { id: "recompra", label: "Alertas", description: "Acompanhe clientes no momento ideal de recompra.", icon: Bell },
      { id: "alerta-manual", label: "Criar alerta", description: "Cadastre alerta manual de recompra em uma tela separada.", icon: Plus },
      { id: "oportunidades", label: "Oportunidades", description: "Veja sugestões de vendas e produtos relacionados.", icon: Target },
      { id: "agenda", label: "Agenda", description: "Organize contatos, visitas e retornos comerciais.", icon: CalendarDays },
    ],
  },
  {
    title: "Equipe",
    items: [
      { id: "carteira", label: "Carteira", description: "Acompanhe clientes, alertas e potencial por vendedor.", icon: UserRound },
      { id: "vendedores", label: "Vendedores", description: "Performance, risco, potencial e conversões por vendedor.", icon: UsersRound },
    ],
  },
  {
    title: "Inteligência",
    items: [
      { id: "saude", label: "Saúde da base", description: "Monitore a qualidade dos cadastros dos clientes.", icon: ShieldCheck },
      { id: "atividades", label: "Atividades", description: "Histórico de contatos, retornos e ações realizadas.", icon: Phone },
      { id: "avaliacoes", label: "Avaliações", description: "Qualidade do atendimento e performance por vendedor.", icon: Star },
      { id: "campanhas", label: "Campanhas", description: "Ações comerciais em lote e públicos de recompra.", icon: Sparkles },
      { id: "ia", label: "IA Comercial", description: "Receba análises e recomendações para vender melhor.", icon: Bot },
      { id: "relatorios", label: "Relatórios", description: "Analise resultados, recuperação e recorrência.", icon: PieChart },
    ],
  },
  {
    title: "Sistema",
    items: [
      { id: "motor-recompra", label: "Motor de Recompra", description: "Regras por produto, departamento e palavra-chave.", icon: SlidersHorizontal },
      { id: "sincronizacao", label: "Logs e Sincronização", description: "Resumo diário do Hennder Sync, erros e reprocessamentos.", icon: RefreshCcw },
      { id: "configuracoes", label: "Configurações", description: "Usuários, permissões, empresa e parâmetros.", icon: Settings },
    ],
  },
];

const sellerAllowedViews: View[] = [
  "dashboard",
  "clientes",
  "vendas",
  "produtos",
  "perfil",
  "recuperacao",
  "recompra",
  "alerta-manual",
  "carteira",
  "atividades",
  "oportunidades",
  "agenda",
  "ia",
  "relatorios",
  "configuracoes",
];
const supervisorBlockedViews: View[] = ["configuracoes"];
export default function Home() {
  const { runWithLoading } = useAppLoading();
  const [user, setUser] = useState<CrmSessionUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [snapshotChecking, setSnapshotChecking] = useState(true);
  const [snapshotError, setSnapshotError] = useState("");
  const [snapshotReloadKey, setSnapshotReloadKey] = useState(0);
  const [fullSnapshotChecking, setFullSnapshotChecking] = useState(false);
  const [fullSnapshotReady, setFullSnapshotReady] = useState(false);
  const [fullSnapshotError, setFullSnapshotError] = useState("");
  const [fullSnapshotReloadKey, setFullSnapshotReloadKey] = useState(0);
  const [dashboardInsights, setDashboardInsights] = useState<CrmDashboardInsights>();
  const [, refreshRuntimeViewModel] = useState(0);
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerRow | undefined>(undefined);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contactRecords, setContactRecords] = useState<ContactRecord[]>([]);
  const [alertStatuses, setAlertStatuses] = useState<Record<string, RepurchaseAlertStatus>>({});
  const [agendaItems, setAgendaItems] = useState<CrmAgendaEvent[]>(snapshot.agenda);
  const [opportunityItems, setOpportunityItems] = useState<CrmOpportunity[]>(snapshot.opportunities);
  const [theme, setTheme] = useState<Theme>("light");
  const [manualCustomers, setManualCustomers] = useState<CustomerRow[]>([]);
  const [manualAlerts, setManualAlerts] = useState<AlertRow[]>([]);
  const [productCampaigns, setProductCampaigns] = useState<ProductCampaign[]>([]);
  const [productCampaignsLoaded, setProductCampaignsLoaded] = useState(false);
  const [customerContactUpdates, setCustomerContactUpdates] = useState<Record<string, CustomerContactUpdate>>({});
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<string[]>([]);
  const [remoteNotifications, setRemoteNotifications] = useState<CrmNotification[]>([]);
  const [notificationSchemaReady, setNotificationSchemaReady] = useState(true);
  const [notificationError, setNotificationError] = useState("");
  const [pushStatus, setPushStatus] = useState<"idle" | "activating" | "active" | "blocked" | "unsupported">("idle");
  const [pushTestStatus, setPushTestStatus] = useState("");
  const [devicePushTestStatus, setDevicePushTestStatus] = useState("");
  const [resultsRefreshing, setResultsRefreshing] = useState(false);
  const [resultsUpdatedAt, setResultsUpdatedAt] = useState<string | null>(null);
  const [resultsRefreshError, setResultsRefreshError] = useState("");
  const [idleWarningRemainingMs, setIdleWarningRemainingMs] = useState<number | null>(null);
  const sessionIdleLogoutRef = useRef(false);
  const renewIdleSessionRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12000);

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = response.ok
          ? ((await response.json()) as { user: CrmSessionUser | null })
          : { user: null };
        const nextUser = result.user ?? null;

        if (!active) return;
        setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
        setDismissedNotificationIds(nextUser ? readDismissedNotificationIds(nextUser.id, crmReferenceDate) : []);
        setUser(nextUser);
      } catch {
        if (!active) return;
        setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
        setDismissedNotificationIds([]);
        setUser(null);
      } finally {
        window.clearTimeout(timeout);
        if (active) {
          setAuthChecking(false);
        }
      }
    }

    void loadSession();

    return () => {
      active = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    setProductCampaigns(readProductCampaigns());
    setProductCampaignsLoaded(true);
  }, []);

  useEffect(() => {
    if (!productCampaignsLoaded) return;
    writeProductCampaigns(productCampaigns);
  }, [productCampaigns, productCampaignsLoaded]);

  useEffect(() => {
    if (!user) return;

    const activityStorageKey = getSessionActivityStorageKey(user.id);
    let lastActivityAt = readSessionActivity(activityStorageKey) ?? Date.now();
    let lastPersistedAt = lastActivityAt;
    let active = true;
    sessionIdleLogoutRef.current = false;
    writeSessionActivity(activityStorageKey, lastActivityAt);

    const expireIdleSession = async () => {
      if (sessionIdleLogoutRef.current) return;
      sessionIdleLogoutRef.current = true;
      clearSessionActivity(activityStorageKey);

      try {
        await fetch("/api/auth/session", { method: "DELETE" });
      } finally {
        if (!active) return;
        setIdleWarningRemainingMs(null);
        setDismissedNotificationIds([]);
        setUser(null);
        setActiveView("dashboard");
      }
    };

    const checkIdleSession = () => {
      if (!active || sessionIdleLogoutRef.current) return;
      const remainingMs = SESSION_IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt);
      if (remainingMs <= 0) {
        void expireIdleSession();
        return;
      }
      setIdleWarningRemainingMs(remainingMs <= SESSION_IDLE_WARNING_MS ? remainingMs : null);
    };

    const recordActivity = () => {
      if (!active || sessionIdleLogoutRef.current) return;
      const now = Date.now();
      lastActivityAt = now;
      setIdleWarningRemainingMs(null);
      if (now - lastPersistedAt >= 15_000) {
        lastPersistedAt = now;
        writeSessionActivity(activityStorageKey, now);
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") checkIdleSession();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== activityStorageKey) return;
      if (!event.newValue) {
        void expireIdleSession();
        return;
      }
      const sharedActivityAt = Number(event.newValue);
      if (!Number.isFinite(sharedActivityAt) || sharedActivityAt <= lastActivityAt) return;
      lastActivityAt = sharedActivityAt;
      lastPersistedAt = sharedActivityAt;
      setIdleWarningRemainingMs(null);
    };

    renewIdleSessionRef.current = recordActivity;
    document.addEventListener("pointerdown", recordActivity, { passive: true });
    document.addEventListener("keydown", recordActivity);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", checkIdleSession);
    window.addEventListener("storage", handleStorage);
    const timer = window.setInterval(checkIdleSession, SESSION_IDLE_CHECK_INTERVAL_MS);
    const initialCheckTimer = window.setTimeout(checkIdleSession, 0);

    return () => {
      active = false;
      renewIdleSessionRef.current = () => undefined;
      document.removeEventListener("pointerdown", recordActivity);
      document.removeEventListener("keydown", recordActivity);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", checkIdleSession);
      window.removeEventListener("storage", handleStorage);
      window.clearInterval(timer);
      window.clearTimeout(initialCheckTimer);
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const sessionUser = user;
    let active = true;
    let requestController: AbortController | undefined;

    async function loadSnapshot() {
      setSnapshotChecking(true);
      setSnapshotError("");
      setFullSnapshotReady(false);
      setFullSnapshotError("");
      setDashboardInsights(undefined);

      for (let attempt = 0; attempt < 2; attempt += 1) {
        requestController = new AbortController();
        const timeout = window.setTimeout(
          () => requestController?.abort(),
          DASHBOARD_SNAPSHOT_TIMEOUT_MS,
        );

        try {
          const response = await fetch("/api/crm/snapshot?mode=dashboard", {
            cache: "no-store",
            signal: requestController.signal,
          });
          const result = (await response.json()) as CrmSnapshot & { error?: string };
          if (!response.ok) {
            throw new Error(result.error ?? "Não foi possível carregar os dados do CRM.");
          }
          if (!active) return;
          const nextViewModel = crmViewService.getViewModel(result);
          setRuntimeViewModel(nextViewModel);
          setDashboardInsights(result.dashboardInsights);
          setDismissedNotificationIds(
            readDismissedNotificationIds(sessionUser.id, nextViewModel.snapshot.referenceDate),
          );
          setAgendaItems(nextViewModel.snapshot.agenda);
          setOpportunityItems(nextViewModel.snapshot.opportunities);
          setSelectedCustomer(nextViewModel.customers[0]);
          refreshRuntimeViewModel((version) => version + 1);
          setSnapshotChecking(false);
          return;
        } catch (error) {
          if (!active) return;
          if (attempt === 0) {
            await new Promise((resolve) => window.setTimeout(resolve, 900));
            if (!active) return;
            continue;
          }
          setSnapshotError(
            error instanceof DOMException && error.name === "AbortError"
              ? "O carregamento demorou além do esperado."
              : error instanceof Error
                ? error.message
                : "Não foi possível carregar os dados do CRM.",
          );
        } finally {
          window.clearTimeout(timeout);
        }
      }

      if (active) setSnapshotChecking(false);
    }

    void loadSnapshot();

    return () => {
      active = false;
      requestController?.abort();
    };
  }, [snapshotReloadKey, user]);

  useEffect(() => {
    if (!user || snapshotChecking || fullSnapshotReady) return;
    const sessionUser = user;
    let active = true;
    const controller = new AbortController();
    const delay = activeView === "dashboard" ? DASHBOARD_FULL_SNAPSHOT_DELAY_MS : 0;
    const timer = window.setTimeout(async () => {
      setFullSnapshotChecking(true);
      setFullSnapshotError("");
      const timeout = window.setTimeout(() => controller.abort(), FULL_SNAPSHOT_TIMEOUT_MS);
      try {
        const response = await fetch("/api/crm/snapshot", {
          cache: "no-store",
          signal: controller.signal,
        });
        const result = (await response.json()) as CrmSnapshot & { error?: string };
        if (!response.ok) {
          throw new Error(result.error ?? "NÃ£o foi possÃ­vel carregar os dados completos.");
        }
        if (!active) return;
        const nextViewModel = crmViewService.getViewModel(result);
        setRuntimeViewModel(nextViewModel);
        setDashboardInsights(undefined);
        setDismissedNotificationIds(
          readDismissedNotificationIds(sessionUser.id, nextViewModel.snapshot.referenceDate),
        );
        setAgendaItems(nextViewModel.snapshot.agenda);
        setOpportunityItems(nextViewModel.snapshot.opportunities);
        setSelectedCustomer((current) =>
          nextViewModel.customers.find((customer) => customer.id === current?.id) ??
          nextViewModel.customers[0],
        );
        refreshRuntimeViewModel((version) => version + 1);
        setFullSnapshotReady(true);
      } catch (error) {
        if (active) {
          setFullSnapshotReady(false);
          setFullSnapshotError(
            error instanceof DOMException && error.name === "AbortError"
              ? "O carregamento dos dados detalhados demorou além do esperado."
              : error instanceof Error
                ? error.message
                : "Não foi possível carregar os dados detalhados.",
          );
        }
      } finally {
        window.clearTimeout(timeout);
        if (active) setFullSnapshotChecking(false);
      }
    }, delay);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeView, fullSnapshotReady, fullSnapshotReloadKey, snapshotChecking, user]);

  useEffect(() => {
    if (!user || snapshotChecking) return;
    void fetch("/api/crm/workspace", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar o workspace.");
        return response.json() as Promise<CrmWorkspace>;
      })
      .then((workspace) => {
        setContactRecords(workspace.contacts);
        setAlertStatuses(workspace.alertStatuses);
        setAgendaItems(workspace.agenda);
        setOpportunityItems(workspace.opportunities);
      })
      .catch(() => {
        setContactRecords([]);
        setAlertStatuses({});
      });
  }, [snapshotChecking, user]);

  useEffect(() => {
    if (!user || snapshotChecking) return;
    let active = true;

    async function loadNotifications() {
      try {
        const response = await fetch("/api/crm/notifications", { cache: "no-store" });
        const result = (await response.json()) as NotificationApiResponse;
        if (!active) return;
        if (!response.ok) throw new Error(result.error ?? "Nao foi possivel carregar notificacoes.");

        setRemoteNotifications(
          (result.notifications ?? []).map((notification) => ({
            ...notification,
            source: "remote" as const,
          })),
        );
        setNotificationSchemaReady(result.process?.schemaReady ?? true);
        setNotificationError(result.process?.error ?? "");
      } catch (error) {
        if (!active) return;
        setRemoteNotifications([]);
        setNotificationError(error instanceof Error ? error.message : "Nao foi possivel carregar notificacoes.");
      }
    }

    void loadNotifications();
    const timer = window.setInterval(loadNotifications, 60_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [snapshotChecking, user]);

  useEffect(() => {
    if (!user) return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      queueMicrotask(() => setPushStatus("unsupported"));
      return;
    }
    if (Notification.permission === "denied") {
      queueMicrotask(() => setPushStatus("blocked"));
      return;
    }
    if (Notification.permission !== "granted") return;

    let active = true;
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        if (active && subscription) setPushStatus("active");
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [user]);

  async function refreshResultsData() {
    if (!user || resultsRefreshing) return;
    setResultsRefreshing(true);
    setResultsRefreshError("");

    try {
      await runWithLoading(
        async () => {
          const [snapshotResponse, workspaceResponse] = await Promise.all([
            fetch(`/api/crm/snapshot?refresh=1&t=${Date.now()}`, { cache: "no-store" }),
            fetch(`/api/crm/workspace?t=${Date.now()}`, { cache: "no-store" }),
          ]);
          const snapshotResult = (await snapshotResponse.json()) as CrmSnapshot & { error?: string };
          const workspaceResult = (await workspaceResponse.json()) as CrmWorkspace & { error?: string };
          if (!snapshotResponse.ok) {
            throw new Error(snapshotResult.error ?? "Não foi possível atualizar os resultados.");
          }
          if (!workspaceResponse.ok) {
            throw new Error(workspaceResult.error ?? "Não foi possível atualizar os contatos.");
          }

          const nextViewModel = crmViewService.getViewModel(snapshotResult);
          setRuntimeViewModel(nextViewModel);
          setDashboardInsights(undefined);
          setFullSnapshotReady(true);
          setDismissedNotificationIds(
            readDismissedNotificationIds(user.id, nextViewModel.snapshot.referenceDate),
          );
          setContactRecords(workspaceResult.contacts);
          setAlertStatuses(workspaceResult.alertStatuses);
          setAgendaItems(workspaceResult.agenda);
          setOpportunityItems(workspaceResult.opportunities);
          setSelectedCustomer((current) =>
            nextViewModel.customers.find((customer) => customer.id === current?.id) ??
            nextViewModel.customers[0],
          );
          refreshRuntimeViewModel((version) => version + 1);
        },
        { label: "Atualizando resultados do CRM" },
      );
      setResultsUpdatedAt(new Date().toISOString());
    } catch (error) {
      setResultsRefreshError(
        error instanceof Error ? error.message : "Não foi possível atualizar os resultados.",
      );
    } finally {
      setResultsRefreshing(false);
    }
  }

  function openView(view: View) {
    setActiveView(view);
    if (user && view === "resultados" && canAccessView(user, view)) {
      void refreshResultsData();
    }
  }

  if (authChecking) {
    return <AppLoadingScreen label="Carregando sessão comercial" />;
  }


  if (!user) {
    return (
      <LoginScreen
        onLogin={(email, password) =>
          runWithLoading(
            async () => {
              const response = await fetch("/api/auth/session", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ email, password }),
              });
              const result = (await response.json()) as {
                user?: CrmSessionUser;
                error?: string;
              };
              if (!response.ok || !result.user) {
                throw new Error(result.error ?? "Não foi possível entrar.");
              }
              setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
              writeSessionActivity(getSessionActivityStorageKey(result.user.id), Date.now());
              setDismissedNotificationIds(readDismissedNotificationIds(result.user.id, crmReferenceDate));
              setUser(result.user);
            },
            { label: "Validando acesso" },
          )
        }
      />
    );
  }

  const scopedData = applyCustomerContactUpdates(
    buildScopedCrmData(user, manualCustomers, manualAlerts, agendaItems, opportunityItems),
    customerContactUpdates,
  );
  const appCustomers = scopedData.customers;
  const appSaleCustomers = includeSaleCustomers(
    appCustomers,
    applyCustomerListContactUpdates(customers, customerContactUpdates),
    scopedData.sales,
  );
  const appAlerts = scopedData.alerts.map((alert) => ({
    ...alert,
    status: alertStatuses[alert.id] ?? alert.status,
  }));
  const appContactRecords = filterContactRecordsForData(contactRecords, appCustomers);
  const safeSelectedCustomer =
    appCustomers.find((customer) => customer.id === selectedCustomer?.id) ??
    appCustomers[0] ??
    selectedCustomer;
  const visibleView = canAccessView(user, activeView) ? activeView : "dashboard";
  const fullDataViewLoading = visibleView !== "dashboard" && !fullSnapshotReady;
  const notificationContacts = filterNotificationContactRecordsForUser(user, appContactRecords);
  const generatedNotifications = buildTopbarNotifications(appCustomers, appAlerts, notificationContacts, scopedData.agenda)
    .map((notification) => ({ ...notification, source: "local" as const }));
  const dismissedNotifications = new Set(dismissedNotificationIds);
  const notifications = mergeNotifications(remoteNotifications, generatedNotifications)
    .filter((notification) => !dismissedNotifications.has(notification.id));

  if (!safeSelectedCustomer) {
    if (snapshotChecking) {
      return (
        <AuthenticatedLoadingShell
          activeView={activeView}
          mobileOpen={mobileOpen}
          setActiveView={setActiveView}
          setMobileOpen={setMobileOpen}
          theme={theme}
          user={user}
          onThemeChange={(nextTheme) => {
            setTheme(nextTheme);
            document.documentElement.dataset.theme = nextTheme;
            localStorage.setItem("henndercrm-theme", nextTheme);
            localStorage.removeItem("agrocrm-theme");
          }}
          onLogout={() =>
            runWithLoading(
              async () => {
                await fetch("/api/auth/session", { method: "DELETE" });
                clearSessionActivity(getSessionActivityStorageKey(user.id));
                setDismissedNotificationIds([]);
                setUser(null);
                setActiveView("dashboard");
              },
              { label: "Encerrando sessão" },
            )
          }
        />
      );
    }

    if (snapshotError) {
      return (
        <SystemEmptyScreen
          label="Não foi possível carregar o CRM"
          detail={`${snapshotError} Verifique sua conexão e tente novamente.`}
          actionLabel="Tentar novamente"
          onAction={() => setSnapshotReloadKey((current) => current + 1)}
        />
      );
    }

    return (
      <SystemEmptyScreen
        label="CRM sem dados sincronizados"
        detail="Rode o Hennder Sync para carregar as vendas reais do Uniplus no Supabase."
      />
    );
  }

  const openProfile = (customer: CustomerRow) => {
    setSelectedCustomer(customer);
    setActiveView("perfil");
    setMobileOpen(false);
  };

  const registerContact = async (record: Omit<ContactRecord, "id">) => {
    const customer = appCustomers.find((item) => item.id === record.customerId);
    const loggedSeller = user.sellerId ? resolveSellerForUser(user.sellerId) : undefined;
    const sellerId = loggedSeller?.id ?? record.sellerId ?? customer?.preferredSellerId;
    const seller = sellerId ? sellers.find((item) => item.id === sellerId) : undefined;
    const result = await mutateWorkspace<CrmContactSaveResult>({
      action: "create_contact",
      record: {
        ...record,
        sellerId,
        responsible: seller?.name ?? record.responsible,
      },
    });
    const saved = result.contact;
    setContactRecords((current) =>
      current.some((item) => String(item.id) === String(saved.id))
        ? current
        : [saved, ...current],
    );
    setAgendaItems((current) => {
      const removedIds = new Set(result.removedFollowUpIds);
      const next = current.filter(
        (event) => !removedIds.has(event.id) && event.id !== result.followUp?.id,
      );
      if (result.followUp) next.push(result.followUp);
      return next.sort(compareAgendaEvents);
    });
  };

  const createManualCustomer = async (customer: CustomerRow) => {
    const saved = await mutateWorkspace<ManualCustomerSaveResult>({
      action: "create_manual_customer",
      customer: {
        name: customer.name,
        phone: customer.phone,
        whatsapp: customer.whatsapp,
        city: customer.city,
        category: customer.category,
        purchaseCycleDays: customer.purchaseCycleDays,
        sellerId: customer.preferredSellerId,
      },
    });
    const persistedCustomer = materializeManualCustomer(customer, saved);
    setManualCustomers((current) => [
      persistedCustomer,
      ...current.filter((item) => item.id !== customer.id && item.id !== persistedCustomer.id),
    ]);
    setSelectedCustomer(persistedCustomer);
    setActiveView("perfil");
  };

  const updateAlertStatus = async (id: string, status: RepurchaseAlertStatus) => {
    if (id.startsWith("manual-alert-")) {
      setManualAlerts((current) =>
        current.map((item) => (item.id === id ? { ...item, status } : item)),
      );
      setAlertStatuses((current) => ({ ...current, [id]: status }));
      return;
    }

    await mutateWorkspace({ action: "update_alert", id, status });
    setAlertStatuses((current) => ({ ...current, [id]: status }));
  };

  const createManualAlert = async (alert: AlertRow, note = "") => {
    const saved = await mutateWorkspace<CrmRepurchaseAlert>({
      action: "create_manual_alert",
      alert: {
        customerId: alert.customerId,
        productName: alert.product,
        recommendedIso: alert.recommendedIso,
        recurrenceDays: Number.parseInt(alert.days, 10) || 45,
        priority: alert.priorityCode,
        sellerId: alert.sellerId,
        note,
      },
    });
    const viewAlert = mapRepurchaseAlertToAlertRow(saved);
    setManualAlerts((current) => [
      viewAlert,
      ...current.filter((item) => item.id !== viewAlert.id),
    ]);
    setAlertStatuses((current) => ({ ...current, [viewAlert.id]: viewAlert.status }));
  };

  const saveAgendaEvent = async (
    event: Omit<CrmAgendaEvent, "id">,
    id?: string,
  ) => {
    const saved = await mutateWorkspace<CrmAgendaEvent>(
      id
        ? { action: "update_agenda", id, event }
        : { action: "create_agenda", event },
    );
    setAgendaItems((current) =>
      id
        ? current.map((item) => (item.id === id ? saved : item))
        : [...current, saved],
    );
  };

  const deleteAgendaEvent = async (id: string) => {
    await mutateWorkspace({ action: "delete_agenda", id });
    setAgendaItems((current) => current.filter((item) => item.id !== id));
  };

  const saveOpportunity = async (
    opportunity: Omit<CrmOpportunity, "id">,
    id?: string,
  ) => {
    const saved = await mutateWorkspace<CrmOpportunity>(
      id
        ? { action: "update_opportunity", id, opportunity }
        : { action: "create_opportunity", opportunity },
    );
    setOpportunityItems((current) =>
      id
        ? current.map((item) => (item.id === id ? saved : item))
        : [saved, ...current],
    );
  };

  const deleteOpportunity = async (id: string) => {
    await mutateWorkspace({ action: "delete_opportunity", id });
    setOpportunityItems((current) => current.filter((item) => item.id !== id));
  };

  const updateCustomerContact = async (
    customer: CustomerRow,
    rawPhone: string,
    options: CustomerContactUpdateOptions = {},
  ) => {
    const normalized = normalizeBrazilianWhatsAppNumber(rawPhone);
    if (!normalized) {
      throw new Error("Informe um WhatsApp valido com DDD. Exemplo: (33) 99999-9999.");
    }

    const contactSellerId = resolveContactSellerId(user, customer);
    const localInvalidatedContactIds = options.retryWhatsApp
      ? contactRecords
          .filter(
            (record) =>
              record.customerId === customer.id &&
              record.channel === "WhatsApp" &&
              (!contactSellerId || record.sellerId === contactSellerId) &&
              record.outcome !== "invalid_number" &&
              isAutomaticContactRecord(record) &&
              isContactFromToday(record.contactedAt),
          )
          .slice(0, 1)
          .map((record) => String(record.id))
      : [];

    const update: CustomerContactUpdate = customer.id.startsWith("manual-customer-")
      ? {
          customerId: customer.id,
          customerName: customer.name,
          phone: rawPhone.trim(),
          whatsapp: rawPhone.trim(),
          invalidatedContactIds: localInvalidatedContactIds,
        }
      : await mutateWorkspace<CustomerContactUpdate>({
          action: "update_customer_contact",
          contact: {
            customerId: customer.id,
            phone: rawPhone.trim(),
            whatsapp: rawPhone.trim(),
            sellerId: contactSellerId,
            retryWhatsApp: options.retryWhatsApp,
          },
        });

    const invalidatedContactIds = new Set(update.invalidatedContactIds ?? []);
    if (invalidatedContactIds.size) {
      setContactRecords((current) =>
        current.map((record) =>
          invalidatedContactIds.has(String(record.id))
            ? { ...record, outcome: "invalid_number" }
            : record,
        ),
      );
    }
    if (options.retryWhatsApp) clearAutomaticContactIntent(customer.id);

    setCustomerContactUpdates((current) => ({
      ...current,
      [customer.id]: update,
    }));
    setManualCustomers((current) =>
      current.map((item) => (item.id === customer.id ? patchCustomerContact(item, update) : item)),
    );
    setSelectedCustomer((current) =>
      current?.id === customer.id ? patchCustomerContact(current, update) : current,
    );
  };

  const changeTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("henndercrm-theme", nextTheme);
    localStorage.removeItem("agrocrm-theme");
  };

  const clearNotifications = async () => {
    if (!notifications.length) return;
    const nextDismissed = [...new Set([...dismissedNotificationIds, ...notifications.map((notification) => notification.id)])];
    setDismissedNotificationIds(nextDismissed);
    localStorage.setItem(getNotificationStorageKey(user.id, crmReferenceDate), JSON.stringify(nextDismissed));
    setRemoteNotifications([]);
    try {
      await fetch("/api/crm/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "clear_all" }),
      });
    } catch {
      // Local dismissal keeps the CRM usable if the remote inbox is temporarily unavailable.
    }
  };

  const enablePushNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPushStatus("unsupported");
      return;
    }

    setPushStatus("activating");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("blocked");
        return;
      }

      const keyResponse = await fetch("/api/crm/push-subscription", { cache: "no-store" });
      const keyResult = (await keyResponse.json()) as { configured: boolean; publicKey: string; error?: string };
      if (!keyResponse.ok || !keyResult.configured || !keyResult.publicKey) {
        throw new Error(keyResult.error ?? "Push ainda nao configurado no servidor.");
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(keyResult.publicKey),
        }));

      const response = await fetch("/api/crm/push-subscription", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        const result = (await response.json()) as { error?: string };
        throw new Error(result.error ?? "Nao foi possivel ativar push.");
      }
      setPushStatus("active");
    } catch (error) {
      setPushStatus("idle");
      setNotificationError(error instanceof Error ? error.message : "Nao foi possivel ativar push.");
    }
  };

  const sendTestNotificationToAllUsers = async () => {
    setPushTestStatus("Enviando teste...");
    try {
      const response = await fetch("/api/crm/notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "test_all" }),
      });
      const result = (await response.json()) as {
        created?: { recipients: number };
        push?: { sent: number; skipped: number };
        error?: string;
      };
      if (!response.ok) throw new Error(result.error ?? "Nao foi possivel enviar o teste.");
      setPushTestStatus(
        `Teste criado para ${result.created?.recipients ?? 0} usuarios. Push entregue em ${result.push?.sent ?? 0} aparelho(s).`,
      );
      setTimeout(() => setPushTestStatus(""), 8_000);
    } catch (error) {
      setPushTestStatus(error instanceof Error ? error.message : "Falha ao enviar teste.");
    }
  };

  const sendDeviceNotificationTest = async () => {
    setDevicePushTestStatus("Testando aparelho...");
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        setPushStatus("unsupported");
        setDevicePushTestStatus("Este navegador nao suporta notificacoes do PWA.");
        return;
      }

      const permission =
        Notification.permission === "granted"
          ? "granted"
          : await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("blocked");
        setDevicePushTestStatus("Permissao de notificacao nao foi liberada neste aparelho.");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification("Hennder CRM", {
        body: "Teste local: esta notificacao deve aparecer na barra do celular.",
        icon: "/icons/hennder-icon-192.png",
        badge: "/icons/hennder-icon-96.png",
        tag: `hennder-device-test-${Date.now()}`,
        requireInteraction: true,
        silent: false,
        data: { url: "/" },
      });
      setDevicePushTestStatus("Teste enviado para a barra do aparelho.");
      setTimeout(() => setDevicePushTestStatus(""), 8_000);
    } catch (error) {
      setDevicePushTestStatus(error instanceof Error ? error.message : "Falha ao testar este aparelho.");
    }
  };

  return (
    <main className="crm-app min-h-screen bg-[#eaf3fb] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar
          activeView={activeView}
          setActiveView={openView}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          user={user}
        />
        <section className="crm-content min-w-0 flex-1 bg-[linear-gradient(135deg,#edf7ff_0%,#f5f9ff_48%,#eaf3fb_100%)]">
          <Topbar
            onMenu={() => setMobileOpen(true)}
            theme={theme}
            onThemeChange={changeTheme}
            user={user}
            customers={appCustomers}
            notifications={notifications}
            notificationSchemaReady={notificationSchemaReady}
            notificationError={notificationError}
            pushStatus={pushStatus}
            pushTestStatus={pushTestStatus}
            devicePushTestStatus={devicePushTestStatus}
            onOpenCustomer={openProfile}
            onOpenView={openView}
            onClearNotifications={clearNotifications}
            onEnablePush={enablePushNotifications}
            onTestDevicePush={sendDeviceNotificationTest}
            onSendTestNotifications={sendTestNotificationToAllUsers}
            onQuickAction={setQuickAction}
            onLogout={() =>
              runWithLoading(
                async () => {
                  await fetch("/api/auth/session", { method: "DELETE" });
                  clearSessionActivity(getSessionActivityStorageKey(user.id));
                  setDismissedNotificationIds([]);
                  setUser(null);
                  setActiveView("dashboard");
                },
                { label: "Encerrando sessão" },
              )
            }
          />
          <motion.div
            key={visibleView}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
            className="mx-auto w-full max-w-[1560px] px-3 py-4 sm:px-5 lg:px-6"
          >
            {fullDataViewLoading ? (
              <DeferredDataLoading
                activeView={visibleView}
                loading={fullSnapshotChecking}
                error={fullSnapshotError}
                onRetry={() => setFullSnapshotReloadKey((current) => current + 1)}
              />
            ) : (
              <>
            {visibleView === "dashboard" && (
              <Dashboard
                customers={appCustomers}
                openProfile={openProfile}
                contactRecords={appContactRecords}
                agenda={scopedData.agenda}
                openRecovery={() => setActiveView("recuperacao")}
                theme={theme}
                sales={scopedData.sales}
                saleItems={scopedData.saleItems}
                products={scopedData.products}
                insights={dashboardInsights}
                detailsLoading={!fullSnapshotReady}
                user={user}
                onUpdateContact={updateCustomerContact}
                onRegisterContact={registerContact}
              />
            )}
            {visibleView === "resultados" && (
              <CrmResults
                customers={appCustomers}
                contactRecords={appContactRecords}
                sales={scopedData.sales}
                sellers={scopedData.sellers}
                refreshing={resultsRefreshing}
                refreshedAt={resultsUpdatedAt}
                refreshError={resultsRefreshError}
                onRefresh={refreshResultsData}
              />
            )}
            {visibleView === "clientes" && (
              <Customers
                customers={appCustomers}
                openProfile={openProfile}
                user={user}
                onUpdateContact={updateCustomerContact}
                onRegisterContact={registerContact}
              />
            )}
            {visibleView === "vendas" && (
              <SalesModule
                customers={appSaleCustomers}
                sales={scopedData.sales}
                saleItems={scopedData.saleItems}
              />
            )}
            {visibleView === "produtos" && (
              <ProductsModule
                customers={appCustomers}
                alerts={appAlerts}
                products={scopedData.products}
                sales={scopedData.sales}
                saleItems={scopedData.saleItems}
              />
            )}
            {visibleView === "recuperacao" && (
              <RecoveryCustomers
                customers={appCustomers}
                openProfile={openProfile}
                contactRecords={appContactRecords}
                agenda={scopedData.agenda}
                onRegisterContact={registerContact}
                user={user}
                onUpdateContact={updateCustomerContact}
              />
            )}
            {visibleView === "perfil" && (
              <CustomerProfile
                alerts={appAlerts}
                customer={safeSelectedCustomer}
                contactRecords={appContactRecords.filter((record) => record.customerId === safeSelectedCustomer.id)}
                sales={scopedData.sales}
                saleItems={scopedData.saleItems}
                sellers={scopedData.sellers}
                products={scopedData.products}
                user={user}
                onCreateAlert={createManualAlert}
                onUpdateContact={updateCustomerContact}
                onRegisterContact={registerContact}
              />
            )}
            {visibleView === "recompra" && (
              <RepurchaseAlerts
                alerts={appAlerts}
                customers={appCustomers}
                user={user}
                productCampaigns={productCampaigns}
                alertStatuses={alertStatuses}
                onStatusChange={updateAlertStatus}
                onRegisterContact={registerContact}
                onUpdateContact={updateCustomerContact}
              />
            )}
            {visibleView === "alerta-manual" && (
              <ManualAlertPage
                customers={appCustomers}
                products={scopedData.products}
                sellers={scopedData.sellers}
                user={user}
                onCreateAlert={createManualAlert}
              />
            )}
            {visibleView === "carteira" && (
              <SellerPortfolioBySeller
                customers={appCustomers}
                alerts={appAlerts}
                openProfile={openProfile}
                onRegisterContact={registerContact}
                user={user}
                sellers={scopedData.sellers}
                onUpdateContact={updateCustomerContact}
              />
            )}
            {visibleView === "vendedores" && <SellersModule customers={appCustomers} alerts={appAlerts} />}
            {visibleView === "saude" && <DataHealth customers={appCustomers} openProfile={openProfile} />}
            {visibleView === "atividades" && (
              <ActivitiesModule
                contactRecords={appContactRecords}
                sales={scopedData.sales}
                sellers={scopedData.sellers}
                user={user}
              />
            )}
            {visibleView === "avaliacoes" && (
              <AttendanceEvaluationsModule
                sellers={scopedData.sellers}
                sales={scopedData.sales}
                saleItems={scopedData.saleItems}
                products={scopedData.products}
                customers={appCustomers}
                referenceDate={crmReferenceDate}
              />
            )}
            {visibleView === "campanhas" && (
              <CampaignsModule
                customers={appCustomers}
                alerts={appAlerts}
                products={scopedData.products}
                user={user}
                productCampaigns={productCampaigns}
                onProductCampaignsChange={setProductCampaigns}
                openProfile={openProfile}
                onUpdateContact={updateCustomerContact}
                onRegisterContact={registerContact}
              />
            )}
            {visibleView === "oportunidades" && (
            <Opportunities
              items={scopedData.opportunities}
              user={user}
              customers={appCustomers}
              sellers={scopedData.sellers}
              onSave={saveOpportunity}
              onDelete={deleteOpportunity}
              onUpdateContact={updateCustomerContact}
              onRegisterContact={registerContact}
            />
            )}
            {visibleView === "agenda" && (
            <Agenda
              items={scopedData.agenda}
              user={user}
              customers={appCustomers}
              sellers={scopedData.sellers}
              onSave={saveAgendaEvent}
              onDelete={deleteAgendaEvent}
            />
            )}
            {visibleView === "ia" && (
              <CommercialAi
                customers={appCustomers}
                alerts={appAlerts}
                opportunities={scopedData.opportunities}
                agenda={scopedData.agenda}
                contactRecords={appContactRecords}
              />
            )}
            {visibleView === "motor-recompra" && <RepurchaseEngineModule alerts={appAlerts} user={user} />}
            {visibleView === "sincronizacao" && <SyncModule />}
            {visibleView === "configuracoes" && (
              <SettingsModule
                user={user}
                sellers={sellers}
                onUserChange={(nextUser) => setUser(nextUser)}
              />
            )}
            {visibleView === "relatorios" && (
              <Reports
                theme={theme}
                customers={appCustomers}
                alerts={appAlerts}
                opportunities={scopedData.opportunities}
                contactRecords={appContactRecords}
                products={scopedData.products}
              />
            )}
              </>
            )}
          </motion.div>
        </section>
      </div>
      <QuickActionModals
        action={quickAction}
        user={user}
        customers={appCustomers}
        products={scopedData.products}
        onClose={() => setQuickAction(null)}
        onGoTo={openView}
        onCreateCustomer={createManualCustomer}
        onCreateAlert={async (alert) => {
          await createManualAlert(alert);
          setActiveView("recompra");
        }}
        onCreateAgenda={saveAgendaEvent}
        onCreateOpportunity={saveOpportunity}
        onCreateContact={registerContact}
      />
      <AnimatePresence>
        {idleWarningRemainingMs !== null && (
          <SessionIdleWarning
            remainingMs={idleWarningRemainingMs}
            onContinue={() => renewIdleSessionRef.current()}
            onLogout={() => {
              clearSessionActivity(getSessionActivityStorageKey(user.id));
              void fetch("/api/auth/session", { method: "DELETE" }).finally(() => {
                setIdleWarningRemainingMs(null);
                setDismissedNotificationIds([]);
                setUser(null);
                setActiveView("dashboard");
              });
            }}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

type ScopedCrmData = {
  customers: CustomerRow[];
  alerts: AlertRow[];
  sales: SaleRow[];
  saleItems: SaleItemRow[];
  products: ProductRow[];
  sellers: SellerRow[];
  opportunities: CrmOpportunity[];
  agenda: CrmAgendaEvent[];
};

function canAccessView(user: CrmSessionUser, view: View) {
  if (user.role === "vendedor") return sellerAllowedViews.includes(view);
  if (user.role === "supervisor") return !supervisorBlockedViews.includes(view);
  return true;
}

function buildScopedCrmData(
  user: CrmSessionUser,
  manualCustomers: CustomerRow[],
  manualAlerts: AlertRow[],
  agendaItems: CrmAgendaEvent[],
  opportunityItems: CrmOpportunity[],
): ScopedCrmData {
  const baseData = {
    customers: [...manualCustomers, ...customers],
    alerts: [...manualAlerts, ...alerts],
    sales,
    saleItems,
    products: snapshot.products,
    sellers,
    opportunities: opportunityItems,
    agenda: agendaItems,
  };

  if (user.role === "administrador") {
    return baseData;
  }

  const seller = resolveSellerForUser(user.sellerId);
  if (!seller) {
    return {
      customers: [],
      alerts: [],
      sales: [],
      saleItems: [],
      products: [],
      sellers: [],
      opportunities: [],
      agenda: [],
    };
  }
  const scopedSellerId = seller?.id;
  const scopedSales = sales.filter((sale) => sale.sellerId === scopedSellerId);
  const saleIds = new Set(scopedSales.map((sale) => sale.id));
  const scopedSaleItems = saleItems.filter((item) => saleIds.has(item.saleId));
  const saleCustomerIds = new Set(scopedSales.map((sale) => sale.customerId));
  const scopedAlerts = baseData.alerts.filter(
    (alert) =>
      alert.sellerId === scopedSellerId ||
      (seller ? alert.seller === seller.name : false),
  );
  const alertCustomerIds = new Set(scopedAlerts.map((alert) => alert.customerId));
  const scopedOpportunities = opportunityItems.filter(
    (opportunity) =>
      opportunity.sellerId === scopedSellerId ||
      saleCustomerIds.has(opportunity.customerId) ||
      alertCustomerIds.has(opportunity.customerId),
  );
  const opportunityCustomerIds = new Set(scopedOpportunities.map((opportunity) => opportunity.customerId));
  const allowedCustomerIds = new Set([
    ...saleCustomerIds,
    ...alertCustomerIds,
    ...opportunityCustomerIds,
  ]);
  const scopedCustomers = baseData.customers.filter(
    (customer) =>
      customer.preferredSellerId === scopedSellerId ||
      allowedCustomerIds.has(customer.id),
  );
  const customerIds = new Set(scopedCustomers.map((customer) => customer.id));
  const productIds = new Set(scopedSaleItems.flatMap((item) => (item.productId ? [item.productId] : [])));
  const alertProductNames = new Set(scopedAlerts.map((alert) => alert.product));
  const scopedProducts = snapshot.products.filter(
    (product) => productIds.has(product.id) || alertProductNames.has(product.name),
  );

  return {
    customers: scopedCustomers,
    alerts: scopedAlerts.filter((alert) => customerIds.has(alert.customerId)),
    sales: scopedSales.filter((sale) => customerIds.has(sale.customerId)),
    saleItems: scopedSaleItems,
    products: scopedProducts,
    sellers: seller ? [seller] : [],
    opportunities: scopedOpportunities.filter((opportunity) => customerIds.has(opportunity.customerId)),
    agenda: agendaItems.filter((event) => event.sellerId === scopedSellerId),
  };
}

function applyCustomerContactUpdates(
  data: ScopedCrmData,
  updates: Record<string, CustomerContactUpdate>,
): ScopedCrmData {
  return {
    ...data,
    customers: applyCustomerListContactUpdates(data.customers, updates),
  };
}

function applyCustomerListContactUpdates(
  list: CustomerRow[],
  updates: Record<string, CustomerContactUpdate>,
) {
  return list.map((customer) => patchCustomerContact(customer, updates[customer.id]));
}

function patchCustomerContact(customer: CustomerRow, update?: CustomerContactUpdate): CustomerRow {
  if (!update) return customer;
  return {
    ...customer,
    phone: update.phone || customer.phone,
    whatsapp: update.whatsapp || customer.whatsapp,
  };
}

function materializeManualCustomer(
  draft: CustomerRow,
  saved: ManualCustomerSaveResult,
): CustomerRow {
  return {
    ...draft,
    id: saved.id,
    uniplusId: saved.uniplusId ?? 0,
    name: saved.name,
    phone: saved.phone || draft.phone,
    whatsapp: saved.whatsapp || draft.whatsapp,
    city: saved.city || draft.city,
    category: saved.category || draft.category,
    preferredSeller: saved.sellerName ?? draft.preferredSeller,
    preferredSellerId: saved.sellerId ?? draft.preferredSellerId,
    qualityScore: saved.qualityScore || draft.qualityScore,
    qualityStatus: saved.qualityStatus || draft.qualityStatus,
    purchaseCycleDays: saved.purchaseCycleDays || draft.purchaseCycleDays,
  };
}

function buildTopbarNotifications(
  scopedCustomers: CustomerRow[],
  scopedAlerts: AlertRow[],
  scopedContacts: ContactRecord[],
  scopedAgenda: CrmAgendaEvent[],
): CrmNotification[] {
  const contactedCustomerIds = new Set(
    scopedContacts
      .filter((record) => record.outcome !== "invalid_number")
      .map((record) => record.customerId),
  );
  const pendingAlerts = scopedAlerts.filter((alert) => alert.status === "pendente");
  const overdueAlerts = pendingAlerts
    .filter((alert) => alert.recommendedIso < crmReferenceDate)
    .sort(compareAlertPriority)
    .slice(0, 3)
    .map((alert) => ({
      id: `overdue-alert-${alert.id}`,
      title: `Recompra atrasada: ${alert.client}`,
      description: `${alert.product} estava previsto para ${alert.recommended}.`,
      tone: "red" as const,
      customerId: alert.customerId,
    }));
  const todayAlerts = pendingAlerts
    .filter((alert) => alert.recommendedIso === crmReferenceDate)
    .sort(compareAlertPriority)
    .slice(0, 3)
    .map((alert) => ({
      id: `today-alert-${alert.id}`,
      title: `Contato de hoje: ${alert.client}`,
      description: `${alert.product} com prioridade ${alert.priority.toLowerCase()}.`,
      tone: "amber" as const,
      customerId: alert.customerId,
    }));
  const weakRegistration = scopedCustomers
    .filter((customer) => (!customer.whatsapp || customer.qualityScore < 70) && !contactedCustomerIds.has(customer.id))
    .sort((left, right) => left.qualityScore - right.qualityScore)
    .slice(0, 2)
    .map((customer) => ({
      id: `weak-registration-${customer.id}`,
      title: `Cadastro para revisar: ${customer.name}`,
      description: customer.whatsapp ? `Qualidade ${customer.qualityScore}%.` : "Sem WhatsApp valido.",
      tone: "cyan" as const,
      customerId: customer.id,
    }));
  const todayAgenda = scopedAgenda
    .filter((event) => !event.completed && event.date === crmReferenceDate)
    .slice(0, 4)
    .map((event) => ({
      id: `agenda-${event.id}`,
      title: `${event.time} - ${event.title}`,
      description: `Compromisso de ${event.type.toLowerCase()} na agenda comercial.`,
      tone: event.contactId ? "amber" as const : "emerald" as const,
      customerId: event.customerId,
      view: "agenda" as View,
    }));
  const overdueFollowUps = scopedAgenda
    .filter(
      (event) =>
        isOpenAutomaticFollowUp(event) &&
        event.date < crmReferenceDate,
    )
    .sort(compareAgendaEvents)
    .slice(0, 4)
    .map((event) => ({
      id: `overdue-follow-up-${event.id}`,
      title: `Retorno atrasado: ${event.title.replace(/^Retorno:\s*/u, "")}`,
      description: `O contato estava agendado para ${formatContactDate(event.date)}.`,
      tone: "red" as const,
      customerId: event.customerId,
      view: "agenda" as View,
    }));

  return [...overdueFollowUps, ...overdueAlerts, ...todayAlerts, ...todayAgenda, ...weakRegistration];
}

function filterNotificationContactRecordsForUser(user: CrmSessionUser, records: ContactRecord[]) {
  if (user.role === "administrador") return records;
  const seller = resolveSellerForUser(user.sellerId);
  const responsibleNames = new Set(
    [user.name, seller?.name]
      .filter(Boolean)
      .map((name) => normalizeManualAlertSearch(name as string)),
  );
  return records.filter((record) => responsibleNames.has(normalizeManualAlertSearch(record.responsible)));
}

function getNotificationStorageKey(userId: string, referenceDate: string) {
  return `hennder-crm-notifications:${userId}:${referenceDate}`;
}

function getSessionActivityStorageKey(userId: string) {
  return `hennder-crm-session-activity:${userId}`;
}

function readSessionActivity(storageKey: string) {
  try {
    const activityAt = Number(localStorage.getItem(storageKey));
    return Number.isFinite(activityAt) && activityAt > 0 ? activityAt : null;
  } catch {
    return null;
  }
}

function writeSessionActivity(storageKey: string, activityAt: number) {
  try {
    localStorage.setItem(storageKey, String(activityAt));
  } catch {
    // The in-memory timer still enforces inactivity when storage is unavailable.
  }
}

function clearSessionActivity(storageKey: string) {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // The cookie deletion still closes the current session when storage is unavailable.
  }
}

function readDismissedNotificationIds(userId: string, referenceDate: string) {
  try {
    const stored = localStorage.getItem(getNotificationStorageKey(userId, referenceDate));
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function mergeNotifications(remote: CrmNotification[], local: CrmNotification[]) {
  const seen = new Set<string>();
  const merged: CrmNotification[] = [];

  for (const notification of [...remote, ...local]) {
    if (seen.has(notification.id)) continue;
    seen.add(notification.id);
    merged.push(notification);
  }

  return merged;
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

function notificationToneClass(tone: CrmNotification["tone"]) {
  return {
    red: "bg-red-500",
    amber: "bg-amber-400",
    cyan: "bg-cyan-500",
    emerald: "bg-emerald-500",
  }[tone];
}

function filterContactRecordsForData(records: ContactRecord[], scopedCustomers: CustomerRow[]) {
  const customerIds = new Set(scopedCustomers.map((customer) => customer.id));
  return records.filter((record) => customerIds.has(record.customerId));
}

function includeSaleCustomers(scopedCustomers: CustomerRow[], allCustomers: CustomerRow[], scopedSales: SaleRow[]) {
  const customerById = new Map(scopedCustomers.map((customer) => [customer.id, customer]));
  const missingCustomerIds = new Set(scopedSales.map((sale) => sale.customerId).filter((id) => !customerById.has(id)));
  if (!missingCustomerIds.size) return scopedCustomers;

  for (const customer of allCustomers) {
    if (missingCustomerIds.has(customer.id)) {
      customerById.set(customer.id, customer);
    }
  }

  return [...customerById.values()];
}

function getAvailableSellers(user: CrmSessionUser) {
  if (user.role === "administrador") return sellers;
  const seller = resolveSellerForUser(user.sellerId);
  return seller ? [seller] : [];
}

function resolveSellerForUser(sellerId?: string) {
  if (!sellerId) return undefined;
  const exactSeller = sellers.find((item) => item.id === sellerId);
  if (exactSeller) return exactSeller;
  if (!sellers.length) return undefined;

  const hash = [...sellerId].reduce((total, char) => total + char.charCodeAt(0), 0);
  return sellers[hash % sellers.length];
}

async function mutateWorkspace<T = unknown>(command: unknown): Promise<T> {
  const response = await fetch("/api/crm/workspace", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(command),
  });
  const result = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Não foi possível salvar.");
  return result;
}

function AuthenticatedLoadingShell({
  activeView,
  mobileOpen,
  setActiveView,
  setMobileOpen,
  theme,
  user,
  onThemeChange,
  onLogout,
}: {
  activeView: View;
  mobileOpen: boolean;
  setActiveView: (view: View) => void;
  setMobileOpen: (open: boolean) => void;
  theme: Theme;
  user: CrmSessionUser;
  onThemeChange: (theme: Theme) => void;
  onLogout: () => Promise<void>;
}) {
  return (
    <main className="crm-app min-h-screen bg-[#eaf3fb] text-slate-950">
      <div className="flex min-h-screen">
        <Sidebar
          activeView={activeView}
          setActiveView={setActiveView}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
          user={user}
        />
        <section className="crm-content min-w-0 flex-1 bg-[linear-gradient(135deg,#edf7ff_0%,#f5f9ff_48%,#eaf3fb_100%)]">
          <Topbar
            onMenu={() => setMobileOpen(true)}
            theme={theme}
            onThemeChange={onThemeChange}
            user={user}
            customers={[]}
            notifications={[]}
            notificationSchemaReady={true}
            notificationError=""
            pushStatus="idle"
            pushTestStatus=""
            devicePushTestStatus=""
            onOpenCustomer={() => undefined}
            onOpenView={setActiveView}
            onClearNotifications={() => undefined}
            onEnablePush={() => undefined}
            onTestDevicePush={() => undefined}
            onSendTestNotifications={() => undefined}
            onQuickAction={() => undefined}
            onLogout={onLogout}
          />
          <div className="mx-auto w-full max-w-[1560px] px-3 py-4 sm:px-5 lg:px-6">
            <PageTitle
              eyebrow="Visão executiva"
              title="Dashboard comercial inteligente"
              description="Preparando os indicadores prioritários da operação."
            />
            <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 animate-pulse rounded-lg border border-blue-100 bg-white/80"
                />
              ))}
            </div>
            <div className="mt-5 min-h-56 border-y border-blue-100 bg-white/55">
              <AppInlineLoading label="Carregando os dados prioritários do dashboard" />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function DeferredDataLoading({
  activeView,
  loading,
  error,
  onRetry,
}: {
  activeView: View;
  loading: boolean;
  error: string;
  onRetry: () => void;
}) {
  const item = navGroups.flatMap((group) => group.items).find((candidate) => candidate.id === activeView);
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="Dados comerciais"
        title={item?.label ?? "Carregando módulo"}
        description="A Dashboard já está pronta. Finalizando os dados detalhados desta tela."
      />
      <div className="min-h-64 rounded-xl border border-blue-100 bg-white/70">
        {error && !loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-6 text-center">
            <AlertTriangle size={28} className="text-amber-500" aria-hidden="true" />
            <p className="mt-4 font-semibold text-slate-900">A carga detalhada foi interrompida</p>
            <p className="mt-2 max-w-md text-sm text-slate-600">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white transition hover:bg-[#06488f]"
            >
              <RefreshCcw size={16} aria-hidden="true" />
              Tentar novamente
            </button>
          </div>
        ) : (
          <AppInlineLoading
            label={loading ? "Carregando dados detalhados" : "Preparando dados detalhados"}
          />
        )}
      </div>
    </div>
  );
}

function SystemEmptyScreen({
  label,
  detail,
  actionLabel,
  onAction,
}: {
  label: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#02070c] px-6 text-white">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <LogoMark />
        </div>
        <h1 className="mt-8 text-2xl font-bold">{label}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{detail}</p>
        {actionLabel && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-cyan-400 px-5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300"
          >
            <RefreshCcw size={17} aria-hidden="true" />
            {actionLabel}
          </button>
        )}
      </div>
    </main>
  );
}

function SessionIdleWarning({
  remainingMs,
  onContinue,
  onLogout,
}: {
  remainingMs: number;
  onContinue: () => void;
  onLogout: () => void;
}) {
  const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
  const remainingLabel =
    remainingSeconds >= 60
      ? `${Math.ceil(remainingSeconds / 60)} min`
      : `${remainingSeconds} s`;

  return (
    <motion.div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="session-idle-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:items-center sm:p-6"
    >
      <motion.section
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.98 }}
        transition={{ duration: 0.22 }}
        className="w-full max-w-md overflow-hidden rounded-xl border border-blue-100 bg-white shadow-2xl"
      >
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-[#0753a6]">
            <Clock3 size={22} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-cyan-700">Sessão protegida</p>
                <h2 id="session-idle-title" className="mt-1 text-xl font-bold text-[#18334d]">
                  Você ainda está usando o CRM?
                </h2>
              </div>
              <span className="rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                {remainingLabel}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              A sessão será encerrada por inatividade. Toque em continuar para permanecer conectado neste aparelho.
            </p>
          </div>
        </div>
        <div className="grid gap-2 border-t border-blue-50 bg-[#f8fbff] p-4 sm:grid-cols-[auto_1fr]">
          <button
            type="button"
            onClick={onLogout}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-blue-100 px-4 text-sm font-semibold text-slate-600 transition hover:bg-white"
          >
            <LogOut size={17} aria-hidden="true" />
            Sair agora
          </button>
          <button
            type="button"
            onClick={onContinue}
            autoFocus
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0753a6] px-5 text-sm font-bold text-white shadow-sm transition hover:bg-[#06498f] focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2"
          >
            <Clock3 size={17} aria-hidden="true" />
            Continuar conectado
          </button>
        </div>
      </motion.section>
    </motion.div>
  );
}

function QuickActionModals({
  action,
  user,
  customers,
  products,
  onClose,
  onGoTo,
  onCreateCustomer,
  onCreateAlert,
  onCreateAgenda,
  onCreateOpportunity,
  onCreateContact,
}: {
  action: QuickAction | null;
  user: CrmSessionUser;
  customers: CustomerRow[];
  products: ProductRow[];
  onClose: () => void;
  onGoTo: (view: View) => void;
  onCreateCustomer: (customer: CustomerRow) => Promise<void>;
  onCreateAlert: (alert: AlertRow, note?: string) => Promise<void>;
  onCreateAgenda: (event: Omit<CrmAgendaEvent, "id">) => Promise<void>;
  onCreateOpportunity: (opportunity: Omit<CrmOpportunity, "id">) => Promise<void>;
  onCreateContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  if (!action) return null;
  const availableSellers = getAvailableSellers(user);

  if (action === "manual-customer") {
    return (
      <ManualCustomerModal
        user={user}
        sellers={availableSellers}
        onClose={onClose}
        onSave={async (customer) => {
          await onCreateCustomer(customer);
          onClose();
        }}
      />
    );
  }

  if (action === "manual-alert") {
    return (
      <ManualAlertModal
        customers={customers}
        products={products}
        sellers={availableSellers}
        user={user}
        onClose={onClose}
        onSave={async (alert) => {
          await onCreateAlert(alert);
          onClose();
        }}
      />
    );
  }

  if (action === "opportunity") {
    return (
      <OpportunityModal
        user={user}
        customers={customers}
        sellers={availableSellers}
        onClose={onClose}
        onSave={async (opportunity) => {
          await onCreateOpportunity(opportunity);
          onClose();
          onGoTo("oportunidades");
        }}
      />
    );
  }

  if (action === "agenda") {
    return (
      <AgendaEventModal
        user={user}
        customers={customers}
        sellers={availableSellers}
        onClose={onClose}
        onSave={async (event) => {
          await onCreateAgenda(event);
          onClose();
          onGoTo("agenda");
        }}
      />
    );
  }

  return (
    <QuickContactModal
      customers={customers}
      user={user}
      onClose={onClose}
      onSave={async (record) => {
        await onCreateContact(record);
        onClose();
        onGoTo("recuperacao");
      }}
    />
  );
}

function ManualCustomerModal({
  user,
  sellers,
  onClose,
  onSave,
}: {
  user: CrmSessionUser;
  sellers: SellerRow[];
  onClose: () => void;
  onSave: (customer: CustomerRow) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Manhuacu");
  const [category, setCategory] = useState("Cliente manual");
  const defaultSeller = resolveSellerForUser(user.sellerId) ?? sellers[0];
  const [sellerId, setSellerId] = useState(defaultSeller?.id ?? "");
  const [cycleDays, setCycleDays] = useState("45");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <ModalFrame title="Cadastrar cliente manual" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const seller = sellers.find((item) => item.id === sellerId);
          const normalized = normalizeBrazilianWhatsAppNumber(phone);
          const parsedCycleDays = Number(cycleDays);
          if (!name.trim()) {
            setError("Informe o nome do cliente.");
            return;
          }
          if (!Number.isFinite(parsedCycleDays) || parsedCycleDays <= 0) {
            setError("Informe um ciclo estimado maior que zero.");
            return;
          }
          const qualityScore = normalized ? 70 : 45;
          setSaving(true);
          setError("");
          try {
            await onSave({
            id: `manual-customer-${Date.now()}`,
            uniplusId: 0,
            name: name.trim(),
            phone: phone.trim(),
            whatsapp: normalized ? phone.trim() : "",
            email: "",
            document: "",
            address: "",
            neighborhood: "",
            cityId: undefined,
            city: city.trim() || "Cidade nao informada",
            category: category.trim() || "Cliente manual",
            status: "Atenção",
            activityStatus: "atencao",
            lastBuy: formatContactDate(crmReferenceDate),
            lastBuyIso: crmReferenceDate,
            days: 45,
            ticket: formatCurrency(0),
            ticketValue: 0,
            score: 64,
            potential: formatCurrency(0),
            potentialValue: 0,
            probability: 64,
            preferredSeller: seller?.name ?? "Sem preferência",
            preferredSellerId: seller?.id,
            sellerAffinity: seller ? 100 : 0,
            qualityScore,
            qualityStatus: qualityScore >= 70 ? "bom" : "regular",
            purchaseCycleDays: parsedCycleDays,
            totalPurchases: 0,
            totalPurchased: formatCurrency(0),
          });
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Falha ao salvar cliente.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <FormInput label="Nome do cliente" value={name} onChange={setName} />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Celular / WhatsApp" value={phone} onChange={setPhone} />
          <FormInput label="Cidade" value={city} onChange={setCity} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput label="Categoria" value={category} onChange={setCategory} />
          <FormInput label="Ciclo estimado (dias)" value={cycleDays} onChange={setCycleDays} type="number" />
          <FormSelect label="Vendedor responsavel" value={sellerId} onChange={setSellerId} disabled={user.role !== "administrador"}>
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </FormSelect>
        </div>
        <p className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-800">
          Cadastro operacional salvo no Supabase. Quando o ERP trouxer uma venda desse cliente, o Hennder Sync passa a enriquecer o historico automaticamente.
        </p>
        <ModalActions saving={saving} error={error} onClose={onClose} />
      </form>
    </ModalFrame>
  );
}

function ManualAlertModal({
  customers,
  products,
  sellers,
  user,
  onClose,
  onSave,
}: {
  customers: CustomerRow[];
  products: ProductRow[];
  sellers: SellerRow[];
  user: CrmSessionUser;
  onClose: () => void;
  onSave: (alert: AlertRow) => Promise<void>;
}) {
  const defaultSeller = resolveSellerForUser(user.sellerId) ?? sellers[0];
  const [customerId, setCustomerId] = useState("");
  const [productId, setProductId] = useState("");
  const [days, setDays] = useState("");
  const [recommendedIso, setRecommendedIso] = useState("");
  const [priority, setPriority] = useState<AlertRow["priorityCode"] | "">("");
  const [sellerId, setSellerId] = useState(user.role === "vendedor" ? defaultSeller?.id ?? "" : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedCustomer = customers.find((item) => item.id === customerId);
  const selectedProduct = products.find((item) => item.id === productId);
  const selectedSeller = sellers.find((item) => item.id === sellerId);

  return (
    <ModalFrame title="Cadastrar alerta manual" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!selectedCustomer) {
            setError("Escolha um cliente da base para criar o alerta.");
            return;
          }
          if (!selectedProduct) {
            setError("Escolha um produto da base para criar o alerta.");
            return;
          }
          const recurrenceDays = Number(days);
          if (!Number.isFinite(recurrenceDays) || recurrenceDays <= 0) {
            setError("Informe uma recorrencia em dias maior que zero.");
            return;
          }
          if (!recommendedIso) {
            setError("Informe a data do alerta.");
            return;
          }
          if (!priority) {
            setError("Escolha uma prioridade para o alerta.");
            return;
          }
          setSaving(true);
          setError("");
          try {
            await onSave(buildManualAlertRow({
              customer: selectedCustomer,
              product: selectedProduct,
              recurrenceDays,
              recommendedIso,
              priority,
              seller: selectedSeller,
            }));
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Falha ao salvar alerta manual.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4">
          <p className="text-sm font-bold text-[#0753a6]">Criacao manual, sem preenchimento automatico</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Selecione cliente, produto, recorrencia, data e prioridade. O sistema nao escolhe nenhum registro por conta propria.
          </p>
        </div>
        <ManualAlertPicker
          label="Cliente da base"
          placeholder="Buscar por nome, CPF/CNPJ ou cidade"
          items={customers}
          value={customerId}
          onChange={setCustomerId}
          getTitle={(customer) => customer.name}
          getSubtitle={(customer) => [customer.document, customer.city, customer.preferredSeller].filter(Boolean).join(" · ")}
          emptyText="Nenhum cliente encontrado."
          icon={UserRound}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <ManualAlertPicker
            label="Produto da base"
            placeholder="Buscar produto importado"
            items={products}
            value={productId}
            onChange={setProductId}
            getTitle={(product) => product.name}
            getSubtitle={(product) => [product.code, product.department, product.defaultRepurchaseDays ? `${product.defaultRepurchaseDays} dias no motor` : ""].filter(Boolean).join(" · ")}
            emptyText="Nenhum produto encontrado."
            icon={ShoppingBag}
          />
          <ManualAlertInput
            label="Recorrencia em dias"
            value={days}
            onChange={setDays}
            type="number"
            placeholder="Ex: 30"
            helper={selectedProduct?.defaultRepurchaseDays ? `Motor sugere ${selectedProduct.defaultRepurchaseDays} dias para este produto.` : "Defina manualmente o ciclo deste alerta."}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <ManualAlertInput label="Data do alerta" value={recommendedIso} onChange={setRecommendedIso} type="date" />
          <ManualAlertPriorityPicker value={priority} onChange={setPriority} />
        </div>
        <div className="grid gap-4">
          {user.role !== "administrador" ? (
            <ManualAlertLockedField label="Responsavel" value={selectedSeller?.name ?? "Vendedor logado"} />
          ) : (
            <ManualAlertPicker
              label="Responsavel"
              placeholder="Buscar vendedor responsavel"
              items={sellers}
              value={sellerId}
              onChange={setSellerId}
              getTitle={(seller) => seller.name}
              getSubtitle={(seller) => seller.supervisor ? "Supervisor" : "Vendedor"}
              emptyText="Nenhum vendedor encontrado."
              icon={UserRound}
              optional
            />
          )}
        </div>
        <ModalActions saving={saving} error={error} onClose={onClose} />
      </form>
    </ModalFrame>
  );
}

function QuickContactModal({
  customers,
  user,
  onClose,
  onSave,
}: {
  customers: CustomerRow[];
  user: CrmSessionUser;
  onClose: () => void;
  onSave: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const customer = customers.find((item) => item.id === customerId) ?? customers[0];

  if (!customer) return null;

  return (
    <ContactOutcomeModal
      customer={customer}
      defaultResponsible={resolveWhatsAppResponsibleName(user, customer)}
      onClose={onClose}
      onSave={onSave}
      header={
        <FormSelect label="Cliente" value={customerId} onChange={setCustomerId}>
          {customers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </FormSelect>
      }
    />
  );
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const isProduction = process.env.NODE_ENV === "production";
  const [email, setEmail] = useState(isProduction ? "" : "admin@henndercrm.local");
  const [password, setPassword] = useState(isProduction ? "" : "Admin@123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [glowPosition, setGlowPosition] = useState({ x: 50, y: 36 });
  const panelStyle = {
    "--crm-auth-glow-x": `${glowPosition.x}%`,
    "--crm-auth-glow-y": `${glowPosition.y}%`,
  } as CSSProperties;

  return (
    <main className="crm-auth-screen flex min-h-svh items-center overflow-x-hidden p-4 text-white sm:p-6">
      <div className="crm-auth-card mx-auto grid w-full max-w-6xl overflow-hidden rounded-lg border border-white/10 shadow-2xl lg:grid-cols-[minmax(0,0.96fr)_minmax(0,1.04fr)]">
        <section
          className="crm-auth-panel relative flex min-h-[calc(100svh-2rem)] items-center overflow-hidden px-6 py-10 sm:px-10 lg:min-h-[620px] lg:px-14 xl:px-16"
          style={panelStyle}
          onPointerMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            setGlowPosition({
              x: ((event.clientX - bounds.left) / bounds.width) * 100,
              y: ((event.clientY - bounds.top) / bounds.height) * 100,
            });
          }}
        >
          <div className="relative z-10 mx-auto w-full max-w-[370px]">
            <div className="crm-auth-brand">
              <LogoMark />
              <p className="mt-9 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/68">
                Acesso ao painel comercial
              </p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight text-[#edf2f7] sm:text-[2.7rem]">
                Hennder CRM
              </h1>
              <p className="mt-3 max-w-sm text-[15px] leading-6 text-slate-300">
                Inteligência comercial para transformar relacionamento em novas vendas.
              </p>
            </div>
            <form
              className="mt-9 space-y-4"
              onSubmit={async (event) => {
                event.preventDefault();
                setSubmitting(true);
                setError("");
                try {
                  await onLogin(email, password);
                } catch (loginError) {
                  setError(
                    loginError instanceof Error
                      ? loginError.message
                      : "Não foi possível entrar.",
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              <LoginInput
                id="login-email"
                label="E-mail"
                value={email}
                type="email"
                autoComplete="email"
                placeholder="nome@empresa.com"
                icon={<Mail size={18} aria-hidden="true" />}
                hasError={Boolean(error)}
                onChange={(value) => {
                  setEmail(value);
                  setError("");
                }}
              />
              <LoginInput
                id="login-password"
                label="Senha"
                value={password}
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite sua senha"
                icon={<LockKeyhole size={18} aria-hidden="true" />}
                hasError={Boolean(error)}
                trailing={
                  <button
                    type="button"
                    onClick={() => setPasswordVisible((visible) => !visible)}
                    className="crm-auth-icon-button"
                    aria-label={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                    title={passwordVisible ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {passwordVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                onChange={(value) => {
                  setPassword(value);
                  setError("");
                }}
              />
              <button
                type="submit"
                disabled={submitting}
                className="crm-auth-submit group flex h-12 w-full items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold text-white transition disabled:cursor-wait disabled:opacity-70"
              >
                <LogIn size={18} />
                {submitting ? "Entrando..." : "Entrar"}
                <ChevronRight size={17} className="transition group-hover:translate-x-0.5" />
              </button>
              {error && (
                <p id="login-error" role="alert" className="rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                  {error}
                </p>
              )}
            </form>
            {!isProduction && (
              <div className="mt-5 hidden border-l border-cyan-200/30 pl-3 text-xs leading-5 text-slate-400 sm:block">
                <p className="font-semibold text-slate-200">Acessos locais de desenvolvimento</p>
                <p>Administrador: admin@henndercrm.local / Admin@123</p>
                <p>Supervisor: supervisor@henndercrm.local / Supervisor@123</p>
                <p>Vendedor: vendedor@henndercrm.local / Vendedor@123</p>
              </div>
            )}
          </div>
        </section>
        <section className="crm-auth-media relative hidden min-h-[620px] overflow-hidden lg:block" aria-hidden="true">
          <Image
            src="/assets/login-crm-dashboard.webp"
            alt=""
            fill
            sizes="(min-width: 1024px) 52vw, 0vw"
            priority
            unoptimized
            className="h-full w-full object-cover"
          />
        </section>
      </div>
    </main>
  );
}

function LoginInput({
  id,
  label,
  value,
  type,
  autoComplete,
  placeholder,
  icon,
  trailing,
  hasError,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  type: "email" | "password" | "text";
  autoComplete: string;
  placeholder: string;
  icon: ReactNode;
  trailing?: ReactNode;
  hasError: boolean;
  onChange: (value: string) => void;
}) {
  const [pointerX, setPointerX] = useState(50);
  const fieldStyle = { "--crm-auth-field-x": `${pointerX}%` } as CSSProperties;

  return (
    <label
      className="crm-auth-field block"
      style={fieldStyle}
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        setPointerX(((event.clientX - bounds.left) / bounds.width) * 100);
      }}
    >
      <span className="mb-2 block text-sm font-medium text-slate-200">{label}</span>
      <span className="relative block">
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-500">
          {icon}
        </span>
        <input
          id={id}
          name={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={hasError}
          aria-describedby={hasError ? "login-error" : undefined}
          required
          className={`h-12 w-full rounded-[7px] border bg-[#111519] py-3 pl-11 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:bg-[#141a1f] ${
            trailing ? "pr-12" : "pr-4"
          } ${hasError ? "border-red-300/55" : "border-[#2e3740] focus:border-cyan-200/70"}`}
        />
        {trailing && <span className="absolute right-1.5 top-1/2 z-10 -translate-y-1/2">{trailing}</span>}
      </span>
    </label>
  );
}

function Sidebar({
  activeView,
  setActiveView,
  mobileOpen,
  setMobileOpen,
  user,
}: {
  activeView: View;
  setActiveView: (view: View) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  user: CrmSessionUser;
}) {
  const visibleNavGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (user.role === "vendedor") return sellerAllowedViews.includes(item.id);
        if (user.role === "supervisor") return !supervisorBlockedViews.includes(item.id);
        return true;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const renderSidebarContent = (showCloseButton: boolean) => (
    <>
      <div className="flex shrink-0 items-center justify-between">
        <LogoMark compact />
        {showCloseButton && (
          <button
            type="button"
            aria-label="Fechar menu"
            className="rounded-md p-2 text-blue-100 transition hover:bg-white/10 hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <nav className="mt-7 shrink-0 space-y-5 pr-1">
        {visibleNavGroups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-cyan-200/80">
              {group.title}
            </p>
            <div className="space-y-1.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeView === item.id || (activeView === "perfil" && item.id === "clientes");
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveView(item.id);
                      setMobileOpen(false);
                    }}
                    className={`flex min-h-11 w-full items-start gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${
                      active
                        ? "bg-white text-[#084d9f] shadow-lg shadow-blue-950/20"
                        : "text-blue-100 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <Icon size={18} className="mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block">{item.label}</span>
                      {active && (
                        <span className="mt-1 block text-xs font-normal leading-4 text-slate-500">
                          {item.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="mt-8 shrink-0 rounded-xl border border-cyan-300/25 bg-white/10 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400 text-[#06356c]">
          <Sparkles size={18} />
        </div>
        <p className="mt-3 text-sm font-semibold text-white">Motor de recompra</p>
        <p className="mt-1 text-xs leading-5 text-blue-100">
          {alerts.length} alertas priorizados pelas regras comerciais.
        </p>
      </div>
    </>
  );

  return (
    <>
      <aside
        aria-label="Menu principal"
        className="crm-sidebar sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto overscroll-contain border-r border-white/10 bg-[#083d80] px-3 py-4 text-white shadow-none lg:flex"
      >
        {renderSidebarContent(false)}
      </aside>
      <AnimatePresence initial={false}>
        {mobileOpen && (
          <motion.button
            key="mobile-sidebar-backdrop"
            type="button"
            aria-label="Fechar menu lateral"
            className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onClick={() => setMobileOpen(false)}
          />
        )}
        {mobileOpen && (
          <motion.aside
            key="mobile-sidebar-panel"
            aria-label="Menu principal"
            initial={{ opacity: 0, x: "-104%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "-104%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36, mass: 0.82 }}
            className="crm-sidebar crm-mobile-sidebar fixed inset-y-0 left-0 z-40 flex h-screen h-[100dvh] w-[min(18rem,calc(100vw-1.25rem))] max-w-[18rem] flex-col overflow-y-auto overscroll-contain border-r border-white/10 bg-[#083d80] px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] text-white shadow-2xl shadow-blue-950/25 touch-pan-y lg:hidden"
          >
            {renderSidebarContent(true)}
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}

function Topbar({
  onMenu,
  theme,
  onThemeChange,
  user,
  customers,
  notifications,
  notificationSchemaReady,
  notificationError,
  pushStatus,
  pushTestStatus,
  devicePushTestStatus,
  onOpenCustomer,
  onOpenView,
  onClearNotifications,
  onEnablePush,
  onTestDevicePush,
  onSendTestNotifications,
  onQuickAction,
  onLogout,
}: {
  onMenu: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  user: CrmSessionUser;
  customers: CustomerRow[];
  notifications: CrmNotification[];
  notificationSchemaReady: boolean;
  notificationError: string;
  pushStatus: "idle" | "activating" | "active" | "blocked" | "unsupported";
  pushTestStatus: string;
  devicePushTestStatus: string;
  onOpenCustomer: (customer: CustomerRow) => void;
  onOpenView: (view: View) => void;
  onClearNotifications: () => void | Promise<void>;
  onEnablePush: () => void | Promise<void>;
  onTestDevicePush: () => void | Promise<void>;
  onSendTestNotifications: () => void | Promise<void>;
  onQuickAction: (action: QuickAction) => void;
  onLogout: () => Promise<void>;
}) {
  const nextTheme = theme === "dark" ? "light" : "dark";
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeLabel = theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro";
  const [actionOpen, setActionOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const quickActionRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const normalizedCustomerSearch = normalizeManualAlertSearch(customerSearch.trim());
  const customerSearchResults = normalizedCustomerSearch.length >= 2
    ? customers
        .filter((customer) => normalizeManualAlertSearch(customer.name).includes(normalizedCustomerSearch))
        .slice(0, 7)
    : [];
  const quickActions: Array<{
    id: QuickAction;
    label: string;
    description: string;
    icon: typeof Plus;
  }> = [
    { id: "manual-alert", label: "Cadastrar alerta manual", description: "Criar lembrete de recompra para um cliente.", icon: Bell },
    { id: "manual-customer", label: "Cadastrar cliente manual", description: "Adicionar cliente operacional durante a sessao.", icon: UsersRound },
    { id: "opportunity", label: "Nova oportunidade", description: "Registrar venda cruzada ou sugestao comercial.", icon: Target },
    { id: "agenda", label: "Novo compromisso", description: "Agendar ligação, visita, retorno ou recompra.", icon: CalendarDays },
    { id: "contact", label: "Registrar retorno", description: "Salvar resultado de contato com cliente.", icon: MessageCircle },
  ];

  useEffect(() => {
    if (!actionOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!quickActionRef.current?.contains(event.target as Node)) {
        setActionOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [actionOpen]);

  useEffect(() => {
    if (!searchOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [searchOpen]);

  useEffect(() => {
    if (!notificationOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setNotificationOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationOpen]);

  function openCustomerFromSearch(customer: CustomerRow) {
    onOpenCustomer(customer);
    setCustomerSearch("");
    setSearchOpen(false);
  }

  function openNotification(notification: CrmNotification) {
    const customer = notification.customerId
      ? customers.find((item) => item.id === notification.customerId)
      : undefined;
    if (customer) {
      onOpenCustomer(customer);
    } else if (notification.view) {
      onOpenView(notification.view);
    }
    setNotificationOpen(false);
  }

  return (
    <header className="crm-topbar sticky top-0 z-20 border-b border-blue-700/30 bg-[#0753a6] text-white shadow-[0_4px_18px_rgba(6,61,128,0.18)]">
      <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between px-4 sm:px-5 lg:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Abrir menu"
            className="rounded-md p-2 text-white lg:hidden"
            onClick={onMenu}
          >
            <Menu size={21} />
          </button>
          <div ref={searchRef} className="relative hidden w-[390px] md:block">
            <div className="flex h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 text-sm text-white shadow-inner shadow-blue-950/10 transition focus-within:border-cyan-200 focus-within:bg-white/15 focus-within:shadow-lg">
              <Search size={17} className="shrink-0 text-cyan-100" />
              <input
                value={customerSearch}
                onChange={(event) => {
                  setCustomerSearch(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && customerSearchResults[0]) {
                    event.preventDefault();
                    openCustomerFromSearch(customerSearchResults[0]);
                  }
                }}
                placeholder="Pesquisar cliente pelo nome"
                className="w-full bg-transparent text-sm font-medium text-inherit placeholder:text-blue-100 outline-none"
              />
              {customerSearch && (
                <button
                  type="button"
                  aria-label="Limpar pesquisa"
                  onClick={() => {
                    setCustomerSearch("");
                    setSearchOpen(false);
                  }}
                  className="grid size-7 shrink-0 place-items-center rounded-lg text-blue-100 transition hover:bg-slate-100 hover:text-[#0753a6]"
                >
                  <X size={15} />
                </button>
              )}
            </div>
            {searchOpen && customerSearch.trim() && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute left-0 top-[3.35rem] z-40 w-full overflow-hidden rounded-2xl border border-blue-100 bg-white p-2 text-slate-900 shadow-2xl"
              >
                {normalizedCustomerSearch.length < 2 ? (
                  <p className="px-3 py-4 text-sm text-slate-500">Digite pelo menos 2 letras do nome do cliente.</p>
                ) : customerSearchResults.length ? (
                  <div className="space-y-1">
                    {customerSearchResults.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => openCustomerFromSearch(customer)}
                        className="grid w-full gap-2 rounded-xl px-3 py-3 text-left transition hover:bg-cyan-50"
                      >
                        <span className="flex items-center justify-between gap-3">
                          <span className="min-w-0 truncate text-sm font-black text-[#123252]">{customer.name}</span>
                          <StatusBadge status={customer.activityStatus} label={customer.status} />
                        </span>
                        <span className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>{customer.city || "Cidade nao informada"}</span>
                          <span>{customer.preferredSeller}</span>
                          <span>{customer.totalPurchases} compras</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-4 text-sm text-slate-500">Nenhum cliente encontrado com esse nome.</p>
                )}
              </motion.div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label={themeLabel}
            title={themeLabel}
            onClick={() => onThemeChange(nextTheme)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/15 focus-visible:outline-white/40"
          >
            <ThemeIcon size={17} className="shrink-0" />
          </button>
          <div ref={quickActionRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setActionOpen((current) => !current)}
              className="flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-white/20 bg-white px-3 text-sm font-semibold text-[#0753a6] shadow-sm transition hover:bg-cyan-50"
            >
              <Plus size={17} />
              Nova ação
              <ChevronRight size={15} className={`transition ${actionOpen ? "rotate-90" : ""}`} />
            </button>
            {actionOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="crm-quick-actions-menu absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-xl border border-blue-100 bg-white p-2 text-slate-900 shadow-2xl"
              >
                {quickActions.map((action) => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => {
                        setActionOpen(false);
                        onQuickAction(action.id);
                      }}
                      className="crm-quick-action-item flex w-full gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-cyan-50"
                    >
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0753a6] text-white">
                        <Icon size={17} />
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{action.label}</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">{action.description}</span>
                      </span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </div>
          <div ref={notificationRef} className="relative">
            <button
              type="button"
              aria-label="Abrir notificacoes"
              onClick={() => setNotificationOpen((current) => !current)}
              className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
            >
              <Bell size={18} />
              {notifications.length > 0 && (
                <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-300 px-1 text-[10px] font-black text-amber-950">
                  {Math.min(9, notifications.length)}
                </span>
              )}
            </button>
            {notificationOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="fixed left-3 right-3 top-[calc(4.5rem+env(safe-area-inset-top))] z-50 flex max-h-[calc(100dvh-5.25rem)] flex-col overflow-hidden rounded-2xl border border-blue-100 bg-white text-slate-900 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-12 sm:max-h-[calc(100dvh-5rem)] sm:w-[27rem]"
              >
                <div className="flex shrink-0 items-start justify-between gap-3 border-b border-blue-50 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-[#123252]">Notificacoes comerciais</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">Carteira, retornos, agenda e avisos do CRM.</p>
                  </div>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void onClearNotifications()}
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-blue-100 bg-[#f8fbff] px-2.5 text-xs font-bold text-[#0753a6] transition hover:border-cyan-300 hover:bg-cyan-50"
                    >
                      <Trash2 size={13} />
                      Limpar
                    </button>
                  )}
                </div>
                <div className="grid shrink-0 gap-2 border-b border-blue-50 bg-[#f8fbff] px-4 py-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => void onEnablePush()}
                      disabled={pushStatus === "activating" || pushStatus === "active"}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-blue-100 bg-white px-2 text-xs font-bold text-[#0753a6] transition hover:border-cyan-300 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Bell size={13} />
                      {pushStatus === "active"
                        ? "Push ativo"
                        : pushStatus === "activating"
                          ? "Ativando..."
                          : "Ativar push"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void onTestDevicePush()}
                      className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-blue-100 bg-white px-2 text-xs font-bold text-[#0753a6] transition hover:border-cyan-300 hover:bg-cyan-50"
                    >
                      <Bell size={13} />
                      Testar local
                    </button>
                    {user.role === "administrador" && (
                      <button
                        type="button"
                        onClick={() => void onSendTestNotifications()}
                        className="col-span-2 inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-blue-100 bg-white px-2 text-xs font-bold text-[#0753a6] transition hover:border-cyan-300 hover:bg-cyan-50 sm:col-span-1"
                      >
                        <Send size={13} />
                        Testar todos
                      </button>
                    )}
                  </div>
                  {!notificationSchemaReady && (
                    <p className="text-xs leading-5 text-amber-700">
                      A estrutura persistente de notificacoes ainda precisa ser aplicada no Supabase.
                    </p>
                  )}
                  {pushStatus === "blocked" && (
                    <p className="text-xs leading-5 text-amber-700">Permissao bloqueada no navegador deste aparelho.</p>
                  )}
                  {pushStatus === "unsupported" && (
                    <p className="text-xs leading-5 text-slate-500">Este navegador nao oferece Web Push para PWA.</p>
                  )}
                  {(devicePushTestStatus || pushTestStatus || notificationError) && (
                    <p className="text-xs leading-5 text-slate-500">
                      {devicePushTestStatus || pushTestStatus || notificationError}
                    </p>
                  )}
                </div>
                {notifications.length ? (
                  <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
                    {notifications.slice(0, 8).map((notification) => (
                      <button
                        key={notification.id}
                        type="button"
                        onClick={() => openNotification(notification)}
                        className="grid w-full gap-1 rounded-xl px-3 py-3 text-left transition hover:bg-cyan-50"
                      >
                        <span className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${notificationToneClass(notification.tone)}`} />
                          <span className="min-w-0 truncate text-sm font-bold text-[#123252]">{notification.title}</span>
                        </span>
                        <span className="text-xs leading-5 text-slate-500">{notification.description}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="m-3 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-4 text-sm text-emerald-800">
                    Nada urgente agora. A rotina comercial esta em dia.
                  </p>
                )}
              </motion.div>
            )}
          </div>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-cyan-400 text-xs font-bold text-[#06356c]">
              {user.name
                .split(" ")
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </div>
            <span className="hidden text-sm font-medium text-white sm:block">
              {user.name}
              <span className="block text-[10px] font-normal capitalize text-blue-100">
                {user.role}
              </span>
            </span>
          </div>
          <button
            type="button"
            aria-label="Sair"
            onClick={() => void onLogout()}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white hover:bg-white/15"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </header>
  );
}

function CrmResults({
  customers,
  contactRecords,
  sales,
  sellers,
  refreshing,
  refreshedAt,
  refreshError,
  onRefresh,
}: {
  customers: CustomerRow[];
  contactRecords: ContactRecord[];
  sales: SaleRow[];
  sellers: SellerRow[];
  refreshing: boolean;
  refreshedAt: string | null;
  refreshError: string;
  onRefresh: () => Promise<void>;
}) {
  const currentMonth = crmReferenceDate.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const availableMonths = useMemo(
    () => sales
      .filter((sale) => sale.approved)
      .map((sale) => sale.soldAt.slice(0, 7))
      .filter((month) => /^\d{4}-\d{2}$/u.test(month))
      .sort(),
    [sales],
  );
  const firstAvailableMonth = availableMonths[0] ?? currentMonth;
  const selectedMonthLabel = formatCrmResultMonth(selectedMonth);
  const allAttribution = useMemo(
    () => buildCrmAttributionSummary({ customers, sales, contactRecords }),
    [contactRecords, customers, sales],
  );
  const attribution = useMemo(
    () => buildCrmAttributionSummary({
      customers,
      sales,
      contactRecords,
      saleMonth: selectedMonth,
    }),
    [contactRecords, customers, sales, selectedMonth],
  );
  const roi = attribution.totalAttributedRevenue ? Math.max(1, Math.round(attribution.totalAttributedRevenue / 350)) : 0;
  const latestTrackedSales = attribution.trackedSales
    .slice()
    .sort((left, right) => right.sale.soldAt.localeCompare(left.sale.soldAt) || right.sale.uniplusId - left.sale.uniplusId)
    .slice(0, 8);
  const attributionTrend = buildAttributionTrend(allAttribution.trackedSales);
  const sellerResultRows = buildSellerResultRows(attribution.trackedSales, sellers);
  const sellerRecoveryRanking = sellerResultRows.filter((row) => row.totalRevenue > 0).slice(0, 5);
  const attributionMixData = attribution.windowRows.map((row, index) => ({
    ...row,
    color: crmResultsMixColors[index] ?? "var(--primary)",
  }));
  const attributionMixTotal = attributionMixData.reduce((total, row) => total + row.weightedValue, 0);
  const directAttributionShare = attributionMixTotal > 0
    ? Math.round((((attributionMixData[0]?.weightedValue) ?? 0) / attributionMixTotal) * 100)
    : 0;
  const recoveredShare = attribution.totalAttributedRevenue > 0
    ? (attribution.recoveredRevenue / attribution.totalAttributedRevenue) * 100
    : 0;
  const influencedShare = attribution.totalAttributedRevenue > 0
    ? (attribution.influencedRevenue / attribution.totalAttributedRevenue) * 100
    : 0;
  const trackedRevenue = attribution.totalAttributedRevenue + attribution.relationshipRevenue;
  const relationshipShare = trackedRevenue > 0
    ? (attribution.relationshipRevenue / trackedRevenue) * 100
    : 0;

  return (
    <div
      className="space-y-5 text-[var(--foreground)]"
      style={crmResultsVisualTokens}
    >
      <header className="flex flex-col gap-5 px-1 py-1 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--primary)]">
            Resultados de performance
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Dashboard CRM</h1>
          <p className="mt-1 max-w-xl text-sm text-[var(--muted-foreground)]">
            Ganhos reais atribuídos a contatos e ações comerciais antes do ciclo de compra.
          </p>
        </div>
        <div className="flex max-w-full flex-col gap-2 sm:items-end">
          <label className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2 text-xs font-medium text-[var(--muted-foreground)] shadow-sm">
            <CalendarDays size={16} className="text-[var(--primary)]" aria-hidden="true" />
            <span className="sr-only">Mes dos resultados</span>
            <input
              type="month"
              value={selectedMonth}
              min={firstAvailableMonth}
              max={currentMonth}
              onInput={(event) => setSelectedMonth(event.currentTarget.value || currentMonth)}
              aria-label="Mes dos resultados do CRM"
              className="min-w-0 bg-transparent font-semibold text-[var(--foreground)] outline-none"
            />
          </label>
          <ResultsRefreshControl
            refreshing={refreshing}
            refreshedAt={refreshedAt}
            error={refreshError}
            onRefresh={onRefresh}
          />
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CrmResultsMetricCard
          label="Faturamento recuperado"
          value={formatCurrency(attribution.recoveredRevenue)}
          detail={`${Math.round(recoveredShare)}% do total atribuído`}
          progress={recoveredShare}
          tone="secondary"
        />
        <CrmResultsMetricCard
          label="Faturamento influenciado"
          value={formatCurrency(attribution.influencedRevenue)}
          detail={`${Math.round(influencedShare)}% do total atribuído`}
          progress={influencedShare}
        />
        <CrmResultsMetricCard
          label="Total atribuído"
          value={formatCurrency(attribution.totalAttributedRevenue)}
          detail={`${attribution.attributedSales.length} venda(s) em ${selectedMonthLabel}`}
          progress={attribution.totalAttributedRevenue > 0 ? 100 : 0}
        />
        <CrmResultsMetricCard
          label="Clientes convertidos"
          value={`${attribution.convertedCustomers}`}
          detail={`${attribution.conversionRate}% de conversão`}
          progress={attribution.conversionRate}
        />
        <CrmResultsMetricCard
          label="ROI estimado"
          value={`${roi}x`}
          detail="Retorno sobre a operação comercial"
          progress={Math.min(roi * 10, 100)}
          tone="accent"
        />
        <CrmResultsMetricCard
          label="Receita de relacionamento"
          value={formatCurrency(attribution.relationshipRevenue)}
          detail={`${attribution.relationshipSales.length} compra(s) após 30 dias`}
          progress={relationshipShare}
          tone="secondary"
        />
        <CrmResultsMetricCard
          label="Taxa de conversão"
          value={`${attribution.conversionRate}%`}
          detail={`${attribution.convertedCustomers} cliente(s) convertido(s)`}
          progress={attribution.conversionRate}
        />
        <CrmResultsMetricCard
          label="Ticket recuperado"
          value={formatCurrency(attribution.averageRecoveredTicket)}
          detail="Média por venda recuperada"
          progress={recoveredShare}
          tone="accent"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden lg:col-span-2">
          <CardHeader className="flex-col justify-between sm:flex-row sm:items-center">
            <div className="min-w-0 space-y-1">
              <CardTitle>Compras após contato por mês</CardTitle>
              <CardDescription>Últimos seis meses · valores destacados de {selectedMonthLabel}</CardDescription>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--primary)]">
              <BarChart3 size={18} role="img" aria-label="Compras após contato por mês" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="mb-5 flex flex-wrap gap-x-8 gap-y-3">
              <span className="inline-flex items-center gap-2.5">
                <span className="size-2.5 rounded-full bg-[var(--secondary)]" />
                <span>
                  <span className="block text-xs text-[var(--muted-foreground)]">Recuperado · até 10 dias ou mês seguinte</span>
                  <strong className="mt-0.5 block text-sm font-semibold text-[var(--foreground)]">
                    {formatCurrency(attribution.recoveredRevenue)}
                  </strong>
                </span>
              </span>
              <span className="inline-flex items-center gap-2.5">
                <span className="size-2.5 rounded-full bg-[var(--primary)]" />
                <span>
                  <span className="block text-xs text-[var(--muted-foreground)]">Influenciado · 11 a 30 dias</span>
                  <strong className="mt-0.5 block text-sm font-semibold text-[var(--foreground)]">
                    {formatCurrency(attribution.influencedRevenue)}
                  </strong>
                </span>
              </span>
              <span className="inline-flex items-center gap-2.5">
                <span className="size-2.5 rounded-full bg-[var(--muted-foreground)]" />
                <span>
                  <span className="block text-xs text-[var(--muted-foreground)]">Relacionamento · após 30 dias</span>
                  <strong className="mt-0.5 block text-sm font-semibold text-[var(--foreground)]">
                    {formatCurrency(attribution.relationshipRevenue)}
                  </strong>
                </span>
              </span>
            </div>
            <div className="h-72 sm:h-80">
              <MeasuredChart>
                {({ width, height }) => (
                  <BarChart
                    width={width}
                    height={height}
                    data={attributionTrend}
                    margin={{ top: 8, right: 4, bottom: 0, left: 4 }}
                    barGap={5}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="mes"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={10}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={66}
                      tickFormatter={formatResultsAxisValue}
                      tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                    />
                    <Tooltip
                      content={<CrmResultsChartTooltip />}
                      cursor={{ fill: "var(--muted)", opacity: 0.55 }}
                    />
                    <Bar
                      dataKey="recuperado"
                      fill="var(--secondary)"
                      radius={[6, 6, 2, 2]}
                      maxBarSize={34}
                    />
                    <Bar
                      dataKey="influenciado"
                      fill="var(--primary)"
                      radius={[6, 6, 2, 2]}
                      maxBarSize={34}
                    />
                    <Bar
                      dataKey="relacionamento"
                      fill="var(--muted-foreground)"
                      radius={[6, 6, 2, 2]}
                      maxBarSize={34}
                    />
                  </BarChart>
                )}
              </MeasuredChart>
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden lg:col-span-1">
          <CardHeader className="items-center justify-between">
            <div className="min-w-0 space-y-1">
              <CardTitle>Mix de atribuição</CardTitle>
              <CardDescription>Distribuição pela janela temporal</CardDescription>
            </div>
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--primary)]">
              <PieChart size={18} role="img" aria-label="Mix de atribuição" />
            </span>
          </CardHeader>
          <CardContent>
            <div className="relative mx-auto h-56 max-w-72">
              <MeasuredChart>
                {({ width, height }) => (
                  <RePieChart width={width} height={height}>
                    <Pie
                      data={attributionMixData}
                      dataKey="weightedValue"
                      nameKey="label"
                      innerRadius="62%"
                      outerRadius="82%"
                      paddingAngle={attributionMixData.filter((row) => row.weightedValue > 0).length > 1 ? 3 : 0}
                      stroke="var(--card)"
                      strokeWidth={2}
                    >
                      {attributionMixData.map((row) => (
                        <Cell key={row.id} fill={row.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CrmResultsMixTooltip />} />
                  </RePieChart>
                )}
              </MeasuredChart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <strong className="text-2xl font-semibold">{directAttributionShare}%</strong>
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted-foreground)]">
                  Direto
                </span>
              </div>
            </div>
            <div className="mt-2 space-y-3">
              {attributionMixData.map((row) => (
                <div key={row.id} className="flex items-center gap-3 text-xs">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
                  <span className="min-w-0 flex-1 truncate text-[var(--muted-foreground)]">
                    {row.label} · {row.kind === "relationship" ? "observado" : `${Math.round(row.weight * 100)}%`}
                  </span>
                  <span className="shrink-0 font-medium">{formatCurrency(row.weightedValue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

        <Card className="overflow-hidden">
          <CardHeader className="flex-col justify-between sm:flex-row sm:items-center">
            <div className="min-w-0 space-y-1">
              <CardTitle>Resultado por vendedor</CardTitle>
              <CardDescription>
                Resultado de {selectedMonthLabel}, separado por tipo de contribuição comercial.
              </CardDescription>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <UiBadge>{sellerResultRows.length} vendedor(es)</UiBadge>
              <span className="flex size-10 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--primary)]">
                <UsersRound size={19} role="img" aria-label="Resultado por vendedor" />
              </span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table aria-label="Resultado por vendedor">
              <TableHeader>
                <TableRow className="hover:bg-[var(--muted)]">
                  <TableHead className="w-[62%] sm:w-[46%] lg:w-[34%]">Vendedor</TableHead>
                  <TableHead className="hidden md:table-cell">Recuperado</TableHead>
                  <TableHead className="hidden lg:table-cell">Influenciado</TableHead>
                  <TableHead className="hidden lg:table-cell">Relacionamento</TableHead>
                  <TableHead className="text-right">Total atribuído</TableHead>
                  <TableHead className="hidden text-center xl:table-cell">Clientes</TableHead>
                  <TableHead className="hidden text-center xl:table-cell">Vendas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sellerResultRows.map((row) => {
                  const sellerProfile = sellers.find((seller) => seller.name === row.name);
                  const sellerRole = sellerProfile?.supervisor ? "Supervisor" : "Vendedor";

                  return (
                    <TableRow key={row.name}>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-3">
                          <Avatar>
                            <AvatarFallback>{getNameInitials(row.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{row.name}</p>
                            <p className="truncate text-xs text-[var(--muted-foreground)]">
                              {sellerProfile?.email ? `${sellerRole} · ${sellerProfile.email}` : sellerRole}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="whitespace-nowrap font-semibold text-[var(--secondary)]">
                            {formatCurrency(row.recoveredRevenue)}
                          </span>
                          <UiBadge variant="secondary">Direto</UiBadge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="whitespace-nowrap font-semibold text-[var(--primary)]">
                            {formatCurrency(row.influencedRevenue)}
                          </span>
                          <UiBadge variant="primary">Influência</UiBadge>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="whitespace-nowrap font-semibold text-[var(--muted-foreground)]">
                            {formatCurrency(row.relationshipRevenue)}
                          </span>
                          <UiBadge variant="secondary">Após 30 dias</UiBadge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <p className="whitespace-nowrap font-semibold">{formatCurrency(row.totalRevenue)}</p>
                        <p className="mt-1 text-xs text-[var(--muted-foreground)] md:hidden">
                          {formatCurrency(row.recoveredRevenue)} recuperado · {formatCurrency(row.relationshipRevenue)} relacionamento
                        </p>
                      </TableCell>
                      <TableCell className="hidden text-center xl:table-cell">{row.customers}</TableCell>
                      <TableCell className="hidden text-center xl:table-cell">{row.sales}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            {!sellerResultRows.length && (
              <div className="m-5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] p-5 text-center text-sm text-[var(--muted-foreground)]">
                Nenhuma venda atribuída por vendedor ainda.
              </div>
            )}
          </CardContent>
        </Card>

      <Card className="overflow-hidden">
        <CardHeader className="items-center justify-between">
          <div className="min-w-0 space-y-1">
            <CardTitle>Ranking por recuperação</CardTitle>
            <CardDescription>{sellerRecoveryRanking.length} vendedor(es) com receita atribuída em {selectedMonthLabel}.</CardDescription>
          </div>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)] text-[var(--primary)]">
            <Trophy size={19} role="img" aria-label="Ranking por recuperação" />
          </span>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-2">
            {sellerRecoveryRanking.map((seller, index) => {
              const leaderValue = sellerRecoveryRanking[0]?.totalRevenue ?? 0;
              const relativeValue = leaderValue > 0 ? (seller.totalRevenue / leaderValue) * 100 : 0;

              return (
                <div key={seller.name} className="space-y-2.5 rounded-lg bg-[var(--muted)] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                        index === 0
                          ? "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]"
                          : "bg-[var(--card)] text-[var(--foreground)]"
                      }`}
                    >
                      {index + 1}
                    </span>
                    <Avatar className="size-9">
                      <AvatarFallback>{getNameInitials(seller.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{seller.name}</p>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        {seller.sales} venda(s) · {seller.customers} cliente(s)
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-[var(--primary)]">
                      {formatCurrency(seller.totalRevenue)}
                    </p>
                  </div>
                  <Progress value={relativeValue} aria-label={`${seller.name}: ${Math.round(relativeValue)}% do líder`} />
                </div>
              );
            })}
            {!sellerRecoveryRanking.length && (
              <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--muted)] p-5 text-center text-sm text-[var(--muted-foreground)] lg:col-span-2">
                Nenhuma venda atribuída ao CRM ainda.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title={`Top clientes após contato · ${selectedMonthLabel}`} icon={CheckCircle2}>
          <SimpleRows
            rows={attribution.customerRows.slice(0, 6).map((customer) => [
              customer.customerName,
              formatCurrency(customer.weightedValue),
              `${customer.sales} venda(s) · ${customer.bestWindow}`,
            ])}
            empty="Nenhuma compra após contato neste mês."
          />
        </Panel>
        <Panel title={`Últimas compras após contato · ${selectedMonthLabel}`} icon={ShoppingBag}>
          <SimpleRows
            rows={latestTrackedSales.map((item) => [
              `#${item.sale.uniplusId} · ${item.customer?.name ?? item.contact.customerName}`,
              formatCurrency(item.weightedValue),
              `${item.daysAfterContact} dia(s) após contato · ${item.window.kind === "relationship" ? "relacionamento" : "atribuída"}`,
            ])}
            empty="Nenhuma compra após contato neste mês."
          />
        </Panel>
      </div>
    </div>
  );
}

function CrmResultsMetricCard({
  label,
  value,
  detail,
  progress,
  tone = "primary",
}: {
  label: string;
  value: string;
  detail: string;
  progress: number;
  tone?: "primary" | "secondary" | "accent";
}) {
  const toneClass = tone === "secondary"
    ? "bg-[var(--secondary)]"
    : tone === "accent"
      ? "bg-[var(--accent)]"
      : "bg-[var(--primary)]";

  return (
    <Card className="min-h-32 overflow-hidden">
      <CardContent className="flex h-full flex-col p-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">{label}</p>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-[var(--muted)] text-[var(--muted-foreground)]">
            <BarChart3 size={14} aria-hidden="true" />
          </span>
        </div>
        <p className="mt-3 text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
        <p className="mt-1 min-h-8 text-[11px] leading-4 text-[var(--muted-foreground)]">{detail}</p>
        <Progress
          value={progress}
          indicatorClassName={toneClass}
          aria-label={`${label}: ${Math.round(progress)}%`}
          className="mt-auto"
        />
      </CardContent>
    </Card>
  );
}

function getNameInitials(name: string) {
  return name
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

function CrmResultsChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: ReadonlyArray<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: string | number;
  }>;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="min-w-44 rounded-lg border border-[var(--border)] bg-[var(--popover)] p-3 text-[var(--foreground)] shadow-md">
      <p className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">{label}</p>
      <div className="space-y-1.5">
        {payload.map((item) => {
          const itemKey = String(item.dataKey ?? item.name ?? "valor");
          const itemLabel = itemKey === "recuperado"
            ? "Recuperado"
            : itemKey === "influenciado"
              ? "Influenciado"
              : "Relacionamento";

          return (
            <div key={itemKey} className="flex items-center justify-between gap-4 text-xs">
              <span className="inline-flex items-center gap-2 text-[var(--muted-foreground)]">
                <span className="size-2 rounded-full" style={{ backgroundColor: item.color }} />
                {itemLabel}
              </span>
              <span className="font-medium">{formatCurrency(Number(item.value ?? 0))}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatResultsAxisValue(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCrmResultMonth(month: string) {
  const match = month.match(/^(\d{4})-(\d{2})$/u);
  if (!match) return month;

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)));
}

function CrmResultsMixTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{
    name?: string | number;
    value?: string | number;
    payload?: {
      sales?: number;
      customers?: number;
      weight?: number;
    };
  }>;
}) {
  const item = payload?.[0];
  if (!active || !item) return null;

  return (
    <div className="min-w-40 rounded-lg border border-[var(--border)] bg-[var(--popover)] p-3 text-[var(--foreground)] shadow-md">
      <p className="text-xs font-medium">{item.name}</p>
      <p className="mt-1 text-sm font-semibold">{formatCurrency(Number(item.value ?? 0))}</p>
      <p className="mt-1 text-[11px] text-[var(--muted-foreground)]">
        {item.payload?.sales ?? 0} venda(s) · {item.payload?.customers ?? 0} cliente(s)
      </p>
    </div>
  );
}

function ResultsRefreshControl({
  refreshing,
  refreshedAt,
  error,
  onRefresh,
}: {
  refreshing: boolean;
  refreshedAt: string | null;
  error: string;
  onRefresh: () => Promise<void>;
}) {
  const status = error
    ? "Falha ao atualizar"
    : refreshedAt
      ? `Atualizado às ${new Intl.DateTimeFormat("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }).format(new Date(refreshedAt))}`
      : "Dados sincronizados";

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2 sm:justify-end">
      <div
        className={`hidden items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--muted)] px-3 py-2 text-xs font-medium sm:flex ${
          error ? "text-[var(--destructive)]" : "text-[var(--muted-foreground)]"
        }`}
      >
        <span className={`size-2 rounded-full ${error ? "bg-[var(--destructive)]" : "bg-[var(--secondary)]"}`} />
        {status}
      </div>
      <button
        type="button"
        onClick={() => void onRefresh()}
        disabled={refreshing}
        aria-label="Atualizar resultados do CRM"
        title="Atualizar resultados do CRM"
        className="flex h-10 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-foreground)] shadow-sm transition hover:bg-[color-mix(in_srgb,var(--primary)_88%,CanvasText_12%)] disabled:cursor-wait disabled:opacity-70"
      >
        {refreshing ? <AppLoadingMark active /> : <RefreshCcw size={18} />}
        <span>{refreshing ? "Atualizando" : "Atualizar"}</span>
      </button>
    </div>
  );
}

function buildAttributionTrend(attributedSales: CrmAttributedSale[]) {
  const labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const referenceMatch = crmReferenceDate.match(/^(\d{4})-(\d{2})/u);
  const referenceYear = Number(referenceMatch?.[1] ?? new Date().getFullYear());
  const referenceMonth = Number(referenceMatch?.[2] ?? new Date().getMonth() + 1) - 1;
  const rows = new Map<string, {
    mes: string;
    recuperado: number;
    influenciado: number;
    relacionamento: number;
  }>();

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(Date.UTC(referenceYear, referenceMonth - offset, 1));
    const month = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    rows.set(month, {
      mes: labels[date.getUTCMonth()],
      recuperado: 0,
      influenciado: 0,
      relacionamento: 0,
    });
  }

  for (const item of attributedSales) {
    const month = item.sale.soldAt.slice(0, 7);
    const current = rows.get(month);
    if (!current) continue;

    if (item.window.kind === "recovered") {
      current.recuperado += item.weightedValue;
    } else if (item.window.kind === "influenced") {
      current.influenciado += item.weightedValue;
    } else {
      current.relacionamento += item.sale.totalValue;
    }
  }

  return [...rows.values()]
    .map((row) => ({
      mes: row.mes,
      recuperado: Math.round(row.recuperado),
      influenciado: Math.round(row.influenciado),
      relacionamento: Math.round(row.relacionamento),
    }));
}

function buildSellerResultRows(attributedSales: CrmAttributedSale[], availableSellers: SellerRow[]) {
  const rows = new Map<string, {
    name: string;
    recoveredRevenue: number;
    influencedRevenue: number;
    relationshipRevenue: number;
    totalRevenue: number;
    sales: number;
    customerIds: Set<string>;
  }>();

  for (const item of attributedSales) {
    const seller =
      availableSellers.find((entry) => entry.name === item.contact.responsible) ??
      availableSellers.find((entry) => entry.id === item.sale.sellerId);
    const name = seller?.name ?? item.contact.responsible ?? item.customer?.preferredSeller ?? "Sem vendedor";
    const current = rows.get(name) ?? {
      name,
      recoveredRevenue: 0,
      influencedRevenue: 0,
      relationshipRevenue: 0,
      totalRevenue: 0,
      sales: 0,
      customerIds: new Set<string>(),
    };

    if (item.window.kind === "recovered") {
      current.recoveredRevenue += item.weightedValue;
    } else if (item.window.kind === "influenced") {
      current.influencedRevenue += item.weightedValue;
    } else {
      current.relationshipRevenue += item.sale.totalValue;
    }
    if (item.window.kind !== "relationship") {
      current.totalRevenue += item.weightedValue;
    }
    current.sales += 1;
    current.customerIds.add(item.sale.customerId);
    rows.set(name, current);
  }

  return [...rows.values()]
    .map((row) => ({
      name: row.name,
      recoveredRevenue: Math.round(row.recoveredRevenue),
      influencedRevenue: Math.round(row.influencedRevenue),
      relationshipRevenue: Math.round(row.relationshipRevenue),
      totalRevenue: Math.round(row.totalRevenue),
      sales: row.sales,
      customers: row.customerIds.size,
    }))
    .sort((left, right) => right.totalRevenue - left.totalRevenue);
}

function SalesModule({
  customers,
  sales,
  saleItems,
}: {
  customers: CustomerRow[];
  sales: SaleRow[];
  saleItems: SaleItemRow[];
}) {
  const [viewMode, setViewMode] = useState<"latest" | "all">("latest");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dateFromFilter, setDateFromFilter] = useState("");
  const [dateToFilter, setDateToFilter] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(25);
  const [syncLogs, setSyncLogs] = useState<SyncLogResponse | null>(null);
  const [selectedSaleId, setSelectedSaleId] = useState(sales[0]?.id ?? "");
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const itemsBySale = new Map<string, SaleItemRow[]>();
  for (const item of saleItems) {
    const current = itemsBySale.get(item.saleId) ?? [];
    current.push(item);
    itemsBySale.set(item.saleId, current);
  }

  useEffect(() => {
    let active = true;
    fetch("/api/crm/sync/logs", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Falha ao carregar logs.");
        return (await response.json()) as SyncLogResponse;
      })
      .then((result) => {
        if (active) setSyncLogs(result);
      })
      .catch(() => {
        if (active) setSyncLogs(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const latestSales = sales
    .slice()
    .sort(compareSalesByLastSync)
    .slice(0, 5);
  const baseSales = viewMode === "latest" ? latestSales : sales;
  const statusOptions = Array.from(new Set(sales.map((sale) => sale.approved ? "Aprovada" : sale.status).filter(Boolean))).sort();
  const filteredSales = baseSales.filter((sale) => {
    const saleCustomer = customerById.get(sale.customerId);
    const statusLabel = sale.approved ? "Aprovada" : sale.status;
    const normalizedQuery = query.trim().toLowerCase();
    const matchesQuery =
      !normalizedQuery ||
      String(sale.uniplusId).includes(normalizedQuery) ||
      saleCustomer?.name.toLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === "todos" || statusLabel === statusFilter;
    const matchesDateFrom = !dateFromFilter || sale.soldAt >= dateFromFilter;
    const matchesDateTo = !dateToFilter || sale.soldAt <= dateToFilter;
    return matchesQuery && matchesStatus && matchesDateFrom && matchesDateTo;
  });
  const displayedSales = filteredSales.slice(0, visibleLimit);
  const selectedSale =
    displayedSales.find((sale) => sale.id === selectedSaleId) ??
    filteredSales[0] ??
    baseSales[0];
  const selectedItems = selectedSale ? itemsBySale.get(selectedSale.id) ?? [] : [];
  const displayedRevenue = displayedSales.reduce((total, sale) => total + sale.totalValue, 0);
  const displayedAverageTicket = displayedSales.length ? displayedRevenue / displayedSales.length : 0;
  const latestSyncLabel = syncLogs?.latest
    ? formatDateTime(syncLogs.latest.inicio)
    : "Sem registro";

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Comercial" title="Vendas" description="Conferência das vendas importadas do ERP, respeitando uma venda para vários itens." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Vendas importadas" value={String(sales.length)} />
        <MetricCard label="Vendas no cálculo" value={`${displayedSales.length} de ${filteredSales.length}`} />
        <MetricCard label="Faturamento filtrado" value={formatCurrency(displayedRevenue)} />
        <MetricCard label="Ticket médio filtrado" value={formatCurrency(displayedAverageTicket)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Listagem de vendas" icon={ShoppingBag} action={displayedSales.length + " de " + filteredSales.length + " registros"}>
          <div className="mb-4 space-y-3">
            <div className="flex w-full rounded-lg border border-blue-100 bg-[#f8fbff] p-1 sm:inline-flex sm:w-auto">
              {[
                ["latest", "Última sincronização"],
                ["all", "Todas"],
              ].map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => {
                    setViewMode(mode as "latest" | "all");
                    setVisibleLimit(25);
                  }}
                  className={
                    "h-9 flex-1 rounded-md px-3 text-xs font-bold transition sm:flex-none " +
                    (viewMode === mode ? "bg-[#0753a6] text-white shadow-sm" : "text-slate-500 hover:bg-white")
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr]">
              <div className="flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-[#f8fbff] px-3 focus-within:border-cyan-400">
                <Search size={17} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setVisibleLimit(25);
                  }}
                  placeholder="Venda ou cliente"
                  className="w-full bg-transparent text-sm outline-none"
                />
              </div>
              <FilterSelect
                label="Status"
                value={statusFilter}
                onChange={(value) => {
                  setStatusFilter(value);
                  setVisibleLimit(25);
                }}
              >
                <option value="todos">Todos os status</option>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </FilterSelect>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">De</span>
                <input
                  type="date"
                  value={dateFromFilter}
                  max={dateToFilter || undefined}
                  onChange={(event) => {
                    setDateFromFilter(event.target.value);
                    setVisibleLimit(25);
                  }}
                  className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Até</span>
                <input
                  type="date"
                  value={dateToFilter}
                  min={dateFromFilter || undefined}
                  onChange={(event) => {
                    setDateToFilter(event.target.value);
                    setVisibleLimit(25);
                  }}
                  className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400"
                />
              </label>
            </div>
            <div className="rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-xs font-medium text-cyan-800">
              Último lote: {latestSyncLabel}. A aba de última sincronização mostra as 5 vendas mais recentes tocadas pelo Sync.
            </div>
          </div>
          <div className="space-y-3 md:hidden">
            {displayedSales.map((sale) => {
              const saleCustomer = customerById.get(sale.customerId);
              const itemCount = itemsBySale.get(sale.id)?.length ?? 0;
              const active = selectedSale?.id === sale.id;

              return (
                <button
                  key={sale.id}
                  type="button"
                  onClick={() => setSelectedSaleId(sale.id)}
                  className={`w-full rounded-xl border p-3 text-left transition ${
                    active ? "border-cyan-300 bg-cyan-50" : "border-blue-50 bg-[#f8fbff] hover:border-cyan-200"
                  }`}
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-black text-[#0753a6]">#{sale.uniplusId}</p>
                      <p className="mt-1 break-words text-sm font-semibold text-[#123252]">
                        {saleCustomer?.name ?? "Cliente não encontrado"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-white px-2 py-1 text-xs font-bold text-cyan-700">
                      {sale.approved ? "Aprovada" : sale.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <MiniStat label="Data" value={formatContactDate(sale.soldAt)} />
                    <MiniStat label="Valor" value={formatCurrency(sale.totalValue)} />
                    <MiniStat label="Itens" value={`${itemCount}`} />
                  </div>
                </button>
              );
            })}
          </div>
          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Venda</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Valor</th>
                  <th className="px-3 py-2">Itens</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {displayedSales.map((sale) => {
                  const saleCustomer = customerById.get(sale.customerId);
                  return (
                    <tr key={sale.id} className="cursor-pointer hover:bg-cyan-50/60" onClick={() => setSelectedSaleId(sale.id)}>
                      <td className="px-3 py-3 font-semibold text-[#0753a6]">#{sale.uniplusId}</td>
                      <td className="px-3 py-3">{saleCustomer?.name ?? "Cliente não encontrado"}</td>
                      <td className="px-3 py-3">{formatContactDate(sale.soldAt)}</td>
                      <td className="px-3 py-3 font-bold">{formatCurrency(sale.totalValue)}</td>
                      <td className="px-3 py-3">{itemsBySale.get(sale.id)?.length ?? 0}</td>
                      <td className="px-3 py-3">{sale.approved ? "Aprovada" : sale.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filteredSales.length && <EmptyState text="Nenhuma venda encontrada para os filtros atuais." />}
          {filteredSales.length > displayedSales.length && (
            <div className="mt-4 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleLimit((current) => current + 25)}
                className="h-10 rounded-lg border border-blue-100 px-4 text-sm font-semibold text-[#0753a6] transition hover:bg-blue-50"
              >
                Carregar mais 25
              </button>
            </div>
          )}
        </Panel>
        <Panel title="Detalhe da venda" icon={FileText}>
          {selectedSale ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-[#f8fbff] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Venda ERP</p>
                <p className="mt-1 text-2xl font-black text-[#123252]">#{selectedSale.uniplusId}</p>
                <p className="mt-1 text-sm text-slate-500">{customerById.get(selectedSale.customerId)?.name}</p>
              </div>
              <SimpleRows
                rows={selectedItems.map((item) => [item.productName, String(item.quantity) + " un.", formatCurrency(item.estimatedValue)])}
                empty="Sem itens vinculados."
              />
              <p className="rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-xs leading-5 text-cyan-800">
                Repetições do mesmo uniplus_venda_id no SQL representam itens. O CRM mantém uma venda única e vários itens vinculados.
              </p>
            </div>
          ) : <EmptyState text="Selecione uma venda para visualizar os itens." />}
        </Panel>
      </div>
    </div>
  );
}

function compareSalesByLastSync(left: SaleRow, right: SaleRow) {
  const leftTime = saleSyncTimestamp(left);
  const rightTime = saleSyncTimestamp(right);
  if (rightTime !== leftTime) return rightTime - leftTime;
  return right.uniplusId - left.uniplusId;
}

function saleSyncTimestamp(sale: SaleRow) {
  const updatedAt = sale.updatedAt ? Date.parse(sale.updatedAt) : Number.NaN;
  if (Number.isFinite(updatedAt)) return updatedAt;
  const soldAt = Date.parse(`${sale.soldAt}T12:00:00Z`);
  return Number.isFinite(soldAt) ? soldAt : 0;
}

function ProductsModule({
  customers,
  alerts,
  products,
  sales,
  saleItems,
}: {
  customers: CustomerRow[];
  alerts: AlertRow[];
  products: ProductRow[];
  sales: SaleRow[];
  saleItems: SaleItemRow[];
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(products.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = products.slice(
    (currentPage - 1) * LIST_PAGE_SIZE,
    currentPage * LIST_PAGE_SIZE,
  );
  const salesById = new Map(sales.map((sale) => [sale.id, sale]));
  const productStats = visibleProducts.map((product) => {
    const productItems = saleItems.filter((item) => item.productId === product.id);
    const buyerIds = new Set(productItems.flatMap((item) => {
      const sale = salesById.get(item.saleId);
      return sale?.customerId ? [sale.customerId] : [];
    }));
    const productAlerts = alerts.filter((alert) => alert.product === product.name);
    return {
      product,
      customers: buyerIds.size,
      potential: customers
        .filter((customer) => buyerIds.has(customer.id))
        .reduce((total, customer) => total + customer.potentialValue, 0),
      alertCount: productAlerts.length,
    };
  });

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Comercial" title="Produtos" description="Gestão comercial dos produtos, recorrência e potencial de recompra." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Produtos" value={`${products.length}`} />
        <MetricCard label="Usam CRM" value={`${products.filter((product) => product.usesCrm).length}`} />
        <MetricCard label="Recompra ativa" value={`${products.filter((product) => product.repurchaseActive).length}`} />
        <MetricCard label="Com alertas" value={`${new Set(alerts.map((alert) => alert.product)).size}`} />
      </div>
      <Panel
        title="Catálogo comercial"
        icon={ClipboardList}
        action={`${productStats.length} de ${products.length} produtos`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Produto</th>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Departamento</th>
                <th className="px-3 py-2">Usa CRM</th>
                <th className="px-3 py-2">Recompra</th>
                <th className="px-3 py-2">Clientes</th>
                <th className="px-3 py-2">Potencial</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {productStats.map(({ product, customers: buyerCount, potential }) => (
                <tr key={product.id} className="hover:bg-cyan-50/60">
                  <td className="px-3 py-3 font-semibold text-[#123252]">{product.name}</td>
                  <td className="px-3 py-3">{product.code}</td>
                  <td className="px-3 py-3">{product.department || "Sem departamento"}</td>
                  <td className="px-3 py-3">{product.usesCrm ? "Sim" : "Não"}</td>
                  <td className="px-3 py-3">{product.repurchaseActive ? `${product.defaultRepurchaseDays ?? "-"} dias` : "Inativa"}</td>
                  <td className="px-3 py-3">{buyerCount}</td>
                  <td className="px-3 py-3 font-bold">{formatCurrency(potential)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!productStats.length && <EmptyState text="Nenhum produto importado no momento." />}
        </div>
        <PaginationControls
          page={currentPage}
          totalItems={products.length}
          itemLabel="produtos"
          onPageChange={setPage}
        />
      </Panel>
    </div>
  );
}

function SellersModule({ customers, alerts }: { customers: CustomerRow[]; alerts: AlertRow[] }) {
  const sellerRows = sellers.map((seller) => {
    const sellerCustomers = customers.filter((customer) => customer.preferredSellerId === seller.id);
    const sellerAlerts = alerts.filter((alert) => alert.seller === seller.name);
    const recoveredContacts = sellerCustomers.filter((customer) => customer.activityStatus === "ativo").length;
    return {
      seller,
      customers: sellerCustomers.length,
      risk: sellerCustomers.filter((customer) => customer.activityStatus === "risco" || customer.activityStatus === "perdido").length,
      alerts: sellerAlerts.length,
      potential: sellerCustomers.reduce((total, customer) => total + customer.potentialValue, 0),
      conversion: sellerCustomers.length ? Math.round((recoveredContacts / sellerCustomers.length) * 100) : seller.conversionRate,
    };
  });

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Equipe" title="Vendedores" description="Performance comercial, carteira, risco, alertas e potencial por vendedor." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Vendedores ativos" value={`${sellerRows.length}`} />
        <MetricCard label="Clientes vinculados" value={`${sellerRows.reduce((total, row) => total + row.customers, 0)}`} />
        <MetricCard label="Alertas ativos" value={`${sellerRows.reduce((total, row) => total + row.alerts, 0)}`} />
        <MetricCard label="Potencial da equipe" value={formatCurrency(sellerRows.reduce((total, row) => total + row.potential, 0))} />
      </div>
      <Panel title="Performance comercial" icon={UsersRound}>
        <div className="grid gap-4 xl:grid-cols-2">
          {sellerRows.map((row) => (
            <div key={row.seller.id} className="rounded-xl border border-blue-100 bg-[#f8fbff] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-lg font-black text-[#123252]">{row.seller.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{row.seller.supervisor ? "Supervisor" : "Vendedor"}</p>
                </div>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{row.conversion}% conversão</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <MiniStat label="Clientes" value={`${row.customers}`} />
                <MiniStat label="Em risco" value={`${row.risk}`} />
                <MiniStat label="Alertas" value={`${row.alerts}`} />
                <MiniStat label="Potencial" value={formatCurrency(row.potential)} />
              </div>
            </div>
          ))}
          {!sellerRows.length && <EmptyState text="Nenhum vendedor disponível na base atual." />}
        </div>
      </Panel>
    </div>
  );
}

function ActivitiesModule({
  contactRecords,
  sales,
  sellers,
  user,
}: {
  contactRecords: ContactRecord[];
  sales: SaleRow[];
  sellers: SellerRow[];
  user: CrmSessionUser;
}) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(contactRecords.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleContactRecords = contactRecords.slice(
    (currentPage - 1) * LIST_PAGE_SIZE,
    currentPage * LIST_PAGE_SIZE,
  );
  const todayIso = new Date().toISOString().slice(0, 10);
  const monthPrefix = todayIso.slice(0, 7);
  const contactMetrics = buildSellerCommercialMetrics(contactRecords, sales, sellers, todayIso)
    .filter((row) => !isHiddenSellerMetricUser(row.responsible));
  const todayContacts = contactRecords.filter(
    (record) => normalizeContactDateIso(record.contactedAt) === todayIso,
  ).length;
  const monthSales = sales.filter((sale) => normalizeContactDateIso(sale.soldAt).startsWith(monthPrefix));
  const monthRevenue = monthSales.reduce((total, sale) => total + sale.totalValue, 0);

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Inteligência" title="Atividades" description="Histórico de contatos, retornos e ações feitas pela equipe." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Atividades" value={`${contactRecords.length}`} />
        <MetricCard label="Contatos hoje" value={`${todayContacts}`} />
        <MetricCard label="Vendas do mês" value={`${monthSales.length}`} />
        <MetricCard label="Faturamento do mês" value={formatCurrency(monthRevenue)} />
      </div>
      {user.role !== "vendedor" && (
        <Panel title="Métricas por vendedor" icon={UsersRound} action="Contatos e vendas">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2">Contatos hoje</th>
                  <th className="px-3 py-2">Vendas hoje</th>
                  <th className="px-3 py-2">Vendas semana</th>
                  <th className="px-3 py-2">Vendas mês</th>
                  <th className="px-3 py-2">Faturamento mês</th>
                  <th className="px-3 py-2">Ticket médio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {contactMetrics.map((row) => (
                  <tr key={row.responsible} className="hover:bg-cyan-50/60">
                    <td className="px-3 py-3 font-semibold text-[#123252]">{row.responsible}</td>
                    <td className="px-3 py-3">{row.contactsToday}</td>
                    <td className="px-3 py-3 font-black text-[#0753a6]">{row.salesToday}</td>
                    <td className="px-3 py-3">{row.salesWeek}</td>
                    <td className="px-3 py-3">{row.salesMonth}</td>
                    <td className="px-3 py-3 font-bold text-[#123252]">{formatCurrency(row.monthRevenue)}</td>
                    <td className="px-3 py-3">{formatCurrency(row.averageTicket)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!contactMetrics.length && <EmptyState text="Nenhum contato registrado pela equipe ainda." />}
          </div>
        </Panel>
      )}
      <Panel
        title="Histórico de contatos"
        icon={Phone}
        action={`${visibleContactRecords.length} de ${contactRecords.length} atividades`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full table-fixed text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="w-[28%] px-3 py-2">Cliente</th>
                <th className="w-[14%] px-3 py-2">Canal</th>
                <th className="w-[18%] px-3 py-2">Resultado</th>
                <th className="w-[24%] px-3 py-2">Responsável</th>
                <th className="w-[16%] px-3 py-2">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {visibleContactRecords.map((record) => (
                <tr key={record.id} className="hover:bg-cyan-50/60">
                  <td className="px-3 py-3 font-semibold text-[#123252]">{record.customerName}</td>
                  <td className="px-3 py-3">{record.channel}</td>
                  <td className="px-3 py-3">{contactOutcomeLabels[record.outcome]}</td>
                  <td className="px-3 py-3">{record.responsible}</td>
                  <td className="px-3 py-3">{formatContactDate(record.contactedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!contactRecords.length && <EmptyState text="Nenhuma atividade registrada ainda." />}
        </div>
        <PaginationControls
          page={currentPage}
          totalItems={contactRecords.length}
          itemLabel="atividades"
          onPageChange={setPage}
        />
      </Panel>
    </div>
  );
}

function CampaignsModule({
  customers,
  alerts,
  products,
  user,
  productCampaigns,
  onProductCampaignsChange,
  openProfile,
  onUpdateContact,
  onRegisterContact,
}: {
  customers: CustomerRow[];
  alerts: AlertRow[];
  products: ProductRow[];
  user: CrmSessionUser;
  productCampaigns: ProductCampaign[];
  onProductCampaignsChange: (campaigns: ProductCampaign[]) => void;
  openProfile: (customer: CustomerRow) => void;
  onUpdateContact: (
    customer: CustomerRow,
    phone: string,
    options?: CustomerContactUpdateOptions,
  ) => Promise<void>;
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  const campaignDefinitions = buildCampaignDefinitions(customers, alerts);
  const configuredCampaignProducts = useMemo(() => buildConfiguredCampaignProducts(products), [products]);
  const [campaignName, setCampaignName] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [campaignMessage, setCampaignMessage] = useState(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);
  const [campaignImageName, setCampaignImageName] = useState("");
  const [campaignImageDataUrl, setCampaignImageDataUrl] = useState("");
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(null);
  const [campaignError, setCampaignError] = useState("");
  const [selectedCampaignId, setSelectedCampaignId] = useState(campaignDefinitions[0]?.id ?? "");
  const selectedCampaign =
    campaignDefinitions.find((campaign) => campaign.id === selectedCampaignId) ??
    campaignDefinitions[0];
  const selectedProductCampaign = productCampaigns.find((campaign) => campaign.id === editingCampaignId) ?? productCampaigns[0];
  const selectedProductCampaignAlerts = selectedProductCampaign
    ? alerts.filter((alert) => alert.status === "pendente" && productCampaignMatchesAlert(selectedProductCampaign, alert))
    : [];
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const normalizedProductSearch = normalizeManualAlertSearch(productSearch.trim());
  const filteredConfiguredProducts = configuredCampaignProducts.filter((product) => {
    if (!normalizedProductSearch) return true;
    return normalizeManualAlertSearch(`${product.name} ${product.code} ${product.department}`).includes(normalizedProductSearch);
  });
  const selectedProductNames = selectedProductIds
    .map((productId) => productById.get(productId)?.name)
    .filter((name): name is string => Boolean(name));

  function resetCampaignForm() {
    setCampaignName("");
    setSelectedProductIds([]);
    setProductSearch("");
    setCampaignMessage(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);
    setCampaignImageName("");
    setCampaignImageDataUrl("");
    setEditingCampaignId(null);
    setCampaignError("");
  }

  function editCampaign(campaign: ProductCampaign) {
    setCampaignName(campaign.name);
    setSelectedProductIds(resolveCampaignProductIds(campaign, configuredCampaignProducts));
    setProductSearch("");
    setCampaignMessage(campaign.messageTemplate);
    setCampaignImageName(campaign.imageName ?? "");
    setCampaignImageDataUrl(campaign.imageDataUrl ?? "");
    setEditingCampaignId(campaign.id);
    setCampaignError("");
  }

  function saveCampaign() {
    const trimmedMessage = campaignMessage.trim();
    if (!selectedProductIds.length) {
      setCampaignError("Selecione pelo menos um item com regra configurada no Motor de Recompra.");
      return;
    }
    if (!trimmedMessage) {
      setCampaignError("Informe a mensagem padrao da campanha.");
      return;
    }

    const campaign: ProductCampaign = {
      id: editingCampaignId ?? `product-campaign-${Date.now()}`,
      name: campaignName.trim() || selectedProductNames[0] || "Campanha de recompra",
      productIds: selectedProductIds,
      productQuery: selectedProductNames.join(", "),
      messageTemplate: trimmedMessage,
      imageName: campaignImageName || undefined,
      imageDataUrl: campaignImageDataUrl || undefined,
      active: true,
      createdAt: productCampaigns.find((item) => item.id === editingCampaignId)?.createdAt ?? new Date().toISOString(),
    };

    onProductCampaignsChange([
      campaign,
      ...productCampaigns.filter((item) => item.id !== campaign.id),
    ]);
    resetCampaignForm();
  }

  function deleteCampaign(id: string) {
    onProductCampaignsChange(productCampaigns.filter((campaign) => campaign.id !== id));
    if (editingCampaignId === id) resetCampaignForm();
  }

  function toggleCampaign(campaign: ProductCampaign) {
    onProductCampaignsChange(productCampaigns.map((item) =>
      item.id === campaign.id ? { ...item, active: !item.active } : item,
    ));
  }

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Inteligencia" title="Campanhas" description="Campanhas por produto integradas aos alertas de recompra." />
      <Panel title="Campanha por produto" icon={Sparkles} action={`${productCampaigns.length} campanha(s)`}>
        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nome</span>
                <input
                  value={campaignName}
                  onChange={(event) => setCampaignName(event.target.value)}
                  placeholder="Promo SIMPARIC TRIO"
                  className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400"
                />
              </label>
              <div className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Itens da campanha</span>
                <div className="mt-2 rounded-lg border border-blue-100 bg-[#f8fbff] p-2">
                  <div className="mb-2 flex h-10 items-center gap-2 rounded-lg bg-white px-3">
                    <Search size={16} className="shrink-0 text-slate-400" />
                    <input
                      value={productSearch}
                      onChange={(event) => setProductSearch(event.target.value)}
                      placeholder="Buscar item configurado"
                      className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                  </div>
                  <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                    {filteredConfiguredProducts.map((product) => {
                      const checked = selectedProductIds.includes(product.id);
                      return (
                        <label
                          key={product.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2 text-sm transition ${
                            checked
                              ? "border-cyan-300 bg-cyan-50 text-[#0753a6]"
                              : "border-blue-50 bg-white text-slate-600 hover:border-cyan-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(event) => {
                              setSelectedProductIds((current) =>
                                event.target.checked
                                  ? [...current, product.id]
                                  : current.filter((id) => id !== product.id),
                              );
                            }}
                            className="mt-1"
                          />
                          <span className="min-w-0">
                            <span className="block truncate font-bold">{product.name}</span>
                            <span className="mt-0.5 block text-xs text-slate-500">
                              {product.code || "Sem codigo"} - {product.defaultRepurchaseDays} dias
                            </span>
                          </span>
                        </label>
                      );
                    })}
                    {!filteredConfiguredProducts.length && (
                      <p className="rounded-lg bg-white px-3 py-2 text-sm text-slate-500">
                        Nenhum item com regra configurada encontrado.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {selectedProductNames.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedProductNames.map((name) => (
                  <span key={name} className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                    {name}
                  </span>
                ))}
              </div>
            )}
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Mensagem padrao</span>
              <textarea
                value={campaignMessage}
                onChange={(event) => setCampaignMessage(event.target.value)}
                rows={6}
                className="mt-2 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 py-2 text-sm outline-none focus:border-cyan-400"
              />
            </label>
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Arte da campanha</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    if (file.size > PRODUCT_CAMPAIGN_IMAGE_MAX_BYTES) {
                      setCampaignError("Use uma imagem com ate 2 MB para salvar a campanha neste computador.");
                      event.currentTarget.value = "";
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () => {
                      setCampaignImageName(file.name);
                      setCampaignImageDataUrl(typeof reader.result === "string" ? reader.result : "");
                      setCampaignError("");
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="mt-2 block w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-[#0753a6] file:px-3 file:py-1.5 file:text-sm file:font-bold file:text-white"
                />
              </label>
              {campaignImageDataUrl && (
                <button
                  type="button"
                  onClick={() => {
                    setCampaignImageName("");
                    setCampaignImageDataUrl("");
                  }}
                  className="h-11 rounded-lg border border-blue-100 bg-white px-3 text-sm font-bold text-[#0753a6] hover:bg-cyan-50"
                >
                  Remover imagem
                </button>
              )}
            </div>
            {campaignImageDataUrl && (
              <div className="rounded-lg border border-blue-100 bg-white p-3">
                <img src={campaignImageDataUrl} alt={campaignImageName || "Arte da campanha"} className="max-h-48 rounded-lg object-contain" />
                <p className="mt-2 text-xs font-semibold text-slate-500">{campaignImageName}</p>
              </div>
            )}
            {campaignError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{campaignError}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={saveCampaign} className="h-11 rounded-lg bg-[#0753a6] px-4 text-sm font-bold text-white hover:bg-[#064987]">
                {editingCampaignId ? "Salvar alteracao" : "Criar campanha"}
              </button>
              {editingCampaignId && (
                <button type="button" onClick={resetCampaignForm} className="h-11 rounded-lg border border-blue-100 bg-white px-4 text-sm font-bold text-[#0753a6] hover:bg-cyan-50">
                  Cancelar edicao
                </button>
              )}
            </div>
          </div>
          <div className="space-y-3">
            {productCampaigns.map((campaign) => {
              const campaignAlerts = alerts.filter((alert) => alert.status === "pendente" && productCampaignMatchesAlert(campaign, alert));
              return (
                <div key={campaign.id} className="rounded-lg border border-blue-100 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-[#123252]">{campaign.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatCampaignProductNames(campaign, productById)} - {campaignAlerts.length} alerta(s) pendente(s)
                      </p>
                      {campaign.imageName && <p className="mt-1 text-xs font-semibold text-cyan-700">Imagem: {campaign.imageName}</p>}
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${campaign.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {campaign.active ? "Ativa" : "Pausada"}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => editCampaign(campaign)} className="h-9 rounded-lg border border-blue-100 bg-white px-3 text-xs font-bold text-[#0753a6] hover:bg-cyan-50">
                      Editar
                    </button>
                    <button type="button" onClick={() => toggleCampaign(campaign)} className="h-9 rounded-lg border border-blue-100 bg-white px-3 text-xs font-bold text-[#0753a6] hover:bg-cyan-50">
                      {campaign.active ? "Pausar" : "Ativar"}
                    </button>
                    <button type="button" onClick={() => deleteCampaign(campaign.id)} className="h-9 rounded-lg border border-red-100 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100">
                      Excluir
                    </button>
                  </div>
                </div>
              );
            })}
            {!productCampaigns.length && <EmptyState text="Crie uma campanha por produto para usar mensagem e imagem direto nos alertas." />}
          </div>
        </div>
      </Panel>

      <Panel title={selectedProductCampaign?.name ?? "Campanha integrada aos alertas"} icon={Bell} action={`${selectedProductCampaignAlerts.length} alertas`}>
        {selectedProductCampaign ? (
          <div className="space-y-3">
            {selectedProductCampaignAlerts.slice(0, 12).map((alert) => {
              const customer = customerById.get(alert.customerId);
              if (!customer) return null;
              return (
                <div key={alert.id} className="grid gap-3 rounded-lg border border-blue-50 bg-white p-3 md:grid-cols-[1fr_auto] md:items-center">
                  <button type="button" onClick={() => openProfile(customer)} className="min-w-0 text-left">
                    <p className="truncate font-bold text-[#123252]">{customer.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{alert.product} - recompra prevista em {alert.recommended}</p>
                  </button>
                  <WhatsAppButton
                    customer={customer}
                    user={user}
                    sellerName={alert.seller}
                    repurchaseProduct={alert.product}
                    campaign={selectedProductCampaign}
                    onUpdateContact={onUpdateContact}
                    onRegisterContact={onRegisterContact}
                    compact
                  />
                </div>
              );
            })}
            {!selectedProductCampaignAlerts.length && <EmptyState text="Nenhum alerta pendente bate com a campanha selecionada." />}
          </div>
        ) : (
          <EmptyState text="Nenhuma campanha por produto criada ainda." />
        )}
      </Panel>

      <Panel title="Publicos inteligentes" icon={UsersRound} action={`${campaignDefinitions.length} modelos`}>
        <div className="grid gap-4 xl:grid-cols-4">
          {campaignDefinitions.map((campaign) => (
            <button
              key={campaign.id}
              type="button"
              onClick={() => setSelectedCampaignId(campaign.id)}
              className={`rounded-xl border p-4 text-left shadow-sm transition ${
                selectedCampaign?.id === campaign.id
                  ? "border-cyan-400 bg-cyan-50"
                  : "border-blue-100 bg-white hover:border-cyan-300 hover:bg-[#f8fbff]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-[#123252]">{campaign.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{campaign.description}</p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-cyan-700">{campaign.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="Publico" value={`${campaign.audience.length}`} />
                <MiniStat label="Ritmo" value={campaign.period} />
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={selectedCampaign?.name ?? "Publico da campanha"} icon={UsersRound} action="20 primeiros">
        {selectedCampaign ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-blue-50 bg-[#f8fbff] px-3 py-2 text-sm leading-6 text-slate-600">
              {selectedCampaign.playbook}
            </div>
            {selectedCampaign.audience.slice(0, 20).map((customer) => (
              <div key={customer.id} className="grid gap-3 rounded-lg border border-blue-50 bg-white p-3 md:grid-cols-[1fr_auto] md:items-center">
                <button type="button" onClick={() => openProfile(customer)} className="min-w-0 text-left">
                  <p className="truncate font-bold text-[#123252]">{customer.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {customer.days} dias sem compra - {customer.preferredSeller} - potencial {customer.potential}
                  </p>
                </button>
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openProfile(customer)}
                    className="h-10 rounded-lg border border-blue-100 bg-white px-3 text-xs font-bold text-[#0753a6] hover:bg-cyan-50"
                  >
                    Perfil
                  </button>
                  <WhatsAppButton
                    customer={customer}
                    user={user}
                    onUpdateContact={onUpdateContact}
                    onRegisterContact={onRegisterContact}
                    compact
                  />
                </div>
              </div>
            ))}
            {!selectedCampaign.audience.length && <EmptyState text="Nenhum cliente entrou neste publico com os filtros atuais." />}
          </div>
        ) : (
          <EmptyState text="Nenhuma campanha disponivel." />
        )}
      </Panel>
    </div>
  );
}

function buildCampaignDefinitions(customers: CustomerRow[], alerts: AlertRow[]) {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const repurchaseCustomerIds = new Set(alerts.filter((alert) => alert.status === "pendente").map((alert) => alert.customerId));

  return [
    {
      id: "inactive-60",
      name: "Clientes sem compra ha 60 dias",
      description: "Recuperacao de clientes parados.",
      period: "Semanal",
      status: "Prioridade",
      playbook: "Comece pelos clientes com maior potencial e WhatsApp valido. A conversa deve lembrar o historico de compra e oferecer ajuda objetiva.",
      audience: customers.filter((customer) => customer.days >= 60).sort((left, right) => right.potentialValue - left.potentialValue),
    },
    {
      id: "repurchase",
      name: "Recompra de produtos recorrentes",
      description: "Clientes com alerta pendente.",
      period: "Diario",
      status: "Ativa",
      playbook: "Use o produto do alerta como gancho. Confirme se o item esta acabando e ja sugira reposicao.",
      audience: [...repurchaseCustomerIds].flatMap((customerId) => customerById.get(customerId) ?? []),
    },
    {
      id: "registration",
      name: "Atualizacao cadastral",
      description: "WhatsApp ausente ou qualidade baixa.",
      period: "Pontual",
      status: "Saneamento",
      playbook: "Antes de campanha grande, corrija WhatsApp/celular. Isso evita perder contato por dado ruim.",
      audience: customers.filter((customer) => !customer.whatsapp || customer.qualityScore < 70),
    },
    {
      id: "conversion",
      name: "Grande chance de conversao",
      description: "Score comercial alto.",
      period: "Quinzenal",
      status: "Consultiva",
      playbook: "Abordagem consultiva: relembre compras anteriores e ofereca itens complementares sem parecer mensagem em massa.",
      audience: customers.filter((customer) => customer.score >= 75).sort((left, right) => right.score - left.score),
    },
  ];
}

function RepurchaseEngineModule({ alerts, user }: { alerts: AlertRow[]; user: CrmSessionUser }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [daysByProduct, setDaysByProduct] = useState<Record<string, string>>({});
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const configurableProducts = snapshot.products;
  const configuredProductIds = new Set(
    configurableProducts
      .filter((product) => product.defaultRepurchaseDays)
      .map((product) => product.id),
  );
  for (const [productId, value] of Object.entries(daysByProduct)) {
    if (Number(value) > 0) configuredProductIds.add(productId);
    else configuredProductIds.delete(productId);
  }
  const manualAlerts = alerts.filter((alert) => alert.origin === "manual");
  const canEditRules = user.role !== "vendedor";

  async function saveProductRule(product: ProductRow, remove = false) {
    if (!canEditRules) return;
    const rawDays = daysByProduct[product.id] ?? "";
    const manualDays = Number(rawDays);
    if (!remove && (!Number.isFinite(manualDays) || manualDays <= 0)) {
      setMessage("Informe uma quantidade valida de dias.");
      return;
    }

    setSavingProductId(product.id);
    setMessage("");
    try {
      const response = await fetch("/api/crm/products", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: product.id,
          defaultRepurchaseDays: remove ? null : Math.round(manualDays),
        }),
      });
      const result = (await response.json()) as { defaultRepurchaseDays?: number | null; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Falha ao salvar regra.");
      setDaysByProduct((current) => ({
        ...current,
        [product.id]: result.defaultRepurchaseDays ? String(result.defaultRepurchaseDays) : "",
      }));
      setMessage(remove ? "Regra removida. Este produto nao gerara alertas." : "Regra manual de recompra salva.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar regra.");
    } finally {
      setSavingProductId(null);
    }
  }

  const normalizedQuery = query.trim().toLowerCase();
  const filteredProducts = configurableProducts.filter((product) => {
    if (!normalizedQuery) return configuredProductIds.has(product.id);
    return (
      product.name.toLowerCase().includes(normalizedQuery) ||
      product.code.toLowerCase().includes(normalizedQuery)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleProducts = filteredProducts.slice(
    (currentPage - 1) * LIST_PAGE_SIZE,
    currentPage * LIST_PAGE_SIZE,
  );

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Sistema" title="Motor de Recompra" description="Defina manualmente o prazo exato de cada produto. Itens sem regra nao geram alertas." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Produtos cadastrados" value={String(configurableProducts.length)} />
        <MetricCard label="Regras configuradas" value={String(configuredProductIds.size)} />
        <MetricCard label="Aguardando definicao" value={String(configurableProducts.length - configuredProductIds.size)} />
        <MetricCard label="Alertas gerados" value={String(alerts.length)} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel
          title="Produtos configurados"
          icon={SlidersHorizontal}
          action={visibleProducts.length + " de " + filteredProducts.length + " produtos"}
        >
          <div className="mb-4 flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-[#f8fbff] px-3 focus-within:border-cyan-400">
            <Search size={17} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Buscar no catalogo para adicionar produto"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          {message && <p className="mb-4 rounded-lg border border-cyan-100 bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-800">{message}</p>}
          <div className="space-y-3">
            {visibleProducts.map((product) => {
              const configuredValue = daysByProduct[product.id] ?? (product.defaultRepurchaseDays ? String(product.defaultRepurchaseDays) : "");
              const configuredDays = configuredValue ? Number(configuredValue) : undefined;
              const saving = savingProductId === product.id;
              return (
                <div key={product.id} className="rounded-lg border border-blue-100 bg-[#f8fbff] p-3">
                  <div className="grid gap-3 lg:grid-cols-[1fr_130px_150px_auto] lg:items-end">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-[#123252]">{product.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{product.code || "Sem codigo"} ? {product.department || "Sem departamento"}</p>
                      <p className={`mt-1 text-xs font-semibold ${configuredDays ? "text-cyan-700" : "text-amber-700"}`}>
                        {configuredDays ? `Regra ativa: ${configuredDays} dias` : "Aguardando definicao do gestor"}
                      </p>
                    </div>
                    <label className="block">
                      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Dias</span>
                      <input
                        type="number"
                        min={1}
                        max={730}
                        value={configuredValue}
                        onChange={(event) => setDaysByProduct((current) => ({ ...current, [product.id]: event.target.value }))}
                        placeholder="Definir"
                        disabled={!canEditRules}
                        className="mt-2 h-10 w-full rounded-lg border border-blue-100 bg-white px-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-60"
                      />
                    </label>
                    <div className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-xs text-slate-600">
                      {configuredDays ? "Prazo definido manualmente" : "Sem regra, sem alerta"}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!canEditRules || saving}
                        onClick={() => void saveProductRule(product)}
                        className="h-10 rounded-lg bg-[#0753a6] px-3 text-xs font-bold text-white transition hover:bg-[#063d7c] disabled:opacity-55"
                      >
                        {saving ? "Salvando" : "Salvar"}
                      </button>
                      <button
                        type="button"
                        disabled={!canEditRules || saving || !configuredDays}
                        onClick={() => void saveProductRule(product, true)}
                        className="h-10 rounded-lg border border-blue-100 px-3 text-xs font-bold text-slate-600 transition hover:bg-white disabled:opacity-55"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {!filteredProducts.length && (
              <EmptyState
                text={
                  normalizedQuery
                    ? "Nenhum produto encontrado no catalogo."
                    : "Nenhum produto configurado. Use a busca acima para adicionar o primeiro."
                }
              />
            )}
          </div>
          <PaginationControls
            page={currentPage}
            totalItems={filteredProducts.length}
            itemLabel="produtos"
            onPageChange={setPage}
          />
        </Panel>
        <Panel title="Como funciona" icon={Database}>
          <SimpleRows
            rows={[
              ["Regra obrigatoria", "Cada produto precisa de um prazo definido pelo gestor", "Manual"],
              ["Lista principal", "Exibe somente os produtos configurados manualmente", "Organizado"],
              ["Adicionar produto", "Use a busca para localizar qualquer item do catalogo", "Manual"],
              ["Produto sem prazo", "Nao gera alerta nem notificacao de recompra", "Inativo"],
              ["Nova compra", "Reinicia a contagem usando a venda faturada mais recente", "Automatico"],
              ["Janela de exibicao", "O alerta aparece quando o prazo definido vence", "Operacional"],
              ["Alertas manuais", String(manualAlerts.length) + " alerta(s) cadastrado(s)", "Separado"],
            ]}
            empty="Sem informacoes para exibir."
          />
        </Panel>
      </div>
    </div>
  );
}

function SyncModule() {
  const [logs, setLogs] = useState<SyncLogResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/crm/sync/logs", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as SyncLogResponse & { error?: string };
        if (!response.ok) throw new Error(result.error ?? "Não foi possível carregar os logs.");
        if (active) {
          setLogs(result);
          setError("");
        }
      })
      .catch((caughtError: unknown) => {
        if (active) {
          setError(caughtError instanceof Error ? caughtError.message : "Falha ao carregar logs.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const statusLabel = {
    ok: "OK",
    atencao: "Atenção",
    erro: "Erro",
    em_execucao: "Em execução",
    sem_execucao: "Sem execução",
  }[logs?.summary.status ?? "sem_execucao"];
  const latestSale = logs?.sales?.latest;
  const todayLatestSale = logs?.sales?.todayLatest;
  const visibleErrors = logs?.errors.slice(0, 5) ?? [];

  if (loading) {
    return (
      <div className="space-y-5">
        <PageTitle
          eyebrow="Sistema"
          title="Logs e Sincronização"
          description="Rotina automática do Hennder Sync, resumo do dia, erros e vendas ignoradas."
        />
        <AppInlineLoading label="Carregando logs de sincronização" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Sistema" title="Logs e Sincronização" description="Rotina automática do Hennder Sync, resumo do dia, erros e vendas ignoradas." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Status do dia" value={statusLabel} />
        <MetricCard label="Vendas de hoje" value={`${logs?.sales?.todayImported ?? 0}`} />
        <MetricCard label="Último lote" value={`${logs?.summary.imported ?? 0}`} />
        <MetricCard label="Erros" value={`${logs?.errors.length ?? 0}`} />
      </div>

      {error && (
        <Panel title="Falha ao carregar logs" icon={AlertTriangle}>
          <p className="text-sm font-semibold text-red-700">{error}</p>
        </Panel>
      )}

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Sincronização automática" icon={RefreshCcw}>
          <SimpleRows
            rows={[
              ["Frequência", "A cada 5 minutos", "07:00 às 19:00"],
              ["Escopo", "Somente vendas do dia atual", "d.data"],
              ["Comando", "npm run sync:uniplus:auto", "Windows Task Scheduler"],
              ["Última execução", logs?.latest ? formatDateTime(logs.latest.inicio) : "Sem registro", logs?.latest?.status ?? "-"],
              ["Lidos / importados", `${logs?.summary.read ?? 0} / ${logs?.summary.imported ?? 0}`, "Hoje"],
              ["Venda mais recente hoje", todayLatestSale ? `#${todayLatestSale.uniplus_id}` : "Sem venda hoje", todayLatestSale ? formatDateTime(todayLatestSale.updated_at) : "-"],
              ["Venda mais recente no CRM", latestSale ? `#${latestSale.uniplus_id}` : "Sem vendas", latestSale ? formatContactDate(latestSale.data_venda) : "-"],
              ["Ignorados", `${logs?.summary.ignored ?? 0}`, "Auditoria"],
            ]}
            empty="Sem sincronização registrada."
          />
        </Panel>

        <Panel title="Como a rotina evita gargalos" icon={Database}>
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            {[
              "Consulta em janela curta do dia atual, sem varrer histórico completo.",
              "Execução periódica em vez de uma consulta a cada venda.",
              "UPSERT por uniplus_id para evitar duplicidade ao reprocessar.",
              "Um único log diário é atualizado a cada execução.",
              "Falhas ficam registradas com mensagem; vendas ignoradas ficam com venda e motivo.",
            ].map((item) => (
              <div key={item} className="rounded-lg border border-blue-50 bg-[#f8fbff] px-3 py-2">{item}</div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Histórico recente do Sync" icon={Clock3}>
        {logs?.recentRuns?.length ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-3 py-2">Início</th>
                  <th className="px-3 py-2">Fim</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Lidos</th>
                  <th className="px-3 py-2">Importados</th>
                  <th className="px-3 py-2">Ignorados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-50">
                {logs.recentRuns.map((run) => (
                  <tr key={run.id}>
                    <td className="px-3 py-3">{formatDateTime(run.inicio)}</td>
                    <td className="px-3 py-3">{run.fim ? formatDateTime(run.fim) : "-"}</td>
                    <td className="px-3 py-3 font-bold text-[#0753a6]">{run.status}</td>
                    <td className="px-3 py-3">{run.total_lidos}</td>
                    <td className="px-3 py-3">{run.total_importados}</td>
                    <td className="px-3 py-3">{run.total_ignorados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhuma execução recente encontrada.</p>
        )}
      </Panel>

      <Panel
        title="Erros e vendas ignoradas do dia"
        icon={AlertTriangle}
        action={logs?.errors.length ? `${visibleErrors.length} de ${logs.errors.length}` : undefined}
      >
        {visibleErrors.length ? (
          <div className="space-y-3">
            {visibleErrors.map((item) => (
              <div key={item.id} className="rounded-xl border border-red-100 bg-red-50/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-red-900">
                    {item.saleId ? `Venda ${item.saleId}` : "Execução do Sync"}
                  </p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-red-700">
                    {formatDateTime(item.at)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-red-700">{item.reason}</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">{item.message}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Nenhum erro ou venda ignorada registrada hoje.</p>
        )}
      </Panel>
    </div>
  );
}
function SettingsModule({
  user,
  sellers,
  onUserChange,
}: {
  user: CrmSessionUser;
  sellers: typeof snapshot.sellers;
  onUserChange: (user: CrmSessionUser) => void;
}) {
  const settings = [
    { id: "usuarios", title: "Usuarios", description: "Perfis de administrador, supervisor e vendedor." },
    { id: "permissoes", title: "Permissoes", description: "Menus e operacoes liberadas por perfil." },
    { id: "empresa", title: "Empresa", description: "Parametros comerciais e identidade operacional." },
    { id: "atribuicao", title: "Atribuicao", description: "Janela e regras para reconhecer conversoes do CRM." },
    { id: "integracao", title: "Integracao", description: "Hennder Sync, Supabase e ERP Uniplus." },
    { id: "preferencias", title: "Preferencias", description: "Tema, notificacoes e comportamento da rotina." },
  ];
  const [selectedSettingId, setSelectedSettingId] = useState(settings[0].id);
  const selectedSetting = settings.find((item) => item.id === selectedSettingId) ?? settings[0];

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Sistema" title="Configurações" description="Parâmetros operacionais, usuários, permissões e integração." />
      <WhatsAppMessageSettings user={user} onUserChange={onUserChange} />
      {user.role === "administrador" && (
        <UserManagementPanel user={user} sellers={sellers} onUserChange={onUserChange} />
      )}
      <Panel title="Central de configurações" icon={Settings}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {settings.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSelectedSettingId(item.id)}
              className={`min-w-0 rounded-xl border p-4 text-left transition ${
                selectedSetting.id === item.id
                  ? "border-cyan-400 bg-cyan-50"
                  : "border-blue-100 bg-[#f8fbff] hover:border-cyan-300 hover:bg-white"
              }`}
            >
              <p className="break-words font-black text-[#123252]">{item.title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
            </button>
          ))}
        </div>
      </Panel>
      <Panel title={selectedSetting.title} icon={SlidersHorizontal} action="Configurado">
        <SimpleRows
          rows={getSettingsRows(selectedSetting.id, user, sellers)}
          empty="Sem parametros para exibir."
        />
      </Panel>
    </div>
  );
}

function getSettingsRows(
  settingId: string,
  user: CrmSessionUser,
  sellersList: SellerRow[],
): Array<Array<string | number>> {
  const rows: Record<string, Array<Array<string | number>>> = {
    usuarios: [
      ["Administrador", "Gerencia usuarios e configuracoes", user.role === "administrador" ? "Seu perfil" : "Ativo"],
      ["Supervisor", "Acompanha resultados e equipe", "Sem configuracoes sensiveis"],
      ["Vendedor", "Acessa somente sua carteira", `${sellersList.length} vendedor(es)`],
    ],
    permissoes: [
      ["Administrador", "Acesso total", "Protegido"],
      ["Supervisor", "Sem configuracoes", "Operacional"],
      ["Vendedor", "Dashboard, clientes, vendas, recompra, agenda e IA", "Carteira filtrada"],
    ],
    empresa: [
      ["Nome comercial", "Shopping Rural", "Usado nas mensagens manuais"],
      ["Horario de operacao", "07:00 as 19:00", "Sync do dia"],
      ["Moeda", "BRL", "Relatorios e resultados"],
    ],
    atribuicao: [
      ["0 a 10 dias", "100% como faturamento recuperado", "Janela forte"],
      ["11 a 20 dias", "75% como faturamento influenciado", "Janela media"],
      ["21 a 30 dias", "50% como faturamento influenciado", "Janela leve"],
    ],
    integracao: [
      ["Origem", "PostgreSQL local do Uniplus", "Hennder Sync"],
      ["Destino", "Supabase em nuvem", "Frontend web"],
      ["Frequencia", "A cada 5 minutos em horario comercial", "Sem sobrecarga"],
    ],
    preferencias: [
      ["Tema", "Alternancia por icone no topo", "Salvo no navegador"],
      ["Notificacoes", "Sino com alertas de hoje, atrasos e cadastros", "Ativo"],
      ["Mensagens automaticas", "Personalizada individualmente por vendedor", "Ativo"],
    ],
  };

  return rows[settingId] ?? [];
}

function UserManagementPanel({
  user,
  sellers,
  onUserChange,
}: {
  user: CrmSessionUser;
  sellers: typeof snapshot.sellers;
  onUserChange: (user: CrmSessionUser) => void;
}) {
  const [managedUsers, setManagedUsers] = useState<ManagedCrmUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CrmUserRole>("vendedor");
  const [sellerId, setSellerId] = useState(sellers[0]?.id ?? "");
  const [loadingUsers, setLoadingUsers] = useState(user.role === "administrador");
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingUserName, setEditingUserName] = useState("");
  const [editingUserRole, setEditingUserRole] = useState<CrmUserRole>("vendedor");
  const [editingUserSellerId, setEditingUserSellerId] = useState("");
  const [editingUserPassword, setEditingUserPassword] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [userMessage, setUserMessage] = useState("");
  const [userError, setUserError] = useState("");

  useEffect(() => {
    if (user.role !== "administrador") return;

    let active = true;
    fetch("/api/crm/users", { cache: "no-store" })
      .then(async (response) => {
        const result = (await response.json()) as {
          users?: ManagedCrmUser[];
          error?: string;
        };
        if (!response.ok) throw new Error(result.error ?? "Falha ao carregar usuários.");
        if (active) setManagedUsers(result.users ?? []);
      })
      .catch((error) => {
        if (active) setUserError(error instanceof Error ? error.message : "Falha ao carregar usuários.");
      })
      .finally(() => {
        if (active) setLoadingUsers(false);
      });

    return () => {
      active = false;
    };
  }, [user.role]);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingUser(true);
    setUserError("");
    setUserMessage("");

    try {
      const response = await fetch("/api/crm/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role,
          sellerId: role === "vendedor" ? sellerId : undefined,
        }),
      });
      const result = (await response.json()) as {
        user?: ManagedCrmUser;
        error?: string;
      };
      if (!response.ok || !result.user) throw new Error(result.error ?? "Falha ao cadastrar usuário.");

      setManagedUsers((current) => [
        result.user as ManagedCrmUser,
        ...current.filter((item) => item.email !== result.user?.email),
      ]);
      setName("");
      setEmail("");
      setPassword("");
      setRole("vendedor");
      setSellerId(sellers[0]?.id ?? "");
      setUserMessage("Usuario cadastrado e liberado para entrar no CRM.");
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Falha ao cadastrar usuário.");
    } finally {
      setSavingUser(false);
    }
  }

  async function deleteUser(managedUser: ManagedCrmUser) {
    if (managedUser.role === "administrador") return;
    const confirmed = window.confirm(`Excluir o usuário ${managedUser.name}?`);
    if (!confirmed) return;

    setDeletingUserId(managedUser.id);
    setUserError("");
    setUserMessage("");

    try {
      const response = await fetch(`/api/crm/users?id=${encodeURIComponent(managedUser.id)}`, {
        method: "DELETE",
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Falha ao excluir usuário.");
      setManagedUsers((current) => current.filter((item) => item.id !== managedUser.id));
      setUserMessage("Usuario excluido com sucesso.");
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Falha ao excluir usuário.");
    } finally {
      setDeletingUserId(null);
    }
  }

  function startEditingUserName(managedUser: ManagedCrmUser) {
    setEditingUserId(managedUser.id);
    setEditingUserName(managedUser.name);
    setEditingUserRole(managedUser.role);
    setEditingUserSellerId(managedUser.sellerId ?? sellers[0]?.id ?? "");
    setEditingUserPassword("");
    setUserError("");
    setUserMessage("");
  }

  async function updateUserName(managedUser: ManagedCrmUser) {
    const nextName = editingUserName.trim();
    const nextPassword = editingUserPassword.trim();
    if (!nextName) {
      setUserError("Informe o nome do usuario.");
      return;
    }
    if (editingUserRole === "vendedor" && !editingUserSellerId) {
      setUserError("Vincule um vendedor para o perfil vendedor.");
      return;
    }
    if (nextPassword && nextPassword.length < 8) {
      setUserError("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setUpdatingUserId(managedUser.id);
    setUserError("");
    setUserMessage("");

    try {
      const response = await fetch("/api/crm/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: managedUser.id,
          name: nextName,
          role: editingUserRole,
          sellerId: editingUserRole === "vendedor" ? editingUserSellerId : null,
          ...(nextPassword ? { password: nextPassword } : {}),
        }),
      });
      const result = (await response.json()) as {
        user?: ManagedCrmUser;
        sessionUser?: CrmSessionUser;
        error?: string;
      };
      if (!response.ok || !result.user) throw new Error(result.error ?? "Falha ao atualizar usuário.");

      setManagedUsers((current) =>
        current.map((item) => (item.id === result.user?.id ? result.user : item)),
      );
      if (result.sessionUser) {
        onUserChange(result.sessionUser);
      }
      setEditingUserId(null);
      setEditingUserName("");
      setEditingUserPassword("");
      setUserMessage("Usuario atualizado com sucesso.");
    } catch (error) {
      setUserError(error instanceof Error ? error.message : "Falha ao atualizar usuário.");
    } finally {
      setUpdatingUserId(null);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel title="Cadastrar usuário" icon={UsersRound} action={user.role === "administrador" ? "Supabase Auth" : "Acesso restrito"}>
        {user.role !== "administrador" ? (
          <EmptyState text="Somente administradores podem cadastrar usuários." />
        ) : (
          <form className="space-y-4" onSubmit={createUser}>
            <div className="grid gap-4 md:grid-cols-2">
              <FormInput label="Nome" value={name} onChange={setName} />
              <FormInput label="Email" value={email} onChange={setEmail} type="email" />
              <FormInput label="Senha provisoria" value={password} onChange={setPassword} type="password" />
              <FormSelect label="Perfil" value={role} onChange={(value) => setRole(value as CrmUserRole)}>
                <option value="administrador">Administrador</option>
                <option value="supervisor">Supervisor</option>
                <option value="vendedor">Vendedor</option>
              </FormSelect>
            </div>

            {role === "vendedor" && (
              <FormSelect label="Vendedor vinculado" value={sellerId} onChange={setSellerId}>
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>{seller.name}</option>
                ))}
              </FormSelect>
            )}

            {userError && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{userError}</p>}
            {userMessage && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{userMessage}</p>}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingUser}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
              >
                <Plus size={17} />
                {savingUser ? "Cadastrando..." : "Cadastrar usuário"}
              </button>
            </div>
          </form>
        )}
      </Panel>

      <Panel title="Usuarios ativos" icon={ShieldCheck} action={loadingUsers ? "Carregando" : `${managedUsers.length} usuários`}>
        {user.role !== "administrador" ? (
          <EmptyState text="Lista disponivel apenas para administradores." />
        ) : loadingUsers ? (
          <AppInlineLoading label="Carregando usuários" />
        ) : managedUsers.length === 0 ? (
          <EmptyState text="Nenhum usuário cadastrado." />
        ) : (
          <div className="space-y-2">
            {managedUsers.map((managedUser) => {
              const seller = sellers.find((item) => item.id === managedUser.sellerId);
              const editingThisUser = editingUserId === managedUser.id;
              return (
                <div key={managedUser.id} className="rounded-lg border border-blue-50 bg-[#f8fbff] p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      {editingThisUser ? (
                        <div className="grid gap-2">
                          <div className="grid gap-2 lg:grid-cols-2">
                            <input
                              value={editingUserName}
                              onChange={(event) => setEditingUserName(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Escape") {
                                  setEditingUserId(null);
                                  setEditingUserName("");
                                  setEditingUserPassword("");
                                }
                              }}
                              className="h-10 min-w-0 rounded-lg border border-cyan-200 bg-white px-3 text-sm font-bold text-[#123252] outline-none focus:border-cyan-500"
                            />
                            <select
                              value={editingUserRole}
                              onChange={(event) => setEditingUserRole(event.target.value as CrmUserRole)}
                              disabled={managedUser.role === "administrador"}
                              className="h-10 min-w-0 rounded-lg border border-cyan-200 bg-white px-3 text-sm font-bold text-[#123252] outline-none focus:border-cyan-500 disabled:opacity-60"
                            >
                              <option value="administrador">Administrador</option>
                              <option value="supervisor">Supervisor</option>
                              <option value="vendedor">Vendedor</option>
                            </select>
                          </div>
                          <div className="grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
                            <select
                              value={editingUserSellerId}
                              onChange={(event) => setEditingUserSellerId(event.target.value)}
                              disabled={editingUserRole !== "vendedor"}
                              className="h-10 min-w-0 rounded-lg border border-cyan-200 bg-white px-3 text-sm text-[#123252] outline-none focus:border-cyan-500 disabled:opacity-60"
                            >
                              <option value="">Sem vendedor vinculado</option>
                              {sellers.map((sellerOption) => (
                                <option key={sellerOption.id} value={sellerOption.id}>{sellerOption.name}</option>
                              ))}
                            </select>
                            <input
                              value={editingUserPassword}
                              onChange={(event) => setEditingUserPassword(event.target.value)}
                              type="password"
                              placeholder="Nova senha opcional"
                              className="h-10 min-w-0 rounded-lg border border-cyan-200 bg-white px-3 text-sm outline-none focus:border-cyan-500"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => void updateUserName(managedUser)}
                                disabled={updatingUserId === managedUser.id}
                                className="grid size-10 place-items-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                title="Salvar usuario"
                              >
                                <CheckCircle2 size={16} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUserId(null);
                                  setEditingUserName("");
                                  setEditingUserPassword("");
                                }}
                                className="grid size-10 place-items-center rounded-lg border border-blue-100 bg-white text-slate-500 hover:bg-slate-50"
                                title="Cancelar edicao"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="break-words font-bold text-[#123252]">{managedUser.name}</p>
                      )}
                      <p className="mt-1 break-all text-sm text-slate-500">{managedUser.email}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                      <span className="rounded-full bg-white px-2 py-1 text-xs font-bold uppercase text-cyan-700">
                        {managedUser.role}
                      </span>
                      {!editingThisUser && (
                        <button
                          type="button"
                          onClick={() => startEditingUserName(managedUser)}
                          className="grid size-8 place-items-center rounded-lg border border-blue-100 bg-white text-[#0753a6] hover:bg-cyan-50"
                          title="Editar nome do usuário"
                        >
                          <Pencil size={14} />
                        </button>
                      )}
                      {managedUser.role !== "administrador" && (
                        <button
                          type="button"
                          onClick={() => void deleteUser(managedUser)}
                          disabled={deletingUserId === managedUser.id}
                          className="grid size-8 place-items-center rounded-lg border border-red-100 bg-white text-red-600 hover:bg-red-50 disabled:opacity-50"
                          title="Excluir usuário"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  {seller && <p className="mt-2 text-xs font-semibold text-slate-500">Vendedor: {seller.name}</p>}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-blue-50 bg-white px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-black text-[#123252]">{value}</p>
    </div>
  );
}

function SimpleRows({
  rows,
  empty,
}: {
  rows: Array<Array<string | number>>;
  empty: string;
}) {
  if (!rows.length) return <EmptyState text={empty} />;

  return (
    <div className="space-y-2">
      {rows.map((row, index) => (
        <div key={`${row.join("-")}-${index}`} className="grid min-w-0 gap-2 rounded-lg border border-blue-50 bg-[#f8fbff] p-3 text-sm text-slate-600 md:grid-cols-3">
          {row.map((cell, cellIndex) => (
            <span key={`${cell}-${cellIndex}`} className={`min-w-0 break-words ${cellIndex === 0 ? "font-bold text-[#123252]" : ""}`}>
              {cell}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/50 p-5 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}

function Dashboard({
  customers,
  openProfile,
  contactRecords,
  agenda,
  openRecovery,
  theme,
  sales,
  saleItems,
  products,
  insights,
  detailsLoading,
  user,
  onUpdateContact,
  onRegisterContact,
}: {
  customers: CustomerRow[];
  openProfile: (customer: CustomerRow) => void;
  contactRecords: ContactRecord[];
  agenda: CrmAgendaEvent[];
  openRecovery: () => void;
  theme: Theme;
  sales: SaleRow[];
  saleItems: SaleItemRow[];
  products: ProductRow[];
  insights?: CrmDashboardInsights;
  detailsLoading: boolean;
  user: CrmSessionUser;
  onUpdateContact: (
    customer: CustomerRow,
    phone: string,
    options?: CustomerContactUpdateOptions,
  ) => Promise<void>;
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  const chartColors = getChartColors(theme);
  const actionableCustomers = customers.filter(
    (customer) => !hasFutureFollowUp(customer.id, agenda, crmReferenceDate),
  );
  const inactiveCustomers = [...customers]
    .filter((customer) => customer.activityStatus !== "ativo")
    .sort((a, b) => b.days - a.days);
  const actionableInactiveCustomers = inactiveCustomers.filter(
    (customer) => !hasFutureFollowUp(customer.id, agenda, crmReferenceDate),
  );
  const dashboardKpis = buildDashboardKpis(customers);
  const scopedTrend = insights?.repurchaseTrend ?? buildRepurchaseTrendForSales(sales);
  const scopedCategoryData = insights?.categoryData ?? buildCategoryDataForItems(saleItems, products);

  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="Visão executiva"
        title="Dashboard comercial inteligente"
        description="Priorize recuperação, recompra e venda cruzada com dados acionáveis."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {dashboardKpis.map((kpi, index) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.04 }}
            className={`crm-kpi crm-kpi-${index + 1} rounded-xl p-4 text-white shadow-[0_10px_24px_rgba(13,74,145,0.16)]`}
          >
            <div className="flex items-start justify-between">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/16 text-white">
                <kpi.icon size={18} />
              </div>
              <span className="rounded-full bg-white/16 px-2 py-1 text-xs font-semibold text-white">
                {kpi.delta}
              </span>
            </div>
            <p className="mt-4 text-2xl font-semibold tracking-tight">{kpi.value}</p>
            <p className="mt-1 truncate text-sm text-white/82">{kpi.label}</p>
          </motion.div>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border border-orange-200 bg-white shadow-[0_8px_24px_rgba(194,65,12,0.09)]">
        <div className="flex flex-col gap-4 bg-gradient-to-r from-orange-600 to-amber-500 px-5 py-4 text-white lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-white/18">
              <AlertTriangle size={23} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-orange-50">Atenção comercial</p>
              <h2 className="mt-1 text-xl font-bold">{inactiveCustomers.length} clientes estão sem comprar</h2>
              <p className="mt-1 text-sm text-orange-50/90">
                Veja os casos mais urgentes e acesse a central para acompanhar todos os retornos.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <RecoverySummary
              value={`${inactiveCustomers.filter((customer) => customer.days >= 30 && customer.days < 60).length}`}
              label="30 a 60 dias"
            />
            <RecoverySummary
              value={`${inactiveCustomers.filter((customer) => customer.days >= 60 && customer.days <= 90).length}`}
              label="60 a 90 dias"
            />
            <RecoverySummary
              value={`${inactiveCustomers.filter((customer) => customer.days > 90).length}`}
              label="+90 dias"
            />
            <button
              type="button"
              onClick={openRecovery}
              className="h-12 rounded-lg bg-white px-4 text-sm font-bold text-orange-700 shadow-sm transition hover:bg-orange-50"
            >
              Abrir central
            </button>
          </div>
        </div>
        <div className="grid gap-2 p-3 lg:grid-cols-3">
          {actionableInactiveCustomers.slice(0, 3).map((customer) => {
            const latestContact = contactRecords.find((record) => record.customerId === customer.id);

            return (
              <button
                key={customer.name}
                type="button"
                onClick={() => openProfile(customer)}
                className="flex items-center justify-between gap-3 rounded-lg border border-orange-100 bg-orange-50/45 px-4 py-3 text-left transition hover:border-orange-300 hover:bg-white"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-slate-900">{customer.name}</p>
                  <p className="mt-1 text-xs text-orange-700">
                    {customer.days} dias sem compra · potencial {customer.potential}
                  </p>
                  {latestContact && (
                    <p className="mt-1 truncate text-xs text-[#0753a6]">
                      Último retorno: {contactOutcomeLabels[latestContact.outcome]}
                    </p>
                  )}
                </div>
                <ChevronRight size={19} className="shrink-0 text-orange-500" />
              </button>
            );
          })}
        </div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel title="Evolução de recompra" icon={LineChart}>
          <div className="h-80">
            <MeasuredChart>
              {({ width, height }) => (
                  <AreaChart width={width} height={height} data={scopedTrend}>
                  <defs>
                    <linearGradient id="repurchase" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fill: chartColors.text }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fill: chartColors.text }} />
                  <Tooltip contentStyle={chartColors.tooltip} />
                  <Area type="monotone" dataKey="recompra" stroke="#059669" strokeWidth={3} fill="url(#repurchase)" />
                  <Area type="monotone" dataKey="recuperados" stroke="#2563eb" strokeWidth={3} fill="transparent" />
                </AreaChart>
              )}
            </MeasuredChart>
          </div>
        </Panel>
        <Panel title="Categorias recorrentes" icon={PieChart}>
          {detailsLoading && !scopedCategoryData.length ? (
            <div className="min-h-80">
              <AppInlineLoading label="Finalizando categorias recorrentes" />
            </div>
          ) : (
            <>
              <div className="h-80">
                <MeasuredChart>
                  {({ width, height }) => (
                    <RePieChart width={width} height={height}>
                      <Pie data={scopedCategoryData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4}>
                        {scopedCategoryData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={chartColors.tooltip} />
                    </RePieChart>
                  )}
                </MeasuredChart>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {scopedCategoryData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    {item.name}
                  </div>
                ))}
              </div>
            </>
          )}
        </Panel>
      </div>
      <Panel title="Clientes para contatar hoje" icon={Phone} action="Ranking de prioridade">
        <div className="grid gap-3">
          {actionableCustomers.slice(0, 4).map((customer, index) => (
            <div
              key={customer.name}
              className="grid gap-3 rounded-lg border border-blue-100 bg-[#f7fbff] p-4 text-left transition hover:border-cyan-400 hover:bg-white hover:shadow-md md:grid-cols-[42px_1.3fr_1fr_1fr_1fr_auto]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0753a6] font-semibold text-white">
                {index + 1}
              </span>
              <div>
                <p className="font-semibold">{customer.name}</p>
                <p className="text-sm text-slate-500">Última compra: {customer.lastBuy}</p>
              </div>
              <Metric label="Dias sem compra" value={`${customer.days} dias`} />
              <Metric label="Probabilidade" value={`${customer.probability}%`} />
              <Metric label="Valor potencial" value={customer.potential} />
              <div className="flex items-center gap-2 md:justify-end">
                <WhatsAppButton
                  customer={customer}
                  user={user}
                  onUpdateContact={onUpdateContact}
                  onRegisterContact={onRegisterContact}
                  compact
                />
                <button
                  type="button"
                  onClick={() => openProfile(customer)}
                  aria-label={`Abrir perfil de ${customer.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-white text-[#0753a6] transition hover:border-cyan-400 hover:bg-cyan-50"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function isOpenAutomaticFollowUp(event: CrmAgendaEvent) {
  return event.type === "Retorno" && Boolean(event.contactId) && !event.completed;
}

function hasFutureFollowUp(
  customerId: string,
  agenda: CrmAgendaEvent[],
  referenceDate: string,
) {
  return agenda.some(
    (event) =>
      isOpenAutomaticFollowUp(event) &&
      event.customerId === customerId &&
      event.date > referenceDate,
  );
}

function compareAgendaEvents(left: CrmAgendaEvent, right: CrmAgendaEvent) {
  return left.date.localeCompare(right.date) || left.time.localeCompare(right.time);
}

type RecoveryFilter = "todos" | "30-60" | "60-90" | "90-plus" | "sem-retorno";

const recoveryFilters: Array<{ id: RecoveryFilter; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "30-60", label: "30 a 60 dias" },
  { id: "60-90", label: "60 a 90 dias" },
  { id: "90-plus", label: "+90 dias" },
  { id: "sem-retorno", label: "Sem retorno" },
];

function matchesRecoveryFilter(
  customer: CustomerRow,
  filter: RecoveryFilter,
  contactedCustomerIds: Set<string>,
  dueFollowUpCustomerIds: Set<string>,
) {
  if (filter === "todos") return true;
  const hasDueFollowUp = dueFollowUpCustomerIds.has(customer.id);
  if (contactedCustomerIds.has(customer.id) && !hasDueFollowUp) return false;
  if (filter === "30-60") return customer.days >= 30 && customer.days <= 60;
  if (filter === "60-90") return customer.days > 60 && customer.days <= 90;
  if (filter === "90-plus") return customer.days > 90;
  return !contactedCustomerIds.has(customer.id) || hasDueFollowUp;
}

function RecoveryCustomers({
  customers,
  openProfile,
  contactRecords,
  agenda,
  onRegisterContact,
  user,
  onUpdateContact,
}: {
  customers: CustomerRow[];
  openProfile: (customer: CustomerRow) => void;
  contactRecords: ContactRecord[];
  agenda: CrmAgendaEvent[];
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
  user: CrmSessionUser;
  onUpdateContact: (
    customer: CustomerRow,
    phone: string,
    options?: CustomerContactUpdateOptions,
  ) => Promise<void>;
}) {
  const [contactCustomer, setContactCustomer] = useState<CustomerRow | null>(null);
  const [lastWhatsAppCustomer, setLastWhatsAppCustomer] = useState<CustomerRow | null>(null);
  const [contactCorrectionCustomer, setContactCorrectionCustomer] = useState<CustomerRow | null>(null);
  const [activeFilter, setActiveFilter] = useState<RecoveryFilter>("todos");
  const [page, setPage] = useState(1);
  const inactiveCustomers = [...customers]
    .filter((customer) => customer.activityStatus !== "ativo")
    .sort((a, b) => b.days - a.days);
  const queuedInactiveCustomers = inactiveCustomers.filter(
    (customer) => !hasFutureFollowUp(customer.id, agenda, crmReferenceDate),
  );
  const contactedCustomerIds = new Set(
    contactRecords
      .filter((record) => record.outcome !== "invalid_number")
      .map((record) => record.customerId),
  );
  const dueFollowUpCustomerIds = new Set(
    agenda
      .filter(
        (event) =>
          isOpenAutomaticFollowUp(event) &&
          Boolean(event.customerId) &&
          event.date <= crmReferenceDate,
      )
      .map((event) => event.customerId as string),
  );
  const filteredInactiveCustomers = queuedInactiveCustomers.filter((customer) =>
    matchesRecoveryFilter(
      customer,
      activeFilter,
      contactedCustomerIds,
      dueFollowUpCustomerIds,
    ),
  );
  const totalPages = Math.max(1, Math.ceil(filteredInactiveCustomers.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleInactiveCustomers = filteredInactiveCustomers.slice(
    (currentPage - 1) * LIST_PAGE_SIZE,
    currentPage * LIST_PAGE_SIZE,
  );
  const pendingContactCustomers = queuedInactiveCustomers.filter(
    (customer) => !contactedCustomerIds.has(customer.id),
  );

  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="Recuperação de clientes"
        title="Clientes sem compra"
        description="Acompanhe clientes inativos, registre cada tentativa e programe os próximos contatos."
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <RecoveryMetric value={`${inactiveCustomers.length}`} label="Clientes sem compra" tone="orange" />
        <RecoveryMetric
          value={`${inactiveCustomers.filter((customer) => customer.days > 90).length}`}
          label="Casos acima de 90 dias"
          tone="red"
        />
        <RecoveryMetric value={`${pendingContactCustomers.length}`} label="Sem contato ainda" tone="blue" />
        <RecoveryMetric
          value={`${agenda.filter(isOpenAutomaticFollowUp).length}`}
          label="Retornos agendados"
          tone="amber"
        />
      </div>

      <Panel title="Fila de recuperação" icon={AlertTriangle} action="Ordenada por dias sem compra">
        <div className="mb-4 flex flex-wrap gap-2">
          {recoveryFilters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => {
                setActiveFilter(filter.id);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                activeFilter === filter.id
                  ? "bg-orange-600 text-white"
                  : "border border-orange-100 bg-white text-slate-600 hover:border-orange-300"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        {activeFilter !== "todos" && (
          <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm font-medium text-slate-700">
            Este filtro mostra clientes ainda não contatados e retornos que já chegaram
            à data programada.
          </div>
        )}

        {lastWhatsAppCustomer && (
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <MessageCircle className="mt-0.5 shrink-0 text-amber-700" size={18} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900">
                  WhatsApp aberto para {lastWhatsAppCustomer.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">
                  Se o numero estiver errado, corrija aqui e o cliente volta para esta fila.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setContactCorrectionCustomer(lastWhatsAppCustomer)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-amber-700 px-3 text-sm font-semibold text-white transition hover:bg-amber-800"
              >
                <Pencil size={15} />
                Corrigir numero
              </button>
              <button
                type="button"
                onClick={() => setLastWhatsAppCustomer(null)}
                aria-label="Fechar aviso da ultima tentativa"
                title="Fechar"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-200 bg-white text-slate-600 transition hover:bg-amber-100"
              >
                <X size={17} />
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {visibleInactiveCustomers.map((customer) => {
            const latestContact = contactRecords.find((record) => record.customerId === customer.id);

            return (
              <article
                key={customer.name}
                className="rounded-xl border border-orange-100 bg-orange-50/45 p-4 transition hover:border-orange-300 hover:bg-white hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                      {customer.days} dias sem comprar
                    </span>
                    <h2 className="mt-3 font-bold text-slate-900">{customer.name}</h2>
                    <p className="mt-1 text-xs text-slate-500">
                      Última compra em {customer.lastBuy} · {customer.city}
                    </p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2 text-right shadow-sm">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Potencial</p>
                    <p className="mt-1 text-sm font-bold text-orange-700">{customer.potential}</p>
                  </div>
                </div>

                <div className="mt-4 min-h-16 rounded-lg border border-blue-100 bg-white px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Último contato</p>
                  {latestContact ? (
                    <>
                      <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-[#0753a6]">
                          {contactOutcomeLabels[latestContact.outcome]}
                        </span>
                        <span className="text-xs text-slate-500">{latestContact.contactedAt}</span>
                      </div>
                      {latestContact.nextContact && (
                        <p className="mt-1 text-xs text-amber-700">
                          Retornar em {formatContactDate(latestContact.nextContact)}
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="mt-2 text-xs font-medium text-orange-700">Nenhuma tentativa registrada</p>
                  )}
                </div>

                <div className="mt-4">
                  <WhatsAppButton
                    customer={customer}
                    user={user}
                    onUpdateContact={onUpdateContact}
                    onRegisterContact={onRegisterContact}
                    onContactIntent={setLastWhatsAppCustomer}
                  />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => openProfile(customer)}
                    className="h-11 rounded-lg border border-orange-200 bg-white px-3 text-sm font-semibold text-orange-700 hover:bg-orange-50"
                  >
                    Ver cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactCustomer(customer)}
                    className={`h-11 rounded-lg px-3 text-sm font-semibold transition ${
                      latestContact
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                        : "bg-[#0753a6] text-white hover:bg-[#063d7c]"
                    }`}
                  >
                    {latestContact ? "Atualizar retorno" : "Registrar retorno"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
        {!filteredInactiveCustomers.length && <EmptyState text="Nenhum cliente encontrado para este filtro." />}
        <PaginationControls
          page={currentPage}
          totalItems={filteredInactiveCustomers.length}
          itemLabel="clientes"
          onPageChange={setPage}
        />
      </Panel>

      {contactCustomer && (
        <ContactOutcomeModal
          customer={contactCustomer}
          defaultResponsible={resolveWhatsAppResponsibleName(user, contactCustomer)}
          onClose={() => setContactCustomer(null)}
          onSave={async (record) => {
            await onRegisterContact(record);
            setContactCustomer(null);
          }}
        />
      )}
      {contactCorrectionCustomer && (
        <CustomerContactModal
          customer={contactCorrectionCustomer}
          onClose={() => setContactCorrectionCustomer(null)}
          onSave={async (phone) => {
            await onUpdateContact(contactCorrectionCustomer, phone, { retryWhatsApp: true });
            setContactCorrectionCustomer(null);
            setLastWhatsAppCustomer(null);
          }}
        />
      )}
    </div>
  );
}

function WhatsAppMessageSettings({
  user,
  onUserChange,
}: {
  user: CrmSessionUser;
  onUserChange: (user: CrmSessionUser) => void;
}) {
  const [messageTemplate, setMessageTemplate] = useState(
    user.whatsAppMessage || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE,
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  async function saveMessage() {
    const normalizedMessage = messageTemplate.trim();
    if (!normalizedMessage) {
      setError("Escreva a mensagem automática antes de salvar.");
      return;
    }

    setSaving(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/crm/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: user.id, whatsAppMessage: normalizedMessage }),
      });
      const result = (await response.json()) as {
        sessionUser?: CrmSessionUser;
        error?: string;
      };
      if (!response.ok || !result.sessionUser) {
        throw new Error(result.error ?? "Não foi possível salvar a mensagem.");
      }
      onUserChange(result.sessionUser);
      setMessageTemplate(result.sessionUser.whatsAppMessage || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);
      setStatus("Mensagem salva. Os próximos contatos usarão este texto.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Não foi possível salvar a mensagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Mensagem automática do WhatsApp" icon={MessageCircle} action="Individual por vendedor">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <label className="block min-w-0">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Sua mensagem</span>
          <textarea
            value={messageTemplate}
            onChange={(event) => setMessageTemplate(event.target.value)}
            maxLength={1500}
            rows={7}
            className="mt-2 w-full resize-y rounded-xl border border-blue-100 bg-white px-4 py-3 text-sm leading-6 text-[#123252] outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100"
          />
        </label>
        <div className="rounded-xl border border-blue-100 bg-[#f8fbff] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Campos disponíveis</p>
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p><strong className="text-[#123252]">{"{saudacao}"}</strong> usa Bom dia, Boa tarde ou Boa noite conforme o horário.</p>
            <p><strong className="text-[#123252]">{"{vendedor}"}</strong> usa o primeiro nome do vendedor.</p>
            <p><strong className="text-[#123252]">{"{cliente}"}</strong> usa o primeiro nome do cliente.</p>
          </div>
          <button
            type="button"
            onClick={() => setMessageTemplate(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE)}
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 text-sm font-semibold text-[#0753a6] hover:bg-cyan-50"
          >
            <RefreshCcw size={15} /> Restaurar padrão
          </button>
        </div>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      {status && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{status}</p>}
      <div className="mt-4 flex justify-end">
        <button
          type="button"
          onClick={() => void saveMessage()}
          disabled={saving}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
        >
          <CheckCircle2 size={17} /> {saving ? "Salvando..." : "Salvar mensagem"}
        </button>
      </div>
    </Panel>
  );
}

function Customers({
  customers,
  openProfile,
  user,
  onUpdateContact,
  onRegisterContact,
}: {
  customers: CustomerRow[];
  openProfile: (customer: CustomerRow) => void;
  user: CrmSessionUser;
  onUpdateContact: (
    customer: CustomerRow,
    phone: string,
    options?: CustomerContactUpdateOptions,
  ) => Promise<void>;
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sellerFilter, setSellerFilter] = useState("todos");
  const [cityFilter, setCityFilter] = useState("todas");
  const [qualityFilter, setQualityFilter] = useState("todas");
  const [page, setPage] = useState(1);
  const cities = [...new Set(customers.map((customer) => customer.city))].sort();
  const sellerNames = [...new Set(customers.map((customer) => customer.preferredSeller))].sort();
  const canSwitchSeller = user.role === "administrador";
  const lockedSeller = resolveSellerForUser(user.sellerId);
  const lockedSellerLabel = lockedSeller?.name ?? sellerNames[0] ?? "Vendedor logado";
  const filtered = customers.filter((customer) => {
    const matchesQuery =
      customer.name.toLowerCase().includes(query.toLowerCase()) ||
      customer.city.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "todos" || customer.activityStatus === statusFilter;
    const matchesSeller = canSwitchSeller
      ? sellerFilter === "todos" || customer.preferredSeller === sellerFilter
      : true;
    const matchesCity = cityFilter === "todas" || customer.city === cityFilter;
    const matchesQuality = qualityFilter === "todas" || customer.qualityStatus === qualityFilter;
    return matchesQuery && matchesStatus && matchesSeller && matchesCity && matchesQuality;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / LIST_PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const visibleCustomers = filtered.slice(
    (currentPage - 1) * LIST_PAGE_SIZE,
    currentPage * LIST_PAGE_SIZE,
  );

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Base comercial" title="Clientes" description="Carteira segmentada por risco, vendedor e qualidade cadastral." />
      <Panel title="Carteira de clientes" icon={UsersRound} action={`${filtered.length} de ${customers.length} clientes`}>
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(4,0.7fr)]">
          <div className="flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-[#f8fbff] px-3 focus-within:border-cyan-400">
            <Search size={17} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Nome ou cidade"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
          >
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="atencao">Atenção</option>
            <option value="risco">Em risco</option>
            <option value="perdido">Perdidos</option>
          </FilterSelect>
          <FilterSelect
            label="Vendedor"
            value={canSwitchSeller ? sellerFilter : lockedSellerLabel}
            onChange={
              canSwitchSeller
                ? (value) => {
                    setSellerFilter(value);
                    setPage(1);
                  }
                : () => undefined
            }
            disabled={!canSwitchSeller}
          >
            {canSwitchSeller ? (
              <>
                <option value="todos">Todos vendedores</option>
                {sellerNames.map((seller) => <option key={seller} value={seller}>{seller}</option>)}
              </>
            ) : (
              <option value={lockedSellerLabel}>{lockedSellerLabel}</option>
            )}
          </FilterSelect>
          <FilterSelect
            label="Cidade"
            value={cityFilter}
            onChange={(value) => {
              setCityFilter(value);
              setPage(1);
            }}
          >
            <option value="todas">Todas as cidades</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </FilterSelect>
          <FilterSelect
            label="Qualidade"
            value={qualityFilter}
            onChange={(value) => {
              setQualityFilter(value);
              setPage(1);
            }}
          >
            <option value="todas">Toda qualidade</option>
            <option value="excelente">Excelente</option>
            <option value="bom">Bom</option>
            <option value="regular">Regular</option>
            <option value="ruim">Ruim</option>
          </FilterSelect>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1220px] border-separate border-spacing-y-2 text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                {["Nome", "WhatsApp", "Última compra", "Status", "Vendedor preferencial", "Score", "Cadastro", "Potencial perdido", ""].map((head) => (
                  <th key={head} className="px-3 py-2 font-semibold">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleCustomers.map((customer) => (
                <tr key={customer.id} className="bg-[#f8fbff] shadow-sm transition hover:bg-white hover:shadow-md">
                  <td className="rounded-l-lg px-3 py-4">
                    <p className="font-semibold text-slate-950">{customer.name}</p>
                    <p className="text-xs text-slate-500">{customer.city} · {customer.category}</p>
                  </td>
                  <td className="px-3 py-4 text-slate-600">{customer.phone}</td>
                  <td className="px-3 py-4 text-slate-600">{customer.lastBuy}</td>
                  <td className="px-3 py-4">
                    <StatusBadge status={customer.activityStatus} label={`${customer.status} · ${customer.days}d`} />
                  </td>
                  <td className="px-3 py-4">
                    <p className="font-medium text-slate-800">{customer.preferredSeller}</p>
                    <p className="text-xs text-slate-500">{customer.sellerAffinity}% de afinidade</p>
                  </td>
                  <td className="px-3 py-4">
                    <Score value={customer.score} />
                  </td>
                  <td className="px-3 py-4">
                    <QualityBadge status={customer.qualityStatus} score={customer.qualityScore} />
                  </td>
                  <td className="px-3 py-4 font-semibold text-orange-700">{customer.potential}</td>
                  <td className="rounded-r-lg px-3 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <WhatsAppButton
                        customer={customer}
                        user={user}
                        onUpdateContact={onUpdateContact}
                        onRegisterContact={onRegisterContact}
                        compact
                      />
                      <button onClick={() => openProfile(customer)} className="rounded-lg bg-[#0753a6] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#063d7c]">
                        Abrir perfil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <PaginationControls
          page={currentPage}
          totalItems={filtered.length}
          itemLabel="clientes"
          onPageChange={setPage}
        />
      </Panel>
    </div>
  );
}

function CustomerProfile({
  alerts,
  customer,
  contactRecords,
  sales,
  saleItems,
  sellers,
  products,
  user,
  onCreateAlert,
  onUpdateContact,
  onRegisterContact,
}: {
  alerts: AlertRow[];
  customer: CustomerRow;
  contactRecords: ContactRecord[];
  sales: SaleRow[];
  saleItems: SaleItemRow[];
  sellers: SellerRow[];
  products: ProductRow[];
  user: CrmSessionUser;
  onCreateAlert: (alert: AlertRow, note?: string) => Promise<void>;
  onUpdateContact: (
    customer: CustomerRow,
    phone: string,
    options?: CustomerContactUpdateOptions,
  ) => Promise<void>;
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  const customerSales = sales
    .filter((sale) => sale.customerId === customer.id)
    .sort((a, b) => b.soldAt.localeCompare(a.soldAt));
  const customerSaleIds = new Set(customerSales.map((sale) => sale.id));
  const purchasedItems = saleItems.filter((item) => customerSaleIds.has(item.saleId));
  const customerAlerts = alerts.filter((alert) => alert.customerId === customer.id);

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Perfil 360°" title={customer.name} description="Histórico comercial, sinais de recompra e oportunidades identificadas por IA." />
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="Dados do cliente" icon={UserRound}>
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-[#0753a6] text-lg font-semibold text-white shadow-lg shadow-blue-900/15">
              {customer.name.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-semibold">{customer.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{customer.city} · {customer.category}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge><Phone size={14} /> {customer.phone}</Badge>
                <Badge><MessageCircle size={14} /> {customer.whatsapp ? "WhatsApp ativo" : "Sem WhatsApp"}</Badge>
                <Badge><ShieldCheck size={14} /> Score {customer.score}</Badge>
              </div>
              <div className="mt-4">
                <WhatsAppButton
                  customer={customer}
                  user={user}
                  onUpdateContact={onUpdateContact}
                  onRegisterContact={onRegisterContact}
                />
              </div>
            </div>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <MetricCard label="Ticket médio" value={customer.ticket} />
            <MetricCard label="Total comprado" value={customer.totalPurchased} />
            <MetricCard label="Ciclo de compra" value={`${customer.purchaseCycleDays} dias`} />
            <MetricCard label="Dias sem compra" value={`${customer.days} dias`} />
          </div>
        </Panel>
        <Panel title="Inteligência comercial" icon={Sparkles} action="Regras calculadas">
          <div className="grid gap-3">
            {[
              `Vendedor preferencial: ${customer.preferredSeller} (${customer.sellerAffinity}% das compras).`,
              `Qualidade cadastral ${customer.qualityStatus}: ${customer.qualityScore} de 100 pontos.`,
              `Cliente não compra há ${customer.days} dias e possui potencial perdido estimado em ${customer.potential}.`,
            ].map((item) => (
              <div key={item} className="flex gap-3 rounded-lg border border-cyan-200 bg-cyan-50/70 p-4 text-sm text-slate-800">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-cyan-600" />
                {item}
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <MetricCard label="Vendedor preferencial" value={customer.preferredSeller} />
        <MetricCard label="Qualidade do cadastro" value={`${customer.qualityScore}% · ${customer.qualityStatus}`} />
        <MetricCard label="Alertas ativos" value={`${customerAlerts.length}`} />
      </div>
      <ManualAlertPanel
        customers={[customer]}
        products={products}
        sellers={sellers}
        user={user}
        onCreateAlert={onCreateAlert}
        initialCustomerId={customer.id}
        compact
      />
      <Panel title="Histórico de tentativas de contato" icon={MessageCircle} action={`${contactRecords.length} registros`}>
        {contactRecords.length === 0 ? (
          <div className="rounded-lg border border-dashed border-blue-200 bg-[#f8fbff] px-4 py-6 text-center">
            <p className="text-sm font-semibold text-slate-700">Nenhum retorno comercial registrado</p>
            <p className="mt-1 text-xs text-slate-500">
              As tentativas de contato e respostas do cliente aparecerão aqui.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {contactRecords.map((record) => (
              <div key={record.id} className="rounded-lg border border-blue-100 bg-[#f8fbff] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{contactOutcomeLabels[record.outcome]}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {record.channel} · {record.contactedAt} · {record.responsible}
                    </p>
                  </div>
                  {record.nextContact && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                      Retornar em {formatContactDate(record.nextContact)}
                    </span>
                  )}
                </div>
                {record.note && <p className="mt-3 text-sm text-slate-600">{record.note}</p>}
              </div>
            ))}
          </div>
        )}
      </Panel>
      <Panel
        title="Vendas e itens"
        icon={ShoppingBag}
        action={`${customerSales.length} vendas · ${purchasedItems.length} itens`}
      >
        <div className="overflow-x-auto rounded-lg border border-blue-100">
          <table className="min-w-[860px] w-full text-left text-sm">
            <thead className="bg-[#f1f8ff] text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Data</th>
                <th className="px-4 py-3">Venda</th>
                <th className="px-4 py-3">Vendedor</th>
                <th className="px-4 py-3">Itens da venda</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50 bg-white">
              {customerSales.map((sale) => {
                const currentItems = purchasedItems.filter(
                  (item) => item.saleId === sale.id,
                );
                const seller = sellers.find((item) => item.id === sale.sellerId);
                return (
                  <tr key={sale.id} className="align-top">
                    <td className="whitespace-nowrap px-4 py-4 font-medium">
                      {formatContactDate(sale.soldAt)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                      #{sale.uniplusId}
                    </td>
                    <td className="px-4 py-4 text-slate-600">
                      {seller?.name ?? "Não atribuído"}
                    </td>
                    <td className="px-4 py-4">
                      <div className="grid gap-2">
                        {currentItems.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-start justify-between gap-4 rounded-md bg-[#f8fbff] px-3 py-2"
                          >
                            <span className="font-medium text-slate-700">
                              {item.productName}
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-cyan-700">
                              {item.quantity} un.
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-right font-semibold">
                      {formatCurrency(sale.totalValue)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Timeline comercial" icon={Clock3}>
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            [
              "Histórico de compras",
              ...customerSales.slice(0, 3).map((sale) => `${formatContactDate(sale.soldAt)} · ${formatCurrency(sale.totalValue)}`),
            ],
            [
              "Itens recorrentes",
              ...purchasedItems.slice(0, 3).map((item) => `${item.productName} · ${item.quantity} un.`),
            ],
            [
              "Alertas ativos",
              ...customerAlerts.slice(0, 3).map((alert) => `${alert.product} · previsto ${alert.recommended}`),
            ],
          ].map(([title, ...items]) => (
            <div key={title} className="rounded-lg border border-blue-100 bg-[#f8fbff] p-4">
              <p className="font-semibold">{title}</p>
              <div className="mt-4 space-y-3">
                {(items.length ? items : ["Nenhum registro disponível"]).map((item) => (
                  <div key={item} className="border-l-2 border-cyan-500 pl-3 text-sm text-slate-600">{item}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function RepurchaseAlerts({
  alerts,
  customers,
  user,
  productCampaigns,
  alertStatuses,
  onStatusChange,
  onRegisterContact,
  onUpdateContact,
}: {
  alerts: AlertRow[];
  customers: CustomerRow[];
  user: CrmSessionUser;
  productCampaigns: ProductCampaign[];
  alertStatuses: Record<string, RepurchaseAlertStatus>;
  onStatusChange: (id: string, status: RepurchaseAlertStatus) => Promise<void>;
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
  onUpdateContact: (
    customer: CustomerRow,
    phone: string,
    options?: CustomerContactUpdateOptions,
  ) => Promise<void>;
}) {
  const [queue, setQueue] = useState<"pendentes" | "contatados">("pendentes");
  const [filter, setFilter] = useState("todos");
  const [repurchaseProductSearch, setRepurchaseProductSearch] = useState("");
  const [repurchaseDaysFilter, setRepurchaseDaysFilter] = useState("todos");
  const [repurchaseAlertFiltersLoaded, setRepurchaseAlertFiltersLoaded] = useState(false);
  const [page, setPage] = useState(1);
  const [contactAlert, setContactAlert] = useState<AlertRow | null>(null);
  const [updatingAlertId, setUpdatingAlertId] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const pageSize = 20;
  const repurchaseProductOptions = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const alert of alerts) {
      const key = normalizeManualAlertSearch(alert.product.trim());
      if (!key) continue;
      const current = counts.get(key) ?? { name: alert.product, count: 0 };
      current.count += 1;
      counts.set(key, current);
    }

    return [...counts.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "pt-BR"),
    );
  }, [alerts]);
  const repurchaseDayOptions = useMemo(() => {
    const counts = new Map<number, number>();
    for (const alert of alerts) {
      const days = parseRepurchaseDays(alert.days);
      if (!days) continue;
      counts.set(days, (counts.get(days) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort(([left], [right]) => left - right)
      .map(([days, count]) => ({
        value: String(days),
        label: `${days} dias`,
        count,
      }));
  }, [alerts]);
  const queueAlerts = alerts.filter(
    (alert) =>
      (alertStatuses[alert.id] ?? alert.status) ===
      (queue === "pendentes" ? "pendente" : "contatado"),
  );
  const pendingCount = alerts.filter(
    (alert) => (alertStatuses[alert.id] ?? alert.status) === "pendente",
  ).length;
  const contactedCount = alerts.filter(
    (alert) => (alertStatuses[alert.id] ?? alert.status) === "contatado",
  ).length;
  const activeProductCampaigns = productCampaigns.filter((campaign) => campaign.active);
  const normalizedRepurchaseProductSearch = normalizeManualAlertSearch(repurchaseProductSearch.trim());
  const filteredAlerts = queueAlerts.filter((alert) => {
    const overdueDays = alertOverdueDays(alert.recommendedIso, crmReferenceDate);
    if (
      normalizedRepurchaseProductSearch &&
      !normalizeManualAlertSearch(alert.product).includes(normalizedRepurchaseProductSearch)
    ) {
      return false;
    }

    const repurchaseDays = parseRepurchaseDays(alert.days);
    const matchesRepurchaseDays =
      repurchaseDaysFilter === "todos" ||
      (repurchaseDays !== undefined && repurchaseDaysFilter === String(repurchaseDays));
    if (!matchesRepurchaseDays) return false;
    if (filter === "hoje") return overdueDays === 0;
    if (filter === "ate7") return overdueDays >= 1 && overdueDays <= 7;
    if (filter === "8a30") return overdueDays >= 8 && overdueDays <= 30;
    if (filter === "mais30") return overdueDays > 30;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize));
  const visibleAlerts = filteredAlerts.slice((page - 1) * pageSize, page * pageSize);

  useEffect(() => {
    try {
      const storedDays = window.localStorage.getItem(REPURCHASE_ALERT_DAYS_FILTER_STORAGE_KEY);
      const storedProduct = window.localStorage.getItem(REPURCHASE_ALERT_PRODUCT_FILTER_STORAGE_KEY);
      if (storedDays) setRepurchaseDaysFilter(storedDays);
      if (storedProduct) setRepurchaseProductSearch(storedProduct);
    } catch {
      // The filters still work for the current session when storage is blocked.
    } finally {
      setRepurchaseAlertFiltersLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!repurchaseAlertFiltersLoaded) return;
    try {
      window.localStorage.setItem(REPURCHASE_ALERT_DAYS_FILTER_STORAGE_KEY, repurchaseDaysFilter);
      window.localStorage.setItem(REPURCHASE_ALERT_PRODUCT_FILTER_STORAGE_KEY, repurchaseProductSearch);
    } catch {
      // Ignore storage failures; the in-memory filters remain active.
    }
  }, [repurchaseDaysFilter, repurchaseProductSearch, repurchaseAlertFiltersLoaded]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  async function markAlertAsContacted(alert: AlertRow, customer?: CustomerRow) {
    if (updatingAlertId) return;
    setUpdatingAlertId(alert.id);
    setActionError("");
    try {
      if (customer) {
        await onRegisterContact({
          customerId: customer.id,
          customerName: customer.name,
          outcome: "no_answer",
          note: `Registro automático: alerta de recompra marcado como contatado para ${alert.product}.`,
          nextContact: "",
          contactedAt: new Date().toISOString(),
          channel: normalizeBrazilianWhatsAppNumber(customer.whatsapp)
            ? "WhatsApp"
            : "Telefone",
          responsible: alert.seller,
          sellerId: alert.sellerId,
        });
      }
      await onStatusChange(alert.id, "contatado");
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Não foi possível mover o alerta para Contatados.",
      );
    } finally {
      setUpdatingAlertId(null);
    }
  }

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Operação do dia" title="Alertas de recompra" description="Clientes com prazo manual vencido e sem recompra do mesmo produto." />
      <Panel
        title={queue === "pendentes" ? "Alertas pendentes" : "Clientes contatados"}
        icon={Bell}
        action={`${filteredAlerts.length} alertas`}
      >
        <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-blue-100 bg-[#f8fbff] p-1.5 sm:w-fit">
          {[
            ["pendentes", `Pendentes (${pendingCount})`],
            ["contatados", `Contatados (${contactedCount})`],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setQueue(value as "pendentes" | "contatados");
                setFilter("todos");
                setPage(1);
                setActionError("");
              }}
              className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                queue === value
                  ? "bg-[#0753a6] text-white shadow-sm"
                  : "text-slate-600 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mb-4 flex flex-wrap gap-2">
          <div className="flex h-11 min-w-[min(100%,22rem)] flex-1 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 text-sm text-[#0753a6] focus-within:border-cyan-400">
            <Search size={17} className="shrink-0 text-slate-400" />
            <label className="sr-only" htmlFor="repurchase-product-search">
              Produto com recompra
            </label>
            <input
              id="repurchase-product-search"
              list="repurchase-product-options"
              value={repurchaseProductSearch}
              onChange={(event) => {
                setRepurchaseProductSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Produto configurado, ex: SIMPARIC TRIO"
              className="min-w-0 flex-1 bg-transparent text-sm text-slate-700 outline-none placeholder:text-slate-400"
            />
            {repurchaseProductSearch && (
              <button
                type="button"
                onClick={() => {
                  setRepurchaseProductSearch("");
                  setPage(1);
                }}
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Limpar produto"
              >
                <X size={15} />
              </button>
            )}
            <datalist id="repurchase-product-options">
              {repurchaseProductOptions.map((option) => (
                <option key={option.name} value={option.name}>
                  {option.count} alerta(s)
                </option>
              ))}
            </datalist>
          </div>
          <FilterSelect
            label="Ciclo de recompra"
            value={repurchaseDaysFilter}
            onChange={(value) => {
              setRepurchaseDaysFilter(value);
              setPage(1);
            }}
          >
            <option value="todos">Todos os ciclos</option>
            {repurchaseDayOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} ({option.count})
              </option>
            ))}
          </FilterSelect>
          {[
            ["todos", "Todos"],
            ["hoje", "Hoje"],
            ["ate7", "Atrasados até 7 dias"],
            ["8a30", "Atrasados de 8 a 30 dias"],
            ["mais30", "Atrasados há mais de 30 dias"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setFilter(value);
                setPage(1);
              }}
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                filter === value
                  ? "bg-[#0753a6] text-white"
                  : "border border-blue-100 bg-white text-slate-600 hover:border-cyan-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {actionError && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {actionError}
          </p>
        )}
        <div className="grid gap-3">
          {visibleAlerts.map((alert) => {
            const customer = customers.find((item) => item.id === alert.customerId);
            const status = alertStatuses[alert.id] ?? alert.status;
            const overdueDays = alertOverdueDays(alert.recommendedIso, crmReferenceDate);
            const campaign = findProductCampaignForAlert(alert, activeProductCampaigns);

            return (
              <div key={alert.id} className="rounded-lg border border-blue-100 bg-[#f8fbff] p-4 transition hover:bg-white hover:shadow-md">
                <div className="grid gap-3 md:grid-cols-[1.2fr_1.15fr_0.8fr_0.8fr_0.9fr_auto]">
                  <Metric label="Produto" value={alert.product} />
                  <Metric label="Cliente" value={alert.client} />
                  <Metric label="Vendedor" value={alert.seller} />
                  <Metric label="Compra" value={alert.buyDate} />
                  <Metric label="Recompra prevista" value={alert.recommended} />
                  <Metric
                    label="Atraso"
                    value={overdueDays === 0 ? "Vence hoje" : `${overdueDays} dia(s)`}
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-3">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    Status: {status.replace("_", " ")}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {customer && (
                      <WhatsAppButton
                        customer={customer}
                        user={user}
                        sellerName={alert.seller}
                        repurchaseProduct={alert.product}
                        campaign={campaign}
                        onUpdateContact={onUpdateContact}
                        onRegisterContact={onRegisterContact}
                        compact
                      />
                    )}
                    {customer && (
                      <AlertAction
                        label={queue === "pendentes" ? "Registrar retorno" : "Atualizar retorno"}
                        onClick={() => setContactAlert(alert)}
                      />
                    )}
                    {queue === "pendentes" && (
                      <AlertAction
                        label={updatingAlertId === alert.id ? "Movendo..." : "Contatado"}
                        disabled={updatingAlertId !== null}
                        onClick={() => void markAlertAsContacted(alert, customer)}
                      />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!visibleAlerts.length && (
            <EmptyState
              text={
                queue === "pendentes"
                  ? "Nenhum alerta pendente para este filtro."
                  : "Nenhum cliente contatado para este filtro."
              }
            />
          )}
        </div>
        {totalPages > 1 && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4">
            <p className="text-sm text-slate-500">
              Exibindo {(page - 1) * pageSize + 1} a{" "}
              {Math.min(page * pageSize, filteredAlerts.length)} de{" "}
              {filteredAlerts.length} alertas
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm font-semibold text-slate-700">
                Página {page} de {totalPages}
              </span>
              <button
                type="button"
                disabled={page === totalPages}
                onClick={() =>
                  setPage((current) => Math.min(totalPages, current + 1))
                }
                className="rounded-lg border border-blue-100 bg-white px-3 py-2 text-sm font-medium text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </Panel>
      {contactAlert && (() => {
        const customer = customers.find((item) => item.id === contactAlert.customerId);
        if (!customer) return null;

        return (
          <ContactOutcomeModal
            customer={customer}
            defaultResponsible={contactAlert.seller}
            onClose={() => setContactAlert(null)}
            onSave={async (record) => {
              await onRegisterContact(record);
              await onStatusChange(contactAlert.id, "contatado");
              setContactAlert(null);
            }}
          />
        );
      })()}
    </div>
  );
}

function ManualAlertPage({
  customers,
  products,
  sellers,
  user,
  onCreateAlert,
}: {
  customers: CustomerRow[];
  products: ProductRow[];
  sellers: SellerRow[];
  user: CrmSessionUser;
  onCreateAlert: (alert: AlertRow, note?: string) => Promise<void>;
}) {
  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="Recompra manual"
        title="Criar alerta"
        description="Cadastre lembretes manuais sem misturar com a fila de alertas do dia."
      />
      <ManualAlertPanel
        customers={customers}
        products={products}
        sellers={sellers}
        user={user}
        onCreateAlert={onCreateAlert}
      />
    </div>
  );
}

function ManualAlertPanel({
  customers,
  products,
  sellers,
  user,
  onCreateAlert,
  initialCustomerId,
  compact = false,
}: {
  customers: CustomerRow[];
  products: ProductRow[];
  sellers: SellerRow[];
  user: CrmSessionUser;
  onCreateAlert: (alert: AlertRow, note?: string) => Promise<void>;
  initialCustomerId?: string;
  compact?: boolean;
}) {
  const initialCustomer = customers.find((customer) => customer.id === initialCustomerId) ?? customers[0];
  const [customerId, setCustomerId] = useState(compact ? initialCustomer?.id ?? "" : "");
  const [productId, setProductId] = useState("");
  const [days, setDays] = useState("");
  const [recommendedIso, setRecommendedIso] = useState("");
  const [priority, setPriority] = useState<AlertRow["priorityCode"] | "">("");
  const [note, setNote] = useState("");
  const [alsoWhatsapp, setAlsoWhatsapp] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedCustomer = customers.find((customer) => customer.id === customerId);
  const selectedProduct = products.find((product) => product.id === productId);

  return (
    <Panel
      title={compact ? "Alerta manual para este cliente" : "Cadastrar alerta manual"}
      icon={Plus}
      action={compact ? "Cliente selecionado" : "Busca na base"}
    >
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          setSavedMessage("");

          if (!selectedCustomer) {
            setError("Selecione um cliente que exista na base.");
            return;
          }
          if (!selectedProduct) {
            setError("Selecione um produto que exista na base.");
            return;
          }

          const recurrenceDays = Number(days);
          if (!Number.isFinite(recurrenceDays) || recurrenceDays <= 0) {
            setError("Informe uma recorrencia maior que zero.");
            return;
          }
          if (!recommendedIso) {
            setError("Informe a data do alerta.");
            return;
          }
          if (!priority) {
            setError("Escolha uma prioridade para o alerta.");
            return;
          }

          const seller =
            sellers.find((item) => item.id === selectedCustomer.preferredSellerId) ??
            resolveSellerForUser(user.sellerId) ??
            sellers[0];

          setSaving(true);
          try {
            await onCreateAlert(
              buildManualAlertRow({
                customer: selectedCustomer,
                product: selectedProduct,
                recurrenceDays,
                recommendedIso,
                priority,
                seller,
              }),
              `${note.trim()}${alsoWhatsapp ? " Criar lembrete para contato manual por WhatsApp." : ""}`.trim(),
            );
            setSavedMessage(`Alerta salvo para ${selectedCustomer.name}.`);
            if (!compact) setCustomerId("");
            setProductId("");
            setDays("");
            setRecommendedIso("");
            setPriority("");
            setNote("");
            setAlsoWhatsapp(false);
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Falha ao salvar alerta manual.");
          } finally {
            setSaving(false);
          }
        }}
      >
        {!compact && (
          <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4">
            <p className="text-sm font-bold text-[#0753a6]">Preenchimento manual controlado</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              O alerta so sera criado depois que cliente, produto, recorrencia, data e prioridade forem escolhidos.
            </p>
          </div>
        )}
        <div className="grid gap-4 xl:grid-cols-2">
          {compact ? (
            <ManualAlertLockedField label="Cliente" value={selectedCustomer?.name ?? "Cliente selecionado"} />
          ) : (
            <ManualAlertPicker
              label="Cliente"
              placeholder="Buscar cliente da base"
              items={customers}
              value={customerId}
              onChange={setCustomerId}
              getTitle={(customer) => customer.name}
              getSubtitle={(customer) => [customer.document, customer.city, customer.preferredSeller].filter(Boolean).join(" · ")}
              emptyText="Nenhum cliente encontrado."
              icon={UserRound}
            />
          )}
          <ManualAlertPicker
            label="Produto"
            placeholder="Buscar produto importado"
            items={products}
            value={productId}
            onChange={setProductId}
            getTitle={(product) => product.name}
            getSubtitle={(product) => [product.code, product.department, product.defaultRepurchaseDays ? `${product.defaultRepurchaseDays} dias no motor` : ""].filter(Boolean).join(" · ")}
            emptyText="Nenhum produto encontrado."
            icon={ShoppingBag}
          />
        </div>
        <div className="grid gap-4 xl:grid-cols-[0.8fr_0.8fr_1fr]">
          <ManualAlertInput
            label="Recorrencia"
            value={days}
            onChange={setDays}
            type="number"
            placeholder="Ex: 30"
            helper={selectedProduct?.defaultRepurchaseDays ? `Motor sugere ${selectedProduct.defaultRepurchaseDays} dias para este produto.` : "Informe a quantidade de dias."}
          />
          <ManualAlertInput label="Data do alerta" value={recommendedIso} onChange={setRecommendedIso} type="date" />
          <ManualAlertPriorityPicker value={priority} onChange={setPriority} />
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <ManualAlertInput
            label="Observacao comercial"
            value={note}
            onChange={setNote}
            placeholder="Digite uma observacao opcional"
          />
          <ManualAlertToggle checked={alsoWhatsapp} onChange={setAlsoWhatsapp} />
        </div>
        {(error || savedMessage) && (
          <p className={`text-sm font-semibold ${error ? "text-red-700" : "text-emerald-700"}`}>
            {error || savedMessage}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 min-w-36 items-center justify-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#063d7c] disabled:opacity-60"
          >
            <Bell size={16} />
            {saving ? "Salvando" : "Salvar alerta"}
          </button>
        </div>
      </form>
    </Panel>
  );
}

function buildManualAlertRow({
  customer,
  product,
  recurrenceDays,
  recommendedIso,
  priority,
  seller,
}: {
  customer: CustomerRow;
  product: ProductRow;
  recurrenceDays: number;
  recommendedIso: string;
  priority: AlertRow["priorityCode"];
  seller?: SellerRow;
}): AlertRow {
  return {
    id: `manual-alert-${customer.id}-${product.id}-${Date.now()}`,
    customerId: customer.id,
    productId: product.id,
    product: product.name,
    client: customer.name,
    buyDate: customer.lastBuy,
    buyDateIso: customer.lastBuyIso,
    days: `${Math.round(recurrenceDays)} dias`,
    recommended: formatContactDate(recommendedIso),
    recommendedIso,
    priority: capitalizePriority(priority),
    priorityCode: priority,
    seller: seller?.name ?? customer.preferredSeller,
    sellerId: seller?.id ?? customer.preferredSellerId,
    department: product.department || "Manual",
    status: "pendente",
    origin: "manual",
  };
}

function mapRepurchaseAlertToAlertRow(alert: CrmRepurchaseAlert): AlertRow {
  return {
    id: alert.id,
    customerId: alert.customerId,
    product: alert.productName,
    client: alert.customerName,
    buyDate: formatContactDate(alert.purchaseDate),
    buyDateIso: alert.purchaseDate,
    days: `${alert.repurchaseDays} dias`,
    recommended: formatContactDate(alert.expectedDate),
    recommendedIso: alert.expectedDate,
    priority: capitalizePriority(alert.priority),
    priorityCode: alert.priority,
    seller: alert.sellerName,
    sellerId: alert.sellerId,
    department: alert.department,
    status: alert.status,
    origin: alert.origin,
  };
}

function ManualAlertPicker<T extends { id: string }>({
  label,
  placeholder,
  items,
  value,
  onChange,
  getTitle,
  getSubtitle,
  emptyText,
  icon: Icon = Search,
  optional = false,
}: {
  label: string;
  placeholder: string;
  items: T[];
  value: string;
  onChange: (value: string) => void;
  getTitle: (item: T) => string;
  getSubtitle: (item: T) => string;
  emptyText: string;
  icon?: typeof Search;
  optional?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selectedItem = items.find((item) => item.id === value);
  const normalizedQuery = normalizeManualAlertSearch(query);
  const visibleItems = (normalizedQuery
    ? items.filter((item) =>
        normalizeManualAlertSearch(`${getTitle(item)} ${getSubtitle(item)}`).includes(normalizedQuery),
      )
    : items
  ).slice(0, 8);
  const inputValue = open ? query : selectedItem ? getTitle(selectedItem) : query;

  return (
    <div className="relative">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
        {optional && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-500">Opcional</span>}
      </div>
      <div className="group flex min-h-12 items-center gap-3 rounded-xl border border-blue-100 bg-white px-3 shadow-sm transition focus-within:border-cyan-400 focus-within:ring-4 focus-within:ring-cyan-100">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-[#0753a6]">
          <Icon size={16} />
        </span>
        <input
          value={inputValue}
          onFocus={() => {
            setOpen(true);
            if (selectedItem) setQuery("");
          }}
          onBlur={() => {
            window.setTimeout(() => setOpen(false), 120);
          }}
          onChange={(event) => {
            if (selectedItem) onChange("");
            setQuery(event.target.value);
            setOpen(true);
          }}
          autoComplete="off"
          placeholder={placeholder}
          className="h-12 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-800 outline-none placeholder:text-slate-400"
        />
        {selectedItem && (
          <button
            type="button"
            aria-label={`Limpar ${label}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange("");
              setQuery("");
              setOpen(true);
            }}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-50 hover:text-slate-700"
          >
            <X size={15} />
          </button>
        )}
      </div>
      {selectedItem && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
          <span>
            <span className="font-bold">{getTitle(selectedItem)}</span>
            {getSubtitle(selectedItem) && <span className="block text-emerald-700">{getSubtitle(selectedItem)}</span>}
          </span>
        </div>
      )}
      {open && (
        <div className="absolute left-0 right-0 top-[72px] z-30 overflow-hidden rounded-xl border border-blue-100 bg-white shadow-2xl">
          <div className="max-h-72 overflow-y-auto p-2">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(item.id);
                  setQuery("");
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-cyan-50"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f1f8ff] text-[#0753a6]">
                  <Icon size={15} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold text-slate-900">{getTitle(item)}</span>
                  {getSubtitle(item) && <span className="mt-0.5 block truncate text-xs text-slate-500">{getSubtitle(item)}</span>}
                </span>
              </button>
            ))}
            {!visibleItems.length && (
              <div className="rounded-lg border border-dashed border-blue-100 bg-[#f8fbff] px-3 py-4 text-center text-sm font-semibold text-slate-500">
                {emptyText}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ManualAlertInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder = "",
  helper,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date";
  placeholder?: string;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        inputMode={type === "number" ? "numeric" : undefined}
        placeholder={placeholder}
        className="mt-2 h-12 w-full rounded-xl border border-blue-100 bg-white px-3 text-sm font-semibold text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-4 focus:ring-cyan-100"
      />
      {helper && <span className="mt-1 block text-xs leading-5 text-slate-500">{helper}</span>}
    </label>
  );
}

function ManualAlertPriorityPicker({
  value,
  onChange,
}: {
  value: AlertRow["priorityCode"] | "";
  onChange: (value: AlertRow["priorityCode"] | "") => void;
}) {
  const options: Array<{ value: AlertRow["priorityCode"]; label: string; description: string; selectedClass: string }> = [
    { value: "alta", label: "Alta", description: "Contato urgente", selectedClass: "border-red-300 bg-red-50 text-red-700" },
    { value: "media", label: "Media", description: "Acompanhar em breve", selectedClass: "border-amber-300 bg-amber-50 text-amber-700" },
    { value: "baixa", label: "Baixa", description: "Fila normal", selectedClass: "border-blue-300 bg-blue-50 text-blue-700" },
  ];

  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Prioridade</span>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`min-h-12 rounded-xl border px-3 py-2 text-left text-sm transition ${
                selected
                  ? option.selectedClass
                  : "border-blue-100 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50"
              }`}
            >
              <span className="block font-bold">{option.label}</span>
              <span className="mt-0.5 block text-xs opacity-75">{option.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ManualAlertLockedField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-blue-100 bg-[#f8fbff] px-3 text-sm font-bold text-slate-800">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-50 text-[#0753a6]">
          <CheckCircle2 size={16} />
        </span>
        {value}
      </div>
    </div>
  );
}

function ManualAlertToggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className={`flex min-h-12 items-center gap-3 self-end rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${
        checked
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-blue-100 bg-white text-slate-600 hover:border-cyan-300 hover:bg-cyan-50"
      }`}
    >
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${checked ? "bg-emerald-100" : "bg-[#f1f8ff]"}`}>
        {checked ? <CheckCircle2 size={16} /> : <MessageCircle size={16} />}
      </span>
      Lembrar contato por WhatsApp
    </button>
  );
}

function normalizeManualAlertSearch(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildConfiguredCampaignProducts(products: ProductRow[]) {
  return products
    .filter((product) => Boolean(product.defaultRepurchaseDays))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
}

function resolveCampaignProductIds(campaign: ProductCampaign, products: ProductRow[]) {
  if (campaign.productIds.length) return campaign.productIds;
  const legacyQuery = normalizeManualAlertSearch(campaign.productQuery.trim());
  if (!legacyQuery) return [];
  return products
    .filter((product) => normalizeManualAlertSearch(product.name).includes(legacyQuery))
    .map((product) => product.id);
}

function formatCampaignProductNames(campaign: ProductCampaign, productById: Map<string, ProductRow>) {
  const names = campaign.productIds
    .map((productId) => productById.get(productId)?.name)
    .filter((name): name is string => Boolean(name));

  if (names.length === 0) return campaign.productQuery;
  if (names.length <= 2) return names.join(", ");
  return `${names.slice(0, 2).join(", ")} +${names.length - 2} item(ns)`;
}

function productCampaignMatchesAlert(campaign: ProductCampaign, alert: AlertRow) {
  if (campaign.productIds.length) {
    return Boolean(alert.productId && campaign.productIds.includes(alert.productId));
  }

  const productQuery = normalizeManualAlertSearch(campaign.productQuery.trim());
  if (!productQuery) return false;
  return normalizeManualAlertSearch(alert.product).includes(productQuery);
}

function findProductCampaignForAlert(alert: AlertRow, campaigns: ProductCampaign[]) {
  return campaigns.find((campaign) => productCampaignMatchesAlert(campaign, alert));
}

function readProductCampaigns(): ProductCampaign[] {
  try {
    const raw = window.localStorage.getItem(PRODUCT_CAMPAIGNS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ProductCampaign[];
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((campaign) => {
      if (
        !campaign ||
        typeof campaign.id !== "string" ||
        typeof campaign.name !== "string" ||
        typeof campaign.productQuery !== "string" ||
        typeof campaign.messageTemplate !== "string"
      ) {
        return [];
      }

      return [{
        ...campaign,
        productIds: Array.isArray(campaign.productIds)
          ? campaign.productIds.filter((id): id is string => typeof id === "string")
          : [],
        active: campaign.active !== false,
      }];
    });
  } catch {
    return [];
  }
}

function writeProductCampaigns(campaigns: ProductCampaign[]) {
  try {
    window.localStorage.setItem(PRODUCT_CAMPAIGNS_STORAGE_KEY, JSON.stringify(campaigns));
  } catch {
    // Large campaign images can exceed browser storage; keeping the UI usable is better than blocking the session.
  }
}

function SellerPortfolioBySeller({
  customers,
  alerts,
  openProfile,
  onRegisterContact,
  user,
  sellers,
  onUpdateContact,
}: {
  customers: CustomerRow[];
  alerts: AlertRow[];
  openProfile: (customer: CustomerRow) => void;
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
  user: CrmSessionUser;
  sellers: SellerRow[];
  onUpdateContact: (
    customer: CustomerRow,
    phone: string,
    options?: CustomerContactUpdateOptions,
  ) => Promise<void>;
}) {
  const canSwitchSeller = user.role === "administrador";
  const initialSellerId = canSwitchSeller
    ? "todos"
    : resolveSellerForUser(user.sellerId)?.id ?? sellers[0]?.id ?? "todos";
  const [selectedSellerId, setSelectedSellerId] = useState(initialSellerId);
  const [sellerQuery, setSellerQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [contactCustomer, setContactCustomer] = useState<CustomerRow | null>(null);
  const sellerId = canSwitchSeller
    ? sellers.some((item) => item.id === selectedSellerId)
      ? selectedSellerId
      : "todos"
    : resolveSellerForUser(user.sellerId)?.id ?? selectedSellerId;
  const selectedSeller = sellers.find((item) => item.id === sellerId);
  const seller = canSwitchSeller ? selectedSeller : selectedSeller ?? sellers[0];
  const sellerSummaries = sellers
    .map((item) => {
      const portfolioCustomers = customers.filter((customer) => sellerPortfolioCustomerMatches(customer, item));
      const portfolioAlerts = alerts.filter((alert) => sellerPortfolioAlertMatches(alert, item));
      const riskCustomers = portfolioCustomers.filter(
        (customer) => customer.activityStatus === "risco" || customer.activityStatus === "perdido",
      ).length;
      const potentialValue = portfolioCustomers.reduce((total, customer) => total + customer.potentialValue, 0);

      return {
        seller: item,
        customerCount: portfolioCustomers.length,
        alertCount: portfolioAlerts.length,
        riskCustomers,
        potentialValue,
      };
    })
    .sort((left, right) => right.customerCount - left.customerCount || left.seller.name.localeCompare(right.seller.name));
  const normalizedSellerQuery = normalizeManualAlertSearch(sellerQuery);
  const filteredSellerSummaries = normalizedSellerQuery
    ? sellerSummaries.filter((item) => normalizeManualAlertSearch(item.seller.name).includes(normalizedSellerQuery))
    : sellerSummaries;
  const visibleSellerSummaries = canSwitchSeller
    ? filteredSellerSummaries
    : filteredSellerSummaries.filter((item) => item.seller.id === seller?.id);
  const sellerCustomers = !canSwitchSeller
    ? customers
    : seller
      ? customers.filter((customer) => sellerPortfolioCustomerMatches(customer, seller))
      : customers;
  const sellerAlerts = !canSwitchSeller
    ? alerts
    : seller
      ? alerts.filter((alert) => sellerPortfolioAlertMatches(alert, seller))
      : alerts;
  const sellerRiskCustomers = sellerCustomers.filter(
    (customer) => customer.activityStatus === "risco" || customer.activityStatus === "perdido",
  ).length;
  const sellerPotentialValue = sellerCustomers.reduce((total, customer) => total + customer.potentialValue, 0);
  const visibleCustomers = sellerCustomers.slice(0, visibleLimit);
  const portfolioTitle = seller ? `Carteira de ${seller.name}` : "Carteira de todos os vendedores";
  const portfolioDescription = seller
    ? `Clientes atribuídos a ${seller.name} por histórico/preferência comercial.`
    : "Visão geral da base. Clique em um vendedor para ver somente a carteira dele.";
  const conversionMetric = seller
    ? `${seller.conversionRate}%`
    : `${average(sellerSummaries.map((item) => item.seller.conversionRate))}%`;

  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="Gestão por vendedor"
        title="Carteira do vendedor"
        description="Clientes, alertas e potencial comercial atribuídos pelo histórico real de compras."
      />
      <Panel title={canSwitchSeller ? "Selecionar vendedor" : "Minha carteira"} icon={UserRound} action={`${sellers.length} vendedores ativos`}>
        {canSwitchSeller && (
          <div className="mb-4 grid gap-3 lg:grid-cols-[1fr_auto]">
            <div className="flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-[#f8fbff] px-3 focus-within:border-cyan-400">
              <Search size={17} className="text-slate-400" />
              <input
                value={sellerQuery}
                onChange={(event) => setSellerQuery(event.target.value)}
                placeholder="Buscar vendedor"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedSellerId("todos");
                setVisibleLimit(30);
              }}
              className={`h-11 rounded-lg px-4 text-sm font-bold transition ${
                sellerId === "todos"
                  ? "bg-[#0753a6] text-white"
                  : "border border-blue-100 bg-white text-[#0753a6] hover:border-cyan-400 hover:bg-cyan-50"
              }`}
            >
              Todos os vendedores
            </button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {visibleSellerSummaries.map(({ seller: item, customerCount, alertCount, riskCustomers, potentialValue }) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (canSwitchSeller) {
                  setSelectedSellerId(item.id);
                  setVisibleLimit(30);
                }
              }}
              disabled={!canSwitchSeller}
              className={`rounded-xl border p-4 text-left transition ${
                item.id === seller?.id
                  ? "border-cyan-400 bg-cyan-50 shadow-sm"
                  : "border-blue-100 bg-[#f8fbff] hover:border-cyan-300"
              } ${canSwitchSeller ? "" : "cursor-default"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{customerCount} clientes na carteira</p>
                </div>
                {item.id === seller?.id && (
                  <span className="rounded-full bg-white px-2 py-1 text-[10px] font-bold uppercase text-cyan-700">
                    Selecionado
                  </span>
                )}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Risco" value={`${riskCustomers}`} />
                <MiniStat label="Alertas" value={`${alertCount}`} />
                <MiniStat label="Potencial" value={formatCurrency(potentialValue)} />
              </div>
            </button>
          ))}
          {!filteredSellerSummaries.length && <EmptyState text="Nenhum vendedor encontrado para a busca." />}
        </div>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Clientes da carteira" value={`${sellerCustomers.length}`} />
        <MetricCard label="Clientes em risco" value={`${sellerRiskCustomers}`} />
        <MetricCard label="Alertas abertos" value={`${sellerAlerts.length}`} />
        <MetricCard label="Potencial perdido" value={formatCurrency(sellerPotentialValue)} />
        <MetricCard label={seller ? "Taxa de conversão" : "Conversão média"} value={conversionMetric} />
      </div>
      <Panel title={portfolioTitle} icon={UsersRound} action={`${visibleCustomers.length} de ${sellerCustomers.length} clientes`}>
        <p className="mb-4 text-sm text-slate-500">{portfolioDescription}</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleCustomers.map((customer) => (
            <div
              key={customer.id}
              className="grid gap-3 rounded-lg border border-blue-100 bg-[#f8fbff] p-4 transition hover:border-cyan-400 hover:bg-white md:grid-cols-[1fr_auto]"
            >
              <div>
                <p className="font-bold text-slate-900">{customer.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {customer.city || "Cidade nao informada"} · {customer.sellerAffinity}% de afinidade · {customer.preferredSeller}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge status={customer.activityStatus} label={customer.status} />
                  <QualityBadge status={customer.qualityStatus} score={customer.qualityScore} />
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">Potencial</p>
                <p className="mt-1 font-bold text-orange-700">{customer.potential}</p>
                <div className="mt-3 flex flex-wrap justify-end gap-2">
                  <WhatsAppButton
                    customer={customer}
                    user={user}
                    onUpdateContact={onUpdateContact}
                    onRegisterContact={onRegisterContact}
                    compact
                  />
                  <button
                    type="button"
                    onClick={() => setContactCustomer(customer)}
                    className="rounded-lg border border-cyan-200 bg-white px-3 py-2 text-xs font-semibold text-[#0753a6] transition hover:bg-cyan-50"
                  >
                    Registrar retorno
                  </button>
                  <button
                    type="button"
                    onClick={() => openProfile(customer)}
                    className="rounded-lg bg-[#0753a6] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[#063d7c]"
                  >
                    Abrir perfil
                  </button>
                </div>
              </div>
            </div>
          ))}
          {!visibleCustomers.length && <EmptyState text="Nenhum cliente encontrado para esta carteira." />}
        </div>
        {sellerCustomers.length > visibleCustomers.length && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleLimit((current) => current + 30)}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-bold text-[#0753a6] hover:border-cyan-400 hover:bg-cyan-50"
            >
              <MoreHorizontal size={17} />
              Ver mais 30
            </button>
          </div>
        )}
      </Panel>
      {contactCustomer && (
        <ContactOutcomeModal
          customer={contactCustomer}
          defaultResponsible={seller?.name ?? user.name}
          onClose={() => setContactCustomer(null)}
          onSave={async (record) => {
            await onRegisterContact(record);
            setContactCustomer(null);
          }}
        />
      )}
    </div>
  );
}

function sellerPortfolioCustomerMatches(customer: CustomerRow, seller: SellerRow) {
  return customer.preferredSellerId === seller.id || customer.preferredSeller === seller.name;
}

function sellerPortfolioAlertMatches(alert: AlertRow, seller: SellerRow) {
  return alert.sellerId === seller.id || alert.seller === seller.name;
}

function DataHealth({
  customers,
  openProfile,
}: {
  customers: CustomerRow[];
  openProfile: (customer: CustomerRow) => void;
}) {
  const missingWhatsapp = customers.filter((customer) => !customer.whatsapp);
  const missingPhone = customers.filter((customer) => !customer.phone);
  const missingCity = customers.filter((customer) => !customer.cityId);
  const missingDocument = customers.filter((customer) => !customer.document);
  const qualityOrder = ["ruim", "regular", "bom", "excelente"] as const;

  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="Qualidade de dados"
        title="Saúde da base de clientes"
        description="Priorize correções cadastrais que aumentam a capacidade de contato e segmentação."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <RecoveryMetric value={`${missingWhatsapp.length}`} label="Sem WhatsApp" tone="orange" />
        <RecoveryMetric value={`${missingPhone.length}`} label="Sem telefone" tone="red" />
        <RecoveryMetric value={`${missingCity.length}`} label="Sem cidade" tone="amber" />
        <RecoveryMetric value={`${missingDocument.length}`} label="Sem CPF/CNPJ" tone="blue" />
        <RecoveryMetric value={`${dashboard.averageRegistrationQuality}%`} label="Score médio" tone="blue" />
      </div>
      <Panel title="Distribuição da qualidade" icon={ShieldCheck} action={`${customers.length} clientes avaliados`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {qualityOrder.map((status) => {
            const total = customers.filter((customer) => customer.qualityStatus === status).length;
            return (
              <div key={status} className="rounded-xl border border-blue-100 bg-[#f8fbff] p-4">
                <QualityBadge status={status} score={total} suffix="clientes" />
                <div className="mt-4 h-2 rounded-full bg-slate-100">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-[#0753a6] to-cyan-400"
                    style={{ width: `${customers.length ? (total / customers.length) * 100 : 0}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Panel title="Cadastros que precisam de atenção" icon={AlertTriangle} action="Menor score primeiro">
        <div className="grid gap-3 lg:grid-cols-2">
          {[...customers]
            .sort((a, b) => a.qualityScore - b.qualityScore)
            .slice(0, 6)
            .map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => openProfile(customer)}
                className="flex items-center justify-between gap-3 rounded-lg border border-blue-100 bg-[#f8fbff] p-4 text-left hover:border-cyan-400 hover:bg-white"
              >
                <div>
                  <p className="font-semibold text-slate-900">{customer.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {!customer.whatsapp ? "Sem WhatsApp · " : ""}
                    {!customer.document ? "Sem CPF/CNPJ · " : ""}
                    {customer.city}
                  </p>
                </div>
                <QualityBadge status={customer.qualityStatus} score={customer.qualityScore} />
              </button>
            ))}
        </div>
      </Panel>
    </div>
  );
}

function Opportunities({
  items,
  user,
  customers,
  sellers,
  onSave,
  onDelete,
  onUpdateContact,
  onRegisterContact,
}: {
  items: CrmOpportunity[];
  user: CrmSessionUser;
  customers: CustomerRow[];
  sellers: SellerRow[];
  onSave: (opportunity: Omit<CrmOpportunity, "id">, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onUpdateContact: (
    customer: CustomerRow,
    phone: string,
    options?: CustomerContactUpdateOptions,
  ) => Promise<void>;
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  const [editing, setEditing] = useState<CrmOpportunity | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<CrmOpportunity["status"] | "todos">("todos");
  const [productFilter, setProductFilter] = useState("todos");
  const [visibleLimit, setVisibleLimit] = useState(OPPORTUNITY_PAGE_SIZE);
  const allowedSellerId = resolveSellerForUser(user.sellerId)?.id ?? user.sellerId;
  const canManage = (item?: CrmOpportunity) =>
    user.role !== "vendedor" || !item || item.sellerId === allowedSellerId;
  const lonaItems = items.filter(isLonaOpportunity);
  const opportunityGroups = buildOpportunityGroups(lonaItems, customers);
  const productOptions = opportunityGroups.map((group) => group.productName);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = lonaItems.filter((item) => {
    const matchesQuery =
      !normalizedQuery ||
      item.customerName.toLowerCase().includes(normalizedQuery) ||
      item.sourceProductName.toLowerCase().includes(normalizedQuery) ||
      item.suggestedProductName.toLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === "todos" || item.status === statusFilter;
    const matchesProduct = productFilter === "todos" || item.suggestedProductName === productFilter;
    return matchesQuery && matchesStatus && matchesProduct;
  });
  const visibleItems = filteredItems.slice(0, visibleLimit);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle eyebrow="Venda cruzada" title="Central de oportunidades" description="Oportunidades de Lona sugeridas a partir do comportamento de compra." />
        <button type="button" onClick={() => setEditing("new")} className="flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white hover:bg-[#063d7c] sm:w-auto">
          <Plus size={17} />
          Nova oportunidade
        </button>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Oportunidades Lona" value={`${lonaItems.length}`} />
        <MetricCard label="Campanhas sugeridas" value={`${opportunityGroups.length}`} />
        <MetricCard label="Clientes alvo" value={`${new Set(lonaItems.map((item) => item.customerId)).size}`} />
        <MetricCard label="Confiança média" value={`${average(lonaItems.map((item) => item.confidence))}%`} />
      </div>
      <Panel title="Campanhas sugeridas" icon={Target} action="Agrupadas por produto">
        <div className="grid gap-3 xl:grid-cols-3">
          {opportunityGroups.map((group) => (
            <article key={group.productName} className="rounded-lg border border-blue-100 bg-[#f8fbff] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Produto sugerido</p>
                  <h2 className="mt-1 break-words text-lg font-black text-[#123252]">{group.productName}</h2>
                </div>
                <span className="w-fit rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">
                  {group.averageConfidence}% confiança
                </span>
              </div>
              <p className="mt-3 text-sm leading-5 text-slate-600">
                Use como campanha de venda cruzada: a equipe aborda clientes que compraram itens relacionados e registra o retorno para medir resultado.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                <MiniStat label="Clientes" value={`${group.customerCount}`} />
                <MiniStat label="Potencial" value={formatCurrency(group.potentialValue)} />
                <MiniStat label="Abertas" value={`${group.openCount}`} />
              </div>
              <div className="mt-4 space-y-2">
                {group.topCustomers.map((customer) => (
                  <div key={customer} className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-xs">
                    <span className="min-w-0 break-words font-semibold text-slate-700">{customer}</span>
                    <ChevronRight size={14} className="shrink-0 text-slate-400" />
                  </div>
                ))}
              </div>
            </article>
          ))}
          {!opportunityGroups.length && <EmptyState text="Nenhuma campanha de oportunidade gerada ainda." />}
        </div>
      </Panel>
      <Panel title="Clientes alvo" icon={ShoppingBag} action={`${visibleItems.length} de ${filteredItems.length} oportunidades Lona`}>
        <div className="mb-4 grid gap-3 md:grid-cols-[1.2fr_0.75fr_0.9fr]">
          <div className="flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-[#f8fbff] px-3 focus-within:border-cyan-400">
            <Search size={17} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setVisibleLimit(OPPORTUNITY_PAGE_SIZE);
              }}
              placeholder="Cliente, origem ou produto"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <FilterSelect
            label="Status"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value as CrmOpportunity["status"] | "todos");
              setVisibleLimit(OPPORTUNITY_PAGE_SIZE);
            }}
          >
            <option value="todos">Todos</option>
            <option value="aberta">Aberta</option>
            <option value="em_contato">Em contato</option>
            <option value="convertida">Convertida</option>
            <option value="descartada">Descartada</option>
          </FilterSelect>
          <FilterSelect
            label="Produto sugerido"
            value={productFilter}
            onChange={(value) => {
              setProductFilter(value);
              setVisibleLimit(OPPORTUNITY_PAGE_SIZE);
            }}
          >
            <option value="todos">Todos os produtos</option>
            {productOptions.map((product) => <option key={product} value={product}>{product}</option>)}
          </FilterSelect>
        </div>
        <div className="space-y-3 md:hidden">
          {visibleItems.map((item) => {
            const customer = customers.find((entry) => entry.id === item.customerId);

            return (
              <article key={item.id} className="rounded-xl border border-blue-50 bg-[#f8fbff] p-3">
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="break-words font-bold text-[#123252]">{item.customerName}</p>
                    <p className="mt-1 text-xs font-semibold text-cyan-700">{item.confidence}% confiança</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-cyan-50 px-2 py-1 text-xs font-semibold capitalize text-cyan-700">
                    {item.status.replace("_", " ")}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm">
                  <div className="rounded-lg bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Comprou</p>
                    <p className="mt-1 break-words text-slate-700">{item.sourceProductName}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Sugerir</p>
                    <p className="mt-1 break-words font-semibold text-[#0753a6]">{item.suggestedProductName}</p>
                  </div>
                  <div className="rounded-lg bg-white px-3 py-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Responsável</p>
                    <p className="mt-1 break-words text-slate-700">{item.sellerName}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {customer && (
                    <WhatsAppButton
                      customer={customer}
                      user={user}
                      message={`Olá! Aqui é da Hennder CRM. Temos uma sugestão que combina com sua compra de ${item.sourceProductName}: ${item.suggestedProductName}. Gostaria de saber mais?`}
                      onUpdateContact={onUpdateContact}
                      onRegisterContact={onRegisterContact}
                      compact
                    />
                  )}
                  {canManage(item) && (
                    <>
                      <button type="button" aria-label={`Editar oportunidade de ${item.customerName}`} onClick={() => setEditing(item)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-white text-[#0753a6]">
                        <Pencil size={15} />
                      </button>
                      <button type="button" aria-label={`Excluir oportunidade de ${item.customerName}`} onClick={() => { if (window.confirm("Excluir esta oportunidade?")) void onDelete(item.id); }} className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700">
                        <Trash2 size={15} />
                      </button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[980px] w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Comprou</th>
                <th className="px-3 py-2">Sugerir</th>
                <th className="px-3 py-2">Responsável</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {visibleItems.map((item) => {
                const customer = customers.find((entry) => entry.id === item.customerId);

                return (
                  <tr key={item.id} className="align-top hover:bg-cyan-50/60">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[#123252]">{item.customerName}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.confidence}% confiança</p>
                    </td>
                    <td className="px-3 py-3">{item.sourceProductName}</td>
                    <td className="px-3 py-3 font-semibold text-[#0753a6]">{item.suggestedProductName}</td>
                    <td className="px-3 py-3">{item.sellerName}</td>
                    <td className="px-3 py-3">
                      <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold capitalize text-cyan-700">
                        {item.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-wrap gap-2">
                        {customer && (
                          <WhatsAppButton
                            customer={customer}
                            user={user}
                            message={`Olá! Aqui é da Hennder CRM. Temos uma sugestão que combina com sua compra de ${item.sourceProductName}: ${item.suggestedProductName}. Gostaria de saber mais?`}
                            onUpdateContact={onUpdateContact}
                            onRegisterContact={onRegisterContact}
                            compact
                          />
                        )}
                        {canManage(item) && (
                          <>
                            <button type="button" aria-label={`Editar oportunidade de ${item.customerName}`} onClick={() => setEditing(item)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-white text-[#0753a6]">
                              <Pencil size={15} />
                            </button>
                            <button type="button" aria-label={`Excluir oportunidade de ${item.customerName}`} onClick={() => { if (window.confirm("Excluir esta oportunidade?")) void onDelete(item.id); }} className="flex h-10 w-10 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700">
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!filteredItems.length && <EmptyState text="Nenhuma oportunidade encontrada para os filtros atuais." />}
        {filteredItems.length > visibleItems.length && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleLimit((current) => current + OPPORTUNITY_PAGE_SIZE)}
              className="flex h-11 items-center justify-center gap-2 rounded-lg border border-blue-100 bg-white px-4 text-sm font-bold text-[#0753a6] hover:border-cyan-400 hover:bg-cyan-50"
            >
              <MoreHorizontal size={17} />
              Ver mais 20
            </button>
          </div>
        )}
      </Panel>
      {editing && (
        <OpportunityModal
          opportunity={editing === "new" ? undefined : editing}
          user={user}
          customers={customers}
          sellers={sellers}
          onClose={() => setEditing(null)}
          onSave={async (opportunity) => {
            await onSave(opportunity, editing === "new" ? undefined : editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function isLonaOpportunity(item: CrmOpportunity) {
  return normalizeOpportunityProductText(item.suggestedProductName).includes("lona");
}

function normalizeOpportunityProductText(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function buildOpportunityGroups(items: CrmOpportunity[], customers: CustomerRow[]) {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const groups = new Map<string, {
    productName: string;
    customerIds: Set<string>;
    confidenceValues: number[];
    potentialValue: number;
    openCount: number;
    topCustomers: string[];
  }>();

  for (const item of items) {
    const current = groups.get(item.suggestedProductName) ?? {
      productName: item.suggestedProductName,
      customerIds: new Set<string>(),
      confidenceValues: [],
      potentialValue: 0,
      openCount: 0,
      topCustomers: [],
    };
    const customer = customerById.get(item.customerId);
    if (!current.customerIds.has(item.customerId)) {
      current.customerIds.add(item.customerId);
      current.potentialValue += customer?.potentialValue ?? 0;
      if (current.topCustomers.length < 5) current.topCustomers.push(item.customerName);
    }
    current.confidenceValues.push(item.confidence);
    if (item.status === "aberta" || item.status === "em_contato") current.openCount += 1;
    groups.set(item.suggestedProductName, current);
  }

  return [...groups.values()]
    .map((group) => ({
      productName: group.productName,
      customerCount: group.customerIds.size,
      averageConfidence: average(group.confidenceValues),
      potentialValue: group.potentialValue,
      openCount: group.openCount,
      topCustomers: group.topCustomers,
    }))
    .sort((left, right) => right.customerCount - left.customerCount || right.averageConfidence - left.averageConfidence);
}

function average(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function Agenda({
  items,
  user,
  customers,
  sellers,
  onSave,
  onDelete,
}: {
  items: CrmAgendaEvent[];
  user: CrmSessionUser;
  customers: CustomerRow[];
  sellers: SellerRow[];
  onSave: (event: Omit<CrmAgendaEvent, "id">, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<CrmAgendaEvent | "new" | null>(null);
  const [followUpFilter, setFollowUpFilter] = useState<"today" | "upcoming" | "overdue">("upcoming");
  const days = buildWorkWeek(crmReferenceDate);
  const canManage = (event?: CrmAgendaEvent) =>
    !event?.contactId &&
    (user.role !== "vendedor" || !event || event.sellerId === (resolveSellerForUser(user.sellerId)?.id ?? user.sellerId));
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const sellerById = new Map(sellers.map((seller) => [seller.id, seller]));
  const followUps = items.filter(isOpenAutomaticFollowUp).sort(compareAgendaEvents);
  const visibleFollowUps = followUps.filter((event) => {
    if (followUpFilter === "today") return event.date === crmReferenceDate;
    if (followUpFilter === "overdue") return event.date < crmReferenceDate;
    return event.date > crmReferenceDate;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle eyebrow="Rotina comercial" title="Agenda comercial" description="Ligações, visitas, retornos e recompras previstas em visão semanal." />
        <button type="button" onClick={() => setEditing("new")} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white hover:bg-[#063d7c]">
          <Plus size={17} />
          Novo compromisso
        </button>
      </div>
      <Panel
        title="Retornos agendados"
        icon={Clock3}
        action={`${followUps.length} pendente${followUps.length === 1 ? "" : "s"}`}
      >
        <div className="mb-4 flex w-full rounded-lg border border-blue-100 bg-[#f8fbff] p-1 sm:w-auto sm:max-w-md">
          {[
            ["today", "Hoje"],
            ["upcoming", "Próximos"],
            ["overdue", "Atrasados"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setFollowUpFilter(value as "today" | "upcoming" | "overdue")}
              className={`h-10 flex-1 rounded-md px-3 text-sm font-bold transition ${
                followUpFilter === value
                  ? "bg-[#0753a6] text-white shadow-sm"
                  : "text-slate-500 hover:bg-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="divide-y divide-blue-50 overflow-hidden rounded-lg border border-blue-100">
          {visibleFollowUps.slice(0, 20).map((event) => {
            const customer = event.customerId ? customerById.get(event.customerId) : undefined;
            const seller = event.sellerId ? sellerById.get(event.sellerId) : undefined;
            const overdue = event.date < crmReferenceDate;
            return (
              <div
                key={event.id}
                className="grid gap-3 bg-white px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold text-[#123252]">
                    {customer?.name ?? event.title.replace(/^Retorno:\s*/u, "")}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {seller?.name ?? "Vendedor não identificado"} · WhatsApp ou telefone
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:justify-end">
                  <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                    overdue
                      ? "bg-red-100 text-red-700"
                      : event.date === crmReferenceDate
                        ? "bg-amber-100 text-amber-800"
                        : "bg-cyan-50 text-cyan-800"
                  }`}>
                    {overdue
                      ? `Atrasado desde ${formatContactDate(event.date)}`
                      : event.date === crmReferenceDate
                        ? `Hoje, ${event.time}`
                        : `${formatContactDate(event.date)}, ${event.time}`}
                  </span>
                </div>
              </div>
            );
          })}
          {!visibleFollowUps.length && (
            <div className="bg-[#f8fbff] px-4 py-8 text-center text-sm text-slate-500">
              Nenhum retorno nesta faixa.
            </div>
          )}
        </div>
      </Panel>
      <Panel title="Semana atual" icon={CalendarDays} action="Agenda operacional">
        <div className="grid gap-3 lg:grid-cols-5">
          {days.map(([day, date]) => (
            <div key={date} className="min-h-[430px] rounded-lg border border-blue-100 bg-[#f3f8fd] p-3">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold">{day}</p>
                <span className="text-xs text-slate-400">{formatContactDate(date).slice(0, 5)}</span>
              </div>
              <div className="space-y-3">
                {items.filter((event) => event.date === date).map((event) => (
                  <div key={event.id} className="rounded-lg border border-blue-100 bg-white p-3 shadow-sm transition hover:border-cyan-400 hover:shadow-md">
                    <div className={`mb-3 h-1.5 w-10 rounded-full ${agendaEventColor(event.type)}`} />
                    <p className="text-xs font-medium text-slate-500">{event.time} · {event.type}</p>
                    <p className="mt-1 text-sm font-semibold">{event.title}</p>
                    {canManage(event) && (
                      <div className="mt-3 flex justify-end gap-2">
                        <button type="button" aria-label={`Editar ${event.title}`} onClick={() => setEditing(event)} className="flex h-8 w-8 items-center justify-center rounded-md border border-blue-100 text-[#0753a6]">
                          <Pencil size={14} />
                        </button>
                        <button type="button" aria-label={`Excluir ${event.title}`} onClick={() => { if (window.confirm("Excluir este compromisso?")) void onDelete(event.id); }} className="flex h-8 w-8 items-center justify-center rounded-md border border-red-200 text-red-700">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!items.some((event) => event.date === date) && (
                  <p className="rounded-lg border border-dashed border-blue-200 px-3 py-6 text-center text-xs text-slate-400">Sem tarefas</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      {editing && (
        <AgendaEventModal
          event={editing === "new" ? undefined : editing}
          user={user}
          customers={customers}
          sellers={sellers}
          onClose={() => setEditing(null)}
          onSave={async (event) => {
            await onSave(event, editing === "new" ? undefined : editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function buildWorkWeek(referenceDate: string): Array<[string, string]> {
  const labels = ["Seg", "Ter", "Qua", "Qui", "Sex"];
  const reference = new Date(`${referenceDate.slice(0, 10)}T12:00:00Z`);
  const weekDay = reference.getUTCDay();
  const mondayOffset = weekDay === 0 ? -6 : 1 - weekDay;
  const monday = new Date(reference);
  monday.setUTCDate(reference.getUTCDate() + mondayOffset);

  return labels.map((label, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    return [label, day.toISOString().slice(0, 10)];
  });
}

function OpportunityModal({
  opportunity,
  user,
  customers,
  sellers,
  onClose,
  onSave,
}: {
  opportunity?: CrmOpportunity;
  user: CrmSessionUser;
  customers: CustomerRow[];
  sellers: SellerRow[];
  onClose: () => void;
  onSave: (opportunity: Omit<CrmOpportunity, "id">) => Promise<void>;
}) {
  const defaultSeller = resolveSellerForUser(user.sellerId) ?? sellers[0];
  const [customerId, setCustomerId] = useState(opportunity?.customerId ?? customers[0]?.id ?? "");
  const [sourceProductName, setSourceProductName] = useState(opportunity?.sourceProductName ?? "");
  const [suggestedProductName, setSuggestedProductName] = useState(opportunity?.suggestedProductName ?? "");
  const [reason, setReason] = useState(opportunity?.reason ?? "");
  const [confidence, setConfidence] = useState(opportunity?.confidence ?? 70);
  const [status, setStatus] = useState<CrmOpportunity["status"]>(opportunity?.status ?? "aberta");
  const [sellerId, setSellerId] = useState(opportunity?.sellerId ?? defaultSeller?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <ModalFrame title={opportunity ? "Editar oportunidade" : "Nova oportunidade"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={async (event) => {
        event.preventDefault();
        const customer = customers.find((item) => item.id === customerId);
        const seller = sellers.find((item) => item.id === sellerId);
        if (!customer || !seller) return;
        setSaving(true);
        setError("");
        try {
          await onSave({ customerId, customerName: customer.name, sourceProductName, suggestedProductName, reason, confidence, status, sellerId, sellerName: seller.name });
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
        } finally {
          setSaving(false);
        }
      }}>
        <FormSelect label="Cliente" value={customerId} onChange={setCustomerId}>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </FormSelect>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Produto de origem" value={sourceProductName} onChange={setSourceProductName} />
          <FormInput label="Produto sugerido" value={suggestedProductName} onChange={setSuggestedProductName} />
        </div>
        <FormInput label="Motivo comercial" value={reason} onChange={setReason} />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput label="Confiança (%)" value={`${confidence}`} onChange={(value) => setConfidence(Math.min(100, Math.max(0, Number(value))))} type="number" />
          <FormSelect label="Status" value={status} onChange={(value) => setStatus(value as CrmOpportunity["status"])}>
            <option value="aberta">Aberta</option>
            <option value="em_contato">Em contato</option>
            <option value="convertida">Convertida</option>
            <option value="descartada">Descartada</option>
          </FormSelect>
          <FormSelect label="Responsável" value={sellerId} onChange={setSellerId} disabled={user.role !== "administrador"}>
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </FormSelect>
        </div>
        <ModalActions saving={saving} error={error} onClose={onClose} />
      </form>
    </ModalFrame>
  );
}

function AgendaEventModal({
  event,
  user,
  customers,
  sellers,
  onClose,
  onSave,
}: {
  event?: CrmAgendaEvent;
  user: CrmSessionUser;
  customers: CustomerRow[];
  sellers: SellerRow[];
  onClose: () => void;
  onSave: (event: Omit<CrmAgendaEvent, "id">) => Promise<void>;
}) {
  const defaultSeller = resolveSellerForUser(user.sellerId) ?? sellers[0];
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? crmReferenceDate);
  const [time, setTime] = useState(event?.time ?? "09:00");
  const [type, setType] = useState<CrmAgendaEvent["type"]>(event?.type ?? "Ligacao");
  const [customerId, setCustomerId] = useState(event?.customerId ?? "");
  const [sellerId, setSellerId] = useState(event?.sellerId ?? defaultSeller?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <ModalFrame title={event ? "Editar compromisso" : "Novo compromisso"} onClose={onClose}>
      <form className="grid gap-4" onSubmit={async (submitEvent) => {
        submitEvent.preventDefault();
        setSaving(true);
        setError("");
        try {
          await onSave({ title, date, time, type, customerId: customerId || undefined, sellerId: sellerId || undefined });
        } catch (saveError) {
          setError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
        } finally {
          setSaving(false);
        }
      }}>
        <FormInput label="Título" value={title} onChange={setTitle} />
        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput label="Data" value={date} onChange={setDate} type="date" />
          <FormInput label="Horário" value={time} onChange={setTime} type="time" />
          <FormSelect label="Tipo" value={type} onChange={(value) => setType(value as CrmAgendaEvent["type"])}>
            <option value="Ligacao">Ligação</option>
            <option value="Visita">Visita</option>
            <option value="Retorno">Retorno</option>
            <option value="Recompra">Recompra</option>
          </FormSelect>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormSelect label="Cliente" value={customerId} onChange={setCustomerId}>
            <option value="">Sem cliente vinculado</option>
            {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
          </FormSelect>
          <FormSelect label="Responsável" value={sellerId} onChange={setSellerId} disabled={user.role !== "administrador"}>
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </FormSelect>
        </div>
        <ModalActions saving={saving} error={error} onClose={onClose} />
      </form>
    </ModalFrame>
  );
}

function CommercialAi({
  customers,
  alerts,
  opportunities,
  agenda,
  contactRecords,
}: {
  customers: CustomerRow[];
  alerts: AlertRow[];
  opportunities: CrmOpportunity[];
  agenda: CrmAgendaEvent[];
  contactRecords: ContactRecord[];
}) {
  const prompts = [
    "Quais clientes devo ligar hoje?",
    "Quem esta em risco de abandono?",
    "Quais produtos tem maior potencial de recompra?",
    "Mostre clientes que compravam mensalmente e pararam.",
    "Quem esta sem WhatsApp ou com cadastro fraco?",
    "Qual vendedor precisa de mais atencao hoje?",
  ];
  const context = { customers, alerts, opportunities, agenda, contactRecords };
  const welcomeMessage = getCommercialAiWelcomeMessage();
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "welcome", role: "ai", text: welcomeMessage },
  ]);
  const [isThinking, setIsThinking] = useState(false);
  const messageIdRef = useRef(0);
  const insights = buildCommercialAiInsights(context);
  const ask = (nextQuestion = question) => {
    const cleanQuestion = nextQuestion.trim();
    if (!cleanQuestion) return;
    messageIdRef.current += 1;
    const userMessage: ChatMessage = {
      id: `user-${messageIdRef.current}`,
      role: "user",
      text: cleanQuestion,
    };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setIsThinking(true);
    window.setTimeout(() => {
      messageIdRef.current += 1;
      const aiMessage: ChatMessage = {
        id: `ai-${messageIdRef.current}`,
        role: "ai",
        text: getCommercialAiAnswer(cleanQuestion, context),
      };
      setMessages((current) => [...current, aiMessage]);
      setIsThinking(false);
    }, 360);
  };

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Assistente comercial" title="IA Comercial" description="Assistente local que transforma dados comerciais em prioridades, scripts e proximas acoes." />
      <div className="grid gap-4 md:grid-cols-4">
        {insights.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#e7f4ff] text-[#0753a6]">
                  <Icon size={18} />
                </span>
                <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${item.tone}`}>
                  {item.badge}
                </span>
              </div>
              <p className="mt-4 text-2xl font-black text-[#123252]">{item.value}</p>
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-400">{item.label}</p>
            </div>
          );
        })}
      </div>
      <Panel title="Chat comercial" icon={Bot} action="Dados locais + Obsidian">
        <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-3">
            <div className="rounded-xl border border-cyan-100 bg-cyan-50/70 p-4 text-sm leading-6 text-cyan-900">
              <div className="mb-2 flex items-center gap-2 font-bold">
                <Sparkles size={16} />
                Perguntas prontas
              </div>
              Use essas entradas como atalho ou escreva do seu jeito. A IA cruza recompra, risco, potencial e qualidade do cadastro.
            </div>
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => ask(prompt)}
                className="w-full rounded-lg border border-blue-100 bg-[#f8fbff] p-4 text-left text-sm font-medium text-slate-700 transition hover:border-cyan-400 hover:bg-white"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-blue-100 bg-[#f3f8fd] p-4 shadow-inner">
            <div className="max-h-[520px] min-h-[380px] space-y-4 overflow-y-auto pr-1">
              {messages.map((message) => (
                <ChatBubble key={message.id} role={message.role} text={message.text} />
              ))}
              {isThinking && (
                <ChatBubble role="ai" text="Analisando..." />
              )}
            </div>
            <div className="mt-5 flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") ask();
                }}
                placeholder="Pergunte sobre clientes, produtos, vendedores ou oportunidades"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => ask()}
                disabled={isThinking}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0753a6] text-white disabled:opacity-60"
              >
                {isThinking ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <Send size={16} />}
              </button>
            </div>
            <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
              No momento ela roda como IA comercial local, sem enviar dados para fora. Quando quisermos, plugamos OpenAI ou outro modelo usando esse mesmo contexto.
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
function Reports({
  theme,
  customers,
  alerts,
  opportunities,
  contactRecords,
  products,
}: {
  theme: Theme;
  customers: CustomerRow[];
  alerts: AlertRow[];
  opportunities: CrmOpportunity[];
  contactRecords: ContactRecord[];
  products: ProductRow[];
}) {
  const chartColors = getChartColors(theme);
  const pendingAlerts = alerts.filter((alert) => alert.status === "pendente");
  const calledCustomers = contactRecords;
  const potentialCustomers = [...customers].sort((a, b) => b.potentialValue - a.potentialValue).slice(0, 30);
  const highConversion = [...opportunities]
    .filter((item) => item.status === "aberta" || item.status === "em_contato")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 30);
  const reportCards = [
    ["Clientes perdidos", `${customers.filter((customer) => customer.activityStatus === "perdido").length}`],
    ["Alertas de recompra", `${alerts.length}`],
    ["Produtos recorrentes", `${products.filter((product) => product.repurchaseActive).length}`],
    ["Potencial perdido", formatCurrency(customers.reduce((total, customer) => total + customer.potentialValue, 0))],
    ["Qualidade da base", `${customers.length ? Math.round(customers.reduce((total, customer) => total + customer.qualityScore, 0) / customers.length) : 0}%`],
  ];
  const scopedReportBars = buildReportBars(customers, alerts);
  const pdfReports = [
    {
      title: "Clientes para ligar",
      description: "Fila priorizada por alerta pendente, prioridade e data prevista de recompra.",
      count: pendingAlerts.length,
      icon: Phone,
      onClick: () => openPrintableReport({
        title: "Relatorio - Clientes para ligar",
        subtitle: "Prioridade de contato comercial e recompra",
        summary: [`${pendingAlerts.length} cliente(s) na fila`, `${alerts.filter((alert) => alert.priorityCode === "alta").length} alerta(s) de alta prioridade`],
        columns: ["Cliente", "Produto", "Prioridade", "Vendedor", "Contato sugerido", "Data prevista"],
        rows: pendingAlerts.sort(compareAlertPriority).map((alert) => {
          const customer = customers.find((item) => item.id === alert.customerId);
          return [
            alert.client,
            alert.product,
            alert.priority,
            alert.seller,
            customer?.whatsapp ? "WhatsApp" : customer?.phone ? "Telefone" : "Atualizar cadastro",
            alert.recommended,
          ];
        }),
      }),
    },
    {
      title: "Clientes ligados",
      description: "Historico de retornos registrados pela equipe comercial.",
      count: calledCustomers.length,
      icon: CheckCircle2,
      onClick: () => openPrintableReport({
        title: "Relatorio - Clientes ligados",
        subtitle: "Contatos realizados, resultado e proximo passo",
        summary: [`${calledCustomers.length} contato(s) registrado(s)`],
        columns: ["Cliente", "Canal", "Resultado", "Responsavel", "Data", "Proximo contato"],
        rows: calledCustomers.map((record) => [
          record.customerName,
          record.channel,
          contactOutcomeLabels[record.outcome],
          record.responsible,
          formatContactDate(record.contactedAt),
          record.nextContact ? formatContactDate(record.nextContact) : "-",
        ]),
      }),
    },
    {
      title: "Maiores potenciais",
      description: "Clientes ordenados por potencial perdido e ticket medio.",
      count: potentialCustomers.length,
      icon: CircleDollarSign,
      onClick: () => openPrintableReport({
        title: "Relatorio - Maiores potenciais",
        subtitle: "Clientes com maior chance de recuperar faturamento",
        summary: [`Potencial listado: ${formatCurrency(potentialCustomers.reduce((total, customer) => total + customer.potentialValue, 0))}`],
        columns: ["Cliente", "Potencial", "Ticket medio", "Dias sem compra", "Vendedor", "WhatsApp"],
        rows: potentialCustomers.map((customer) => [
          customer.name,
          customer.potential,
          customer.ticket,
          `${customer.days} dias`,
          customer.preferredSeller,
          customer.whatsapp || customer.phone || "Sem contato",
        ]),
      }),
    },
    {
      title: "Grande chance de conversao",
      description: "Oportunidades abertas com maior confianca comercial.",
      count: highConversion.length,
      icon: Target,
      onClick: () => openPrintableReport({
        title: "Relatorio - Grande chance de conversao",
        subtitle: "Oportunidades para abordagem consultiva",
        summary: [`${highConversion.length} oportunidade(s) selecionada(s)`],
        columns: ["Cliente", "Produto sugerido", "Confianca", "Status", "Vendedor", "Motivo"],
        rows: highConversion.map((item) => [
          item.customerName,
          item.suggestedProductName,
          `${item.confidence}%`,
          item.status,
          item.sellerName,
          item.reason,
        ]),
      }),
    },
  ];

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Analytics" title="Relatórios" description="Leitura analítica e PDFs comerciais para reunião, rotina de ligação e apresentação ao cliente." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {reportCards.map(([label, value]) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </div>
      <Panel title="Relatórios em PDF" icon={FileText} action="Exportação comercial">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {pdfReports.map((report) => {
            const Icon = report.icon;
            return (
              <button
                key={report.title}
                type="button"
                onClick={report.onClick}
                className="rounded-xl border border-blue-100 bg-[#f8fbff] p-4 text-left transition hover:border-cyan-400 hover:bg-white hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0753a6] text-white">
                    <Icon size={19} />
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2 py-1 text-xs font-bold text-cyan-700">
                    <Download size={13} />
                    PDF
                  </span>
                </div>
                <p className="mt-4 text-base font-black text-[#123252]">{report.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-500">{report.description}</p>
                <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">{report.count} registro(s)</p>
              </button>
            );
          })}
        </div>
        <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
          Ao clicar, o sistema abre um relatório pronto para salvar como PDF pelo navegador. Quando a importação mensal entrar, esses PDFs já saem com a base nova.
        </p>
      </Panel>
      <Panel title="Performance por relatório" icon={BarChart3}>
        <div className="h-96">
          <MeasuredChart>
            {({ width, height }) => (
              <BarChart width={width} height={height} data={scopedReportBars}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: chartColors.text }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: chartColors.text }} />
                <Tooltip contentStyle={chartColors.tooltip} />
                <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#0f766e" />
              </BarChart>
            )}
          </MeasuredChart>
        </div>
      </Panel>
    </div>
  );
}

type PrintableReport = {
  title: string;
  subtitle: string;
  summary: string[];
  columns: string[];
  rows: Array<Array<string | number>>;
};

function openPrintableReport(report: PrintableReport) {
  const printWindow = window.open("", "_blank", "width=1100,height=820");
  if (!printWindow) return;

  const rows = report.rows.length
    ? report.rows
        .map((row) => `
          <tr>
            ${row.map((cell) => `<td>${escapeReportHtml(String(cell))}</td>`).join("")}
          </tr>
        `)
        .join("")
    : `<tr><td colspan="${report.columns.length}">Nenhum registro encontrado para este relatório.</td></tr>`;

  const html = `<!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>${escapeReportHtml(report.title)}</title>
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            background: #f4f8fb;
            color: #123252;
            font-family: Arial, Helvetica, sans-serif;
          }
          .page {
            max-width: 1120px;
            margin: 0 auto;
            padding: 36px;
          }
          .cover {
            border-radius: 22px;
            background: linear-gradient(135deg, #0753a6, #06356c 58%, #16c786);
            color: white;
            padding: 28px;
            box-shadow: 0 18px 50px rgba(6, 53, 108, 0.2);
          }
          .brand {
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            opacity: 0.82;
          }
          h1 {
            margin: 12px 0 6px;
            font-size: 34px;
            line-height: 1.1;
          }
          .subtitle {
            margin: 0;
            color: rgba(255,255,255,0.82);
            font-size: 15px;
          }
          .summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin: 22px 0;
          }
          .summary div {
            border: 1px solid #dbeafe;
            border-radius: 14px;
            background: white;
            padding: 14px;
            font-size: 13px;
            font-weight: 700;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            overflow: hidden;
            border-radius: 16px;
            background: white;
            box-shadow: 0 10px 30px rgba(18, 50, 82, 0.08);
          }
          th, td {
            border-bottom: 1px solid #e8f1fb;
            padding: 12px 10px;
            text-align: left;
            vertical-align: top;
            font-size: 12px;
          }
          th {
            background: #e7f4ff;
            color: #0753a6;
            font-size: 11px;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }
          tr:last-child td { border-bottom: 0; }
          .footer {
            margin-top: 22px;
            color: #64748b;
            font-size: 11px;
          }
          @media print {
            body { background: white; }
            .page { padding: 0; }
            .cover, table { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="cover">
            <div class="brand">Hennder CRM</div>
            <h1>${escapeReportHtml(report.title)}</h1>
            <p class="subtitle">${escapeReportHtml(report.subtitle)}</p>
          </section>
          <section class="summary">
            ${report.summary.map((item) => `<div>${escapeReportHtml(item)}</div>`).join("")}
            <div>Gerado em ${escapeReportHtml(new Date().toLocaleString("pt-BR"))}</div>
          </section>
          <table>
            <thead>
              <tr>${report.columns.map((column) => `<th>${escapeReportHtml(column)}</th>`).join("")}</tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p class="footer">Relatorio gerado pelo Hennder CRM - Inteligencia Comercial e Recompra.</p>
        </main>
        <script>
          window.addEventListener("load", () => {
            window.focus();
            window.print();
          });
        </script>
      </body>
    </html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function escapeReportHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function MeasuredChart({
  children,
}: {
  children: (size: { width: number; height: number }) => React.ReactNode;
}) {
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const update = () => {
      const width = Math.floor(container.clientWidth);
      const height = Math.floor(container.clientHeight);
      setSize(width > 0 && height > 0 ? { width, height } : null);
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    update();

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="h-full min-h-1 min-w-1">
      {size ? children(size) : <div className="h-full animate-pulse rounded-lg bg-slate-50" aria-hidden="true" />}
    </div>
  );
}

function getChartColors(theme: Theme) {
  const dark = theme === "dark";

  return {
    grid: dark ? "#2d2d31" : "#e2e8f0",
    text: dark ? "#a3a3a3" : "#64748b",
    tooltip: {
      backgroundColor: dark ? "#101012" : "#ffffff",
      borderColor: dark ? "#2f2f33" : "#dbeafe",
      borderRadius: 10,
      color: dark ? "#f8fafc" : "#0f172a",
    },
  };
}

function PaginationControls({
  page,
  pageSize = LIST_PAGE_SIZE,
  totalItems,
  itemLabel,
  onPageChange,
}: {
  page: number;
  pageSize?: number;
  totalItems: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  if (totalItems <= pageSize) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-4">
      <p className="text-sm text-slate-500">
        Exibindo {firstItem} a {lastItem} de {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Página anterior"
          title="Página anterior"
          className="grid size-10 place-items-center rounded-lg border border-blue-100 bg-white text-slate-600 transition hover:border-cyan-300 hover:text-[#0753a6] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="min-w-28 text-center text-sm font-semibold text-slate-700" aria-live="polite">
          Página {currentPage} de {totalPages}
        </span>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Próxima página"
          title="Próxima página"
          className="grid size-10 place-items-center rounded-lg border border-blue-100 bg-white text-slate-600 transition hover:border-cyan-300 hover:text-[#0753a6] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-100 bg-white/72 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center">
      <div className="min-w-0">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">{eyebrow}</p>
        <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-[#123252] sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      {action ?? (
        <div className="flex w-fit max-w-full items-center gap-2 rounded-lg border border-blue-100 bg-[#f5faff] px-3 py-2 text-sm font-medium text-[#0753a6]">
          <Activity size={16} className="text-cyan-600" />
          Dados sincronizados
        </div>
      )}
    </div>
  );
}

function Panel({
  title,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  icon: typeof Activity;
  action?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 rounded-xl border border-blue-100 bg-white p-4 shadow-[0_6px_18px_rgba(30,83,135,0.07)] sm:p-5">
      <div className="mb-4 flex flex-col gap-3 border-b border-blue-50 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#e7f4ff] text-[#0753a6]">
            <Icon size={18} />
          </div>
          <h2 className="min-w-0 break-words font-bold tracking-tight text-[#18334d]">{title}</h2>
        </div>
        {action ? (
          <span className="w-fit max-w-full rounded-md bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700">
            {action}
          </span>
        ) : (
          <MoreHorizontal size={18} className="text-slate-400" />
        )}
      </div>
      {children}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-blue-100 bg-white p-4 shadow-[0_6px_18px_rgba(30,83,135,0.07)]">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 break-words text-xl font-semibold tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  disabled = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex h-11 min-w-0 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 text-sm text-[#0753a6] focus-within:border-cyan-400 ${disabled ? "opacity-70" : ""}`}>
      <Filter size={15} className="shrink-0" />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent outline-none disabled:cursor-not-allowed"
      >
        {children}
      </select>
    </label>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: (typeof customers)[number]["activityStatus"];
  label: string;
}) {
  const styles = {
    ativo: "bg-emerald-50 text-emerald-700",
    atencao: "bg-blue-50 text-blue-700",
    risco: "bg-amber-50 text-amber-700",
    perdido: "bg-red-50 text-red-700",
  };
  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>{label}</span>;
}

function QualityBadge({
  status,
  score,
  suffix,
}: {
  status: (typeof customers)[number]["qualityStatus"];
  score: number;
  suffix?: string;
}) {
  const styles = {
    excelente: "bg-emerald-50 text-emerald-700",
    bom: "bg-blue-50 text-blue-700",
    regular: "bg-amber-50 text-amber-700",
    ruim: "bg-red-50 text-red-700",
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>
      {status} · {score}{suffix ? ` ${suffix}` : "%"}
    </span>
  );
}

function AlertAction({
  label,
  onClick,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="h-10 rounded-lg border border-blue-100 bg-white px-3 text-xs font-semibold text-[#0753a6] hover:border-cyan-400 hover:bg-cyan-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
  );
}

function RecoverySummary({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-20 rounded-lg border border-white/20 bg-white/12 px-3 py-2">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-[10px] leading-4 text-orange-50">{label}</p>
    </div>
  );
}

function RecoveryMetric({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone: "orange" | "red" | "blue" | "amber";
}) {
  const tones = {
    orange: "border-orange-200 bg-orange-50 text-orange-700",
    red: "border-red-200 bg-red-50 text-red-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <div className={`rounded-xl border p-4 shadow-sm ${tones[tone]}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="mt-1 text-sm font-medium opacity-80">{label}</p>
    </div>
  );
}

function Score({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-gradient-to-r from-[#0753a6] to-cyan-400" style={{ width: `${value}%` }} />
      </div>
      <span className="font-semibold text-slate-800">{value}</span>
    </div>
  );
}

function ModalFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
    >
      <button type="button" aria-label="Fechar modal" className="absolute inset-0 cursor-default" onClick={onClose} />
      <motion.section
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.24 }}
        className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-blue-50 pb-4">
          <h2 className="text-xl font-bold text-[#18334d]">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 text-slate-500 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>
        {children}
      </motion.section>
    </motion.div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number" | "date" | "time" | "email" | "password";
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400"
      />
    </label>
  );
}

function FormSelect({
  label,
  value,
  onChange,
  disabled = false,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400 disabled:opacity-65"
      >
        {children}
      </select>
    </label>
  );
}

function ModalActions({
  saving,
  error,
  onClose,
}: {
  saving: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-1 rounded-xl bg-white/95 px-1 pt-3 backdrop-blur">
      {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className="h-11 rounded-lg border border-blue-100 px-4 text-sm font-semibold text-slate-600">
          Cancelar
        </button>
        <button type="submit" disabled={saving} className="h-11 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </div>
  );
}

function agendaEventColor(type: CrmAgendaEvent["type"]) {
  return {
    Ligacao: "bg-emerald-500",
    Visita: "bg-blue-500",
    Retorno: "bg-amber-500",
    Recompra: "bg-teal-500",
  }[type];
}

function ContactOutcomeModal({
  customer,
  onClose,
  onSave,
  header,
  defaultResponsible = "Hennder CRM",
}: {
  customer: CustomerRow;
  onClose: () => void;
  onSave: (record: Omit<ContactRecord, "id">) => Promise<void>;
  header?: React.ReactNode;
  defaultResponsible?: string;
}) {
  const [outcome, setOutcome] = useState<ContactOutcome>("no_answer");
  const [note, setNote] = useState("");
  const [nextContact, setNextContact] = useState("");
  const [channel, setChannel] = useState<ContactChannel>("WhatsApp");
  const [responsible] = useState(defaultResponsible);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Fechar registro de contato"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <form
        className="relative z-10 w-full max-w-lg rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl"
        onSubmit={async (event) => {
          event.preventDefault();
          setSaving(true);
          setError("");
          try {
            await onSave({
              customerId: customer.id,
              customerName: customer.name,
              outcome,
              note,
              nextContact,
              contactedAt: new Date().toISOString(),
              channel,
              responsible,
            });
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Falha ao salvar.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-blue-50 pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-cyan-700">Pós-contato</p>
            <h2 className="mt-1 text-xl font-bold text-[#18334d]">Registrar retorno</h2>
            <p className="mt-1 text-sm text-slate-500">{customer.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 text-slate-500 hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        {header && <div className="mt-5">{header}</div>}

        <label className="mt-5 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Resultado do contato</span>
          <select
            value={outcome}
            onChange={(event) => setOutcome(event.target.value as ContactOutcome)}
            className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400"
          >
            {Object.entries(contactOutcomeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Observação</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ex.: cliente est? com estoque, pediu nova condição ou prefere contato pela manhã."
            className="mt-2 min-h-24 w-full resize-none rounded-lg border border-blue-100 bg-[#f8fbff] px-3 py-3 text-sm outline-none focus:border-cyan-400"
          />
        </label>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Canal</span>
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value as ContactChannel)}
              className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400"
            >
              <option value="WhatsApp">WhatsApp</option>
              <option value="Telefone">Telefone</option>
              <option value="Visita">Visita</option>
              <option value="Presencial">Presencial</option>
              <option value="Email">Email</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Responsável</span>
            <input
              value={responsible}
              readOnly
              required
              className="mt-2 h-11 w-full cursor-not-allowed rounded-lg border border-blue-100 bg-slate-100 px-3 text-sm text-slate-600 outline-none"
            />
          </label>
        </div>

        <div className="mt-4">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Atalhos de retorno</span>
          <div className="mt-2 grid grid-cols-5 gap-2">
            {[5, 7, 10, 15, 20].map((days) => {
              const date = addIsoDays(crmReferenceDate, days);
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => setNextContact(date)}
                  className={`h-10 rounded-lg border text-xs font-bold transition ${
                    nextContact === date
                      ? "border-[#0753a6] bg-[#0753a6] text-white"
                      : "border-blue-100 bg-[#f8fbff] text-[#0753a6] hover:border-cyan-400 hover:bg-cyan-50"
                  }`}
                >
                  +{days} dias
                </button>
              );
            })}
          </div>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Próximo contato</span>
          <input
            type="date"
            value={nextContact}
            onChange={(event) => setNextContact(event.target.value)}
            required={outcome === "follow_up"}
            min={crmReferenceDate}
            className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Obrigatório quando o cliente pedir contato em outro momento; opcional para tentativas sem resposta.
          </span>
        </label>

        <div className="mt-6 flex justify-end gap-2">
          {error && <p className="mr-auto self-center text-sm text-red-700">{error}</p>}
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-lg border border-blue-100 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex h-11 items-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white hover:bg-[#063d7c]"
          >
            <CheckCircle2 size={17} />
            {saving ? "Salvando..." : "Salvar retorno"}
          </button>
        </div>
      </form>
    </div>
  );
}

function formatContactDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeContactDateIso(value: string) {
  const rawValue = value.trim();
  const isoDate = rawValue.match(/^(\d{4})-(\d{2})-(\d{2})/u);
  if (isoDate) return isoDate[0];

  const brazilianDate = rawValue.match(/^(\d{2})\/(\d{2})\/(\d{4})/u);
  if (brazilianDate) {
    const [, day, month, year] = brazilianDate;
    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString().slice(0, 10);
}

const hiddenSellerMetricUsers = new Set([
  normalizeSellerMetricName("Administrador"),
  normalizeSellerMetricName("Hennder CRM"),
  normalizeSellerMetricName("FELLIPE DE FREITAS TEIXEIRA"),
]);

function normalizeSellerMetricName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleUpperCase("pt-BR");
}

function isHiddenSellerMetricUser(value: string) {
  return hiddenSellerMetricUsers.has(normalizeSellerMetricName(value));
}

function buildSellerCommercialMetrics(
  contactRecords: ContactRecord[],
  sales: SaleRow[],
  sellers: SellerRow[],
  todayIso: string,
) {
  const weekStartIso = addIsoDays(todayIso, -6);
  const monthPrefix = todayIso.slice(0, 7);
  const sellersById = new Map(sellers.map((seller) => [seller.id, seller.name]));
  const rows = new Map<string, {
    responsible: string;
    contactsToday: number;
    salesToday: number;
    salesWeek: number;
    salesMonth: number;
    monthRevenue: number;
    averageTicket: number;
  }>();

  function getRow(responsible: string) {
    const current = rows.get(responsible) ?? {
      responsible,
      contactsToday: 0,
      salesToday: 0,
      salesWeek: 0,
      salesMonth: 0,
      monthRevenue: 0,
      averageTicket: 0,
    };
    rows.set(responsible, current);
    return current;
  }

  for (const record of contactRecords) {
    const dateIso = normalizeContactDateIso(record.contactedAt);
    const responsible = record.responsible || "Sem responsavel";
    const current = getRow(responsible);
    if (dateIso === todayIso) current.contactsToday += 1;
  }

  for (const sale of sales) {
    const dateIso = normalizeContactDateIso(sale.soldAt);
    const responsible = sale.sellerId ? sellersById.get(sale.sellerId) ?? "Nao atribuido" : "Nao atribuido";
    const current = getRow(responsible);

    if (dateIso === todayIso) current.salesToday += 1;
    if (dateIso >= weekStartIso && dateIso <= todayIso) current.salesWeek += 1;
    if (dateIso.startsWith(monthPrefix)) {
      current.salesMonth += 1;
      current.monthRevenue += sale.totalValue;
    }
  }

  for (const row of rows.values()) {
    row.averageTicket = row.salesMonth ? row.monthRevenue / row.salesMonth : 0;
  }

  return [...rows.values()].sort(
    (left, right) =>
      right.monthRevenue - left.monthRevenue ||
      right.salesMonth - left.salesMonth ||
      right.salesWeek - left.salesWeek ||
      right.salesToday - left.salesToday ||
      right.contactsToday - left.contactsToday,
  );
}

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildDashboardKpis(customers: CustomerRow[]) {
  const activeCustomers = customers.filter((customer) => customer.activityStatus === "ativo").length;
  const attentionCustomers = customers.filter((customer) => customer.activityStatus === "atencao").length;
  const riskCustomers = customers.filter((customer) => customer.activityStatus === "risco").length;
  const lostCustomers = customers.filter((customer) => customer.activityStatus === "perdido").length;
  const potentialLost = customers.reduce((total, customer) => total + customer.potentialValue, 0);
  const averageQuality = customers.length
    ? Math.round(customers.reduce((total, customer) => total + customer.qualityScore, 0) / customers.length)
    : 0;

  return [
    { label: "Clientes ativos", value: String(activeCustomers), delta: "Ate 30 dias", icon: UsersRound },
    { label: "Em atencao", value: String(attentionCustomers), delta: "31 a 60 dias", icon: Clock3 },
    { label: "Em risco", value: String(riskCustomers), delta: "61 a 90 dias", icon: AlertTriangle },
    { label: "Clientes perdidos", value: String(lostCustomers), delta: "+90 dias", icon: Target },
    { label: "Potencial perdido", value: formatCurrency(potentialLost), delta: "Estimado", icon: CircleDollarSign },
    { label: "Qualidade da base", value: `${averageQuality}%`, delta: "Media", icon: ShieldCheck },
  ];
}

function buildRepurchaseTrendForSales(scopedSales: SaleRow[]) {
  const months = [
    ["01", "Jan"],
    ["02", "Fev"],
    ["03", "Mar"],
    ["04", "Abr"],
    ["05", "Mai"],
    ["06", "Jun"],
  ] as const;

  const saleCountByCustomer = new Map<string, number>();
  for (const sale of scopedSales) {
    saleCountByCustomer.set(
      sale.customerId,
      (saleCountByCustomer.get(sale.customerId) ?? 0) + 1,
    );
  }

  return months.map(([month, label]) => {
    const monthSales = scopedSales.filter((sale) => sale.soldAt.slice(5, 7) === month);
    const recurringCustomers = new Set(
      monthSales
        .map((sale) => sale.customerId)
        .filter((customerId) => (saleCountByCustomer.get(customerId) ?? 0) > 1),
    );

    return {
      mes: label,
      recompra: monthSales.length,
      recuperados: recurringCustomers.size,
    };
  });
}

function buildCategoryDataForItems(items: SaleItemRow[], products: ProductRow[]) {
  const productById = new Map(products.map((product) => [product.id, product]));
  const totals = new Map<string, number>();

  for (const item of items) {
    const department = item.productId ? productById.get(item.productId)?.department || "Outros" : "Outros";
    totals.set(department, (totals.get(department) ?? 0) + item.estimatedValue);
  }

  const colors = ["#16a34a", "#0f766e", "#f59e0b", "#2563eb"];
  const grandTotal = [...totals.values()].reduce((total, value) => total + value, 0) || 1;

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, value], index) => ({
      name,
      value: Math.round((value / grandTotal) * 100),
      color: colors[index],
    }));
}

function buildReportBars(customers: CustomerRow[], alerts: AlertRow[]) {
  return [
    { name: "Ativos", value: customers.filter((customer) => customer.activityStatus === "ativo").length },
    { name: "Atenção", value: customers.filter((customer) => customer.activityStatus === "atencao").length },
    { name: "Risco", value: customers.filter((customer) => customer.activityStatus === "risco").length },
    { name: "Perdidos", value: customers.filter((customer) => customer.activityStatus === "perdido").length },
    { name: "Alertas", value: alerts.length },
  ];
}

function capitalizePriority(value: AlertRow["priorityCode"]) {
  return {
    alta: "Alta",
    media: "Media",
    baixa: "Baixa",
  }[value];
}

type CommercialAiContext = {
  customers: CustomerRow[];
  alerts: AlertRow[];
  opportunities: CrmOpportunity[];
  agenda: CrmAgendaEvent[];
  contactRecords: ContactRecord[];
};

type CommercialAiIntent =
  | "greeting"
  | "help"
  | "contacts"
  | "risk"
  | "repurchase"
  | "seller"
  | "registration"
  | "opportunity"
  | "potential"
  | "knowledge";

const commercialAiKnowledgeBase: Array<{
  intent: CommercialAiIntent;
  menuLabel: string;
  keywords: string[];
}> = [
  {
    intent: "greeting",
    menuLabel: "Cumprimentos e boas-vindas",
    keywords: ["bom dia", "boa tarde", "boa noite", "ola", "oi", "e ai", "tudo bem"],
  },
  {
    intent: "help",
    menuLabel: "Menu do que a IA consegue analisar",
    keywords: ["ajuda", "menu", "opcoes", "o que voce faz", "o que consegue", "comandos"],
  },
  {
    intent: "contacts",
    menuLabel: "Clientes para ligar hoje",
    keywords: ["agenda", "hoje", "ligar", "contato", "retorno", "visita"],
  },
  {
    intent: "risk",
    menuLabel: "Clientes em risco ou parados",
    keywords: ["risco", "abandono", "pararam", "perdido", "sumiu", "sem comprar"],
  },
  {
    intent: "repurchase",
    menuLabel: "Produtos e alertas de recompra",
    keywords: ["produto", "produtos", "recompra", "comprar de novo", "recorrente", "recorrência"],
  },
  {
    intent: "seller",
    menuLabel: "Vendedor, carteira e responsavel",
    keywords: ["vendedor", "carteira", "time", "equipe", "responsavel"],
  },
  {
    intent: "registration",
    menuLabel: "WhatsApp, telefone e qualidade do cadastro",
    keywords: ["whatsapp", "cadastro", "telefone", "celular", "numero", "qualidade"],
  },
  {
    intent: "opportunity",
    menuLabel: "Oportunidades e chance de conversao",
    keywords: ["oportunidade", "venda cruzada", "cross", "sugestao", "oferecer", "conversao"],
  },
  {
    intent: "potential",
    menuLabel: "Potencial, receita e faturamento",
    keywords: ["potencial", "faturamento", "receita", "dinheiro", "valor"],
  },
  {
    intent: "knowledge",
    menuLabel: "Base Obsidian e treinamento do assistente",
    keywords: ["obsidian", "repositorio", "treinar", "treinamento", "base de conhecimento", "manual"],
  },
];

function buildCommercialAiInsights(context: CommercialAiContext) {
  const pendingAlerts = context.alerts.filter((alert) => alert.status === "pendente");
  const riskCustomers = context.customers.filter(
    (customer) => customer.activityStatus === "risco" || customer.activityStatus === "perdido",
  );
  const weakRegistration = context.customers.filter(
    (customer) => !customer.whatsapp || customer.qualityScore < 70,
  );
  const todayAgenda = context.agenda.filter((event) => event.date === crmReferenceDate);

  return [
    {
      label: "Prioridade de contato",
      value: pendingAlerts.length,
      badge: pendingAlerts.length ? "agir hoje" : "em dia",
      icon: Bell,
      tone: pendingAlerts.length ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Clientes em risco",
      value: riskCustomers.length,
      badge: riskCustomers.length ? "recuperar" : "ok",
      icon: AlertTriangle,
      tone: riskCustomers.length ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Cadastros para revisar",
      value: weakRegistration.length,
      badge: "qualidade",
      icon: ShieldCheck,
      tone: weakRegistration.length ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700",
    },
    {
      label: "Agenda de hoje",
      value: todayAgenda.length,
      badge: "rotina",
      icon: CalendarDays,
      tone: todayAgenda.length ? "bg-cyan-100 text-cyan-700" : "bg-slate-100 text-slate-600",
    },
  ];
}

function getCommercialAiAnswer(question: string, context: CommercialAiContext) {
  const normalized = normalizeAiText(question);
  const knowledge = findCommercialAiKnowledge(normalized);
  const customersById = new Map(context.customers.map((customer) => [customer.id, customer]));
  const pendingAlerts = context.alerts.filter((alert) => alert.status === "pendente");
  const priorityAlerts = [...pendingAlerts].sort(compareAlertPriority).slice(0, 5);
  const riskCustomers = [...context.customers]
    .filter((customer) => customer.activityStatus === "risco" || customer.activityStatus === "perdido")
    .sort((a, b) => b.potentialValue - a.potentialValue || b.days - a.days)
    .slice(0, 6);
  const weakRegistration = [...context.customers]
    .filter((customer) => !customer.whatsapp || customer.qualityScore < 70)
    .sort((a, b) => a.qualityScore - b.qualityScore)
    .slice(0, 6);
  const todayAgenda = context.agenda.filter((event) => event.date === crmReferenceDate);
  const sellerRanking = buildSellerAttentionRanking(context);
  const productRanking = buildProductRepurchaseRanking(context.alerts);
  const opportunityRanking = [...context.opportunities]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  if (knowledge?.intent === "greeting") {
    return [
      resolveCommercialAiGreeting(),
      "Sou a IA Comercial do Hennder CRM. Posso ajudar com clientes para ligar, risco de abandono, recompra, vendedores, cadastros fracos, potencial e oportunidades.",
      "",
      getCommercialAiMenuText(),
    ].join("\n");
  }

  if (knowledge?.intent === "help") {
    return getCommercialAiMenuText();
  }

  if (knowledge?.intent === "knowledge") {
    return [
      "O repositório Obsidian do Hennder CRM fica em obsidian/Hennder-CRM-Knowledge.",
      "",
      "Ele organiza regras comerciais, Hennder Sync, playbooks, perguntas da IA e pendências de automação. A ideia é manter esse material como fonte viva para o assistente consultar antes de sugerir ações.",
      "",
      "Mensagem automática de WhatsApp continua reservada para a etapa final, porque depende de automação e integração externa.",
    ].join("\n");
  }

  if (!context.customers.length && !context.alerts.length) {
    return [
      "Base comercial zerada no momento.",
      "",
      "Proximo movimento recomendado:",
      "1. Emitir o relatório mensal no PostgreSQL do ERP.",
      "2. Importar o CSV pelo importador temporario.",
      "3. Conferir clientes, vendas, itens, vendedores e alertas antes da apresentação.",
      "",
      "Depois da importação eu consigo priorizar contatos, sugerir recompra e apontar cadastros fracos automaticamente.",
    ].join("\n");
  }

  if (knowledge?.intent === "registration") {
    return [
      `Encontrei ${weakRegistration.length} cadastro(s) que merecem revisao no recorte atual.`,
      formatCustomerList(weakRegistration, (customer) => {
        const reasons = [
          !customer.whatsapp ? "sem WhatsApp valido" : undefined,
          customer.qualityScore < 70 ? `score ${customer.qualityScore}%` : undefined,
        ].filter(Boolean).join("; ");
        return `${customer.name}: ${reasons || "cadastro ok"}`;
      }),
      "Ação sugerida: antes de campanha em massa, valide celular/WhatsApp desses clientes para nao perder retorno por dado ruim.",
    ].join("\n");
  }

  if (knowledge?.intent === "seller") {
    return [
      "Leitura por vendedor, considerando clientes em risco, alertas pendentes e potencial perdido:",
      formatGenericList(sellerRanking.slice(0, 5).map((seller) => `${seller.name}: ${seller.score} pts, ${seller.riskCustomers} cliente(s) em risco, ${seller.pendingAlerts} alerta(s), ${formatCurrency(seller.potentialValue)} de potencial.`)),
      "Ação sugerida: comece pelo vendedor com maior pontuacao e distribua uma lista curta de contatos para hoje.",
    ].join("\n");
  }

  if (knowledge?.intent === "repurchase") {
    return [
      "Produtos com maior sinal de recompra agora:",
      formatGenericList(productRanking.map((product) => `${product.name}: ${product.count} alerta(s), prioridade ${product.priority}, ciclo medio ${product.days} dias.`)),
      "Ação sugerida: monte abordagem por produto, nao so por cliente. Isso ajuda o vendedor a falar direto do item que provavelmente acabou.",
    ].join("\n");
  }

  if (knowledge?.intent === "opportunity") {
    return [
      "Melhores oportunidades comerciais abertas:",
      formatGenericList(opportunityRanking.map((item) => `${item.customerName}: oferecer ${item.suggestedProductName} (${item.confidence}% de confianca). Motivo: ${item.reason}`)),
      "Ação sugerida: use oportunidade quando o cliente já estiver em contato por recompra. A conversa fica mais natural.",
    ].join("\n");
  }

  if (knowledge?.intent === "contacts") {
    const contactQueue = priorityAlerts
      .map((alert) => {
        const customer = customersById.get(alert.customerId);
        const channel = customer?.whatsapp ? "WhatsApp" : customer?.phone ? "telefone" : "atualizar cadastro";
        return `${alert.client}: ${alert.product}, ${alert.priority.toLowerCase()}, contato por ${channel}.`;
      });
    return [
      `Fila recomendada para hoje: ${contactQueue.length} contato(s) prioritario(s).`,
      formatGenericList(contactQueue),
      todayAgenda.length ? `Agenda já marcada: ${todayAgenda.map((event) => `${event.time} ${event.title}`).join("; ")}.` : "Agenda de hoje sem compromissos importados.",
      "Script curto: confirme se o produto esta acabando, ofereca reposicao e já atualize WhatsApp/celular se necessario.",
    ].join("\n");
  }

  if (knowledge?.intent === "risk") {
    return [
      `Clientes com maior risco de abandono: ${riskCustomers.length}.`,
      formatCustomerList(riskCustomers, (customer) => `${customer.name}: ${customer.days} dias sem compra, potencial ${customer.potential}, vendedor ${customer.preferredSeller}.`),
      "Ação sugerida: priorize quem tem maior potencial perdido e WhatsApp valido. Se nao houver WhatsApp, vira tarefa de saneamento cadastral.",
    ].join("\n");
  }

  if (knowledge?.intent === "potential") {
    const topPotential = [...context.customers]
      .sort((a, b) => b.potentialValue - a.potentialValue)
      .slice(0, 5);
    const totalPotential = topPotential.reduce((total, customer) => total + customer.potentialValue, 0);
    return [
      `Top potencial recuperável neste recorte: ${formatCurrency(totalPotential)} nos principais clientes.`,
      formatCustomerList(topPotential, (customer) => `${customer.name}: ${customer.potential}, ticket medio ${customer.ticket}, ${customer.days} dias sem compra.`),
      "Ação sugerida: use mensagem personalizada por histórico de compra, evitando campanha genérica.",
    ].join("\n");
  }

  return [
    "Não entendi.",
    "Consulte algumas opcoes no menu ao lado, onde esta escrito o que eu consigo trazer de informacao.",
    "",
    getCommercialAiMenuText(),
  ].join("\n");
}

function normalizeAiText(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findCommercialAiKnowledge(normalizedQuestion: string) {
  return commercialAiKnowledgeBase.find((entry) => hasAny(normalizedQuestion, entry.keywords));
}

function getCommercialAiMenuText() {
  const options = commercialAiKnowledgeBase
    .filter((entry) => entry.intent !== "greeting" && entry.intent !== "help")
    .map((entry, index) => `${index + 1}. ${entry.menuLabel}`)
    .join("\n");

  return `Posso ajudar com estas opcoes:\n${options}`;
}

function getCommercialAiWelcomeMessage() {
  return [
    resolveCommercialAiGreeting(),
    "Sou sua assistente comercial. Me pergunte quem ligar, onde tem oportunidade ou qual cliente merece atencao hoje.",
  ].join("\n");
}

function resolveCommercialAiGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia! Como posso ajudar sua operacao comercial hoje?";
  if (hour < 18) return "Boa tarde! Vamos encontrar as melhores oportunidades comerciais?";
  return "Boa noite! Posso resumir prioridades, riscos e oportunidades para voce.";
}

function hasAny(value: string, terms: string[]) {
  return terms.some((term) => value.includes(normalizeAiText(term)));
}

function compareAlertPriority(a: AlertRow, b: AlertRow) {
  const priorityWeight = { alta: 3, media: 2, baixa: 1 } as const;
  return (
    priorityWeight[b.priorityCode] - priorityWeight[a.priorityCode]
    || a.recommendedIso.localeCompare(b.recommendedIso)
  );
}

function buildSellerAttentionRanking(context: CommercialAiContext) {
  const scopedSellerIds = new Set(
    context.customers.flatMap((customer) => customer.preferredSellerId ? [customer.preferredSellerId] : []),
  );
  const scopedSellerNames = new Set(context.alerts.map((alert) => alert.seller));
  const scopedSellers = sellers.filter(
    (seller) => scopedSellerIds.has(seller.id) || scopedSellerNames.has(seller.name),
  );

  return scopedSellers
    .map((seller) => {
      const sellerCustomers = context.customers.filter((customer) => customer.preferredSellerId === seller.id);
      const riskCustomers = sellerCustomers.filter(
        (customer) => customer.activityStatus === "risco" || customer.activityStatus === "perdido",
      ).length;
      const pendingAlerts = context.alerts.filter(
        (alert) => alert.status === "pendente" && alert.seller === seller.name,
      ).length;
      const potentialValue = sellerCustomers.reduce((total, customer) => total + customer.potentialValue, 0);
      return {
        name: seller.name,
        riskCustomers,
        pendingAlerts,
        potentialValue,
        score: riskCustomers * 4 + pendingAlerts * 3 + Math.round(potentialValue / 500),
      };
    })
    .sort((a, b) => b.score - a.score || b.potentialValue - a.potentialValue);
}

function buildProductRepurchaseRanking(alerts: AlertRow[]) {
  const products = new Map<string, { name: string; count: number; priorityScore: number; daysTotal: number }>();
  const priorityWeight = { alta: 3, media: 2, baixa: 1 } as const;

  for (const alert of alerts.filter((item) => item.status === "pendente")) {
    const current = products.get(alert.product) ?? { name: alert.product, count: 0, priorityScore: 0, daysTotal: 0 };
    current.count += 1;
    current.priorityScore += priorityWeight[alert.priorityCode];
    current.daysTotal += Number.parseInt(alert.days, 10) || 0;
    products.set(alert.product, current);
  }

  return [...products.values()]
    .map((product) => ({
      name: product.name,
      count: product.count,
      priority: Math.round(product.priorityScore / product.count * 10) / 10,
      days: product.count ? Math.round(product.daysTotal / product.count) : 0,
    }))
    .sort((a, b) => b.priority - a.priority || b.count - a.count)
    .slice(0, 5);
}

function formatCustomerList(customers: CustomerRow[], formatter: (customer: CustomerRow) => string) {
  if (!customers.length) return "Nenhum cliente encontrado para esse criterio.";
  return formatGenericList(customers.map(formatter));
}

function formatGenericList(items: string[]) {
  if (!items.length) return "Nenhum item encontrado para esse criterio.";
  return items.map((item, index) => `${index + 1}. ${item}`).join("\n");
}
function WhatsAppButton({
  customer,
  message,
  user,
  sellerName,
  repurchaseProduct,
  campaign,
  onUpdateContact,
  onRegisterContact,
  onContactIntent,
  compact = false,
}: {
  customer: CustomerRow;
  message?: string;
  user?: CrmSessionUser;
  sellerName?: string;
  repurchaseProduct?: string;
  campaign?: ProductCampaign;
  onUpdateContact?: (
    customer: CustomerRow,
    phone: string,
    options?: CustomerContactUpdateOptions,
  ) => Promise<void>;
  onRegisterContact?: (record: Omit<ContactRecord, "id">) => Promise<void>;
  onContactIntent?: (customer: CustomerRow) => void;
  compact?: boolean;
}) {
  const [editingContact, setEditingContact] = useState(false);
  const responsibleName = resolveWhatsAppResponsibleName(user, customer, sellerName);
  const sellerFirstName = firstName(responsibleName);
  const resolvedMessage = campaign
    ? resolveCampaignWhatsAppMessage(campaign.messageTemplate, sellerFirstName, customer.name, repurchaseProduct)
    : repurchaseProduct
    ? buildShoppingRuralRepurchaseMessage(sellerFirstName, repurchaseProduct)
    : resolvePersonalizedWhatsAppMessage(
        user?.whatsAppMessage || message || buildShoppingRuralWhatsAppMessage("{vendedor}"),
        sellerFirstName,
        customer.name,
      );
  const hasCampaignImage = Boolean(campaign?.imageDataUrl);
  const phone = normalizeBrazilianWhatsAppNumber(customer.whatsapp);

  if (!phone) {
    return (
      <>
        <button
          type="button"
          onClick={() => setEditingContact(true)}
          aria-label={`Atualizar WhatsApp de ${customer.name}`}
          title="Atualizar WhatsApp"
          className={`inline-flex items-center justify-center gap-2 rounded-lg bg-amber-100 font-semibold text-amber-800 shadow-sm transition hover:bg-amber-200 ${
            compact ? "h-10 w-10" : "h-11 px-4 text-sm"
          }`}
        >
          <Pencil size={compact ? 17 : 16} />
          {!compact && <span>Atualizar WhatsApp</span>}
        </button>
        {editingContact && onUpdateContact && (
          <CustomerContactModal
            customer={customer}
            onClose={() => setEditingContact(false)}
            onSave={async (phoneValue) => {
              await onUpdateContact(customer, phoneValue, { retryWhatsApp: true });
              setEditingContact(false);
            }}
          />
        )}
      </>
    );
  }

  const href = `https://wa.me/${phone}?text=${encodeURIComponent(resolvedMessage)}`;

  return (
    <span className="inline-flex items-center gap-1">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (campaign?.imageDataUrl) downloadCampaignImage(campaign);
          onContactIntent?.(customer);
          recordAutomaticContactIntent(
            customer,
            resolvedMessage,
            responsibleName,
            user ? resolveContactSellerId(user, customer) : customer.preferredSellerId,
            onRegisterContact,
          );
        }}
        aria-label={`Chamar ${customer.name} no WhatsApp`}
        title={campaign ? `Chamar com campanha ${campaign.name}` : `Chamar ${customer.name} no WhatsApp`}
        className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#25d366] font-semibold text-white shadow-sm transition hover:bg-[#1ebe5d] focus-visible:outline-[#25d366] ${
          compact ? "h-10 w-10" : "h-11 px-4 text-sm"
        }`}
      >
        <MessageCircle size={compact ? 18 : 17} />
        {!compact && <span>{campaign ? "Campanha WhatsApp" : "Chamar no WhatsApp"}</span>}
      </a>
      {hasCampaignImage && (
        <button
          type="button"
          onClick={() => campaign && downloadCampaignImage(campaign)}
          aria-label={`Baixar arte da campanha ${campaign?.name ?? ""}`}
          title="Baixar arte da campanha"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-100 bg-emerald-50 text-emerald-700 transition hover:bg-emerald-100"
        >
          <Download size={15} />
        </button>
      )}
      {onUpdateContact && (
        <button
          type="button"
          onClick={() => setEditingContact(true)}
          aria-label={`Trocar WhatsApp de ${customer.name}`}
          title="Trocar WhatsApp"
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-100 bg-white text-[#0753a6] transition hover:border-cyan-400 hover:bg-cyan-50"
        >
          <Pencil size={15} />
        </button>
      )}
      {editingContact && onUpdateContact && (
        <CustomerContactModal
          customer={customer}
          onClose={() => setEditingContact(false)}
          onSave={async (phoneValue) => {
            await onUpdateContact(customer, phoneValue, { retryWhatsApp: true });
            setEditingContact(false);
          }}
        />
      )}
    </span>
  );
}

function recordAutomaticContactIntent(
  customer: CustomerRow,
  message: string,
  responsibleName: string,
  sellerId?: string,
  onRegisterContact?: (record: Omit<ContactRecord, "id">) => Promise<void>,
) {
  const storageKey = automaticContactIntentStorageKey(customer.id);
  try {
    if (window.localStorage.getItem(storageKey)) return;
    window.localStorage.setItem(storageKey, new Date().toISOString());
  } catch {
    // Silently continue; losing the local guard should not block the commercial action.
  }

  const record = {
    customerId: customer.id,
    customerName: customer.name,
    outcome: "no_answer",
    note: `Registro automático: clique no WhatsApp. Mensagem sugerida: ${message}`,
    nextContact: addDaysIso(new Date(), AUTOMATIC_CONTACT_FOLLOW_UP_DAYS),
    contactedAt: new Date().toISOString(),
    channel: "WhatsApp",
    responsible: responsibleName || customer.preferredSeller || "Hennder CRM",
    sellerId,
  } satisfies Omit<ContactRecord, "id">;

  if (onRegisterContact) {
    void onRegisterContact(record).catch(() => undefined);
    return;
  }

  void mutateWorkspace<ContactRecord>({
    action: "create_contact",
    record,
  }).catch(() => undefined);
}

function automaticContactIntentStorageKey(customerId: string) {
  const today = new Date().toISOString().slice(0, 10);
  return `hennder-crm-contact-intent:${customerId}:${today}:whatsapp`;
}

function isAutomaticContactRecord(record: ContactRecord) {
  return record.note.trim().toLocaleLowerCase("pt-BR").startsWith("registro autom");
}

function isContactFromToday(value: string) {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  if (value.slice(0, 10) === todayIso) return true;
  return value === new Intl.DateTimeFormat("pt-BR").format(now);
}

function clearAutomaticContactIntent(customerId: string) {
  try {
    window.localStorage.removeItem(automaticContactIntentStorageKey(customerId));
  } catch {
    // The retry still works on the server when local storage is unavailable.
  }
}

function resolveWhatsAppResponsibleName(
  user: CrmSessionUser | undefined,
  customer: CustomerRow,
  sellerName?: string,
) {
  return (
    (user?.role === "vendedor" ? resolveSellerForUser(user.sellerId)?.name : undefined) ||
    user?.name ||
    sellerName ||
    customer.preferredSeller ||
    "Hennder CRM"
  ).trim();
}

function resolveContactSellerId(
  user: CrmSessionUser,
  customer: CustomerRow,
) {
  return (
    (user.sellerId ? resolveSellerForUser(user.sellerId)?.id : undefined) ??
    customer.preferredSellerId
  );
}

function firstName(value: string) {
  const name = value.trim().split(/\s+/u)[0] || "vendedor";
  const lowerName = name.toLocaleLowerCase("pt-BR");
  if (name === name.toLocaleUpperCase("pt-BR") || name === lowerName) {
    return lowerName.replace(/^./u, (letter) => letter.toLocaleUpperCase("pt-BR"));
  }
  return name;
}

function buildShoppingRuralWhatsAppMessage(sellerName: string) {
  return DEFAULT_WHATSAPP_MESSAGE_TEMPLATE.replaceAll("{vendedor}", sellerName);
}

function resolvePersonalizedWhatsAppMessage(
  template: string,
  sellerName: string,
  customerName: string,
) {
  return template
    .replaceAll("{saudacao}", resolveWhatsAppGreeting())
    .replaceAll("{vendedor}", sellerName)
    .replaceAll("{cliente}", firstName(customerName));
}

function resolveCampaignWhatsAppMessage(
  template: string,
  sellerName: string,
  customerName: string,
  productName?: string,
) {
  return resolvePersonalizedWhatsAppMessage(template, sellerName, customerName)
    .replaceAll("{produto}", productName ? formatWhatsAppProductName(productName) : "");
}

function downloadCampaignImage(campaign: ProductCampaign) {
  if (!campaign.imageDataUrl) return;
  const link = document.createElement("a");
  link.href = campaign.imageDataUrl;
  link.download = campaign.imageName || `${safeFileName(campaign.name)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function safeFileName(value: string) {
  return normalizeManualAlertSearch(value)
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "") || "campanha";
}

function addDaysIso(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate.toISOString().slice(0, 10);
}

function buildShoppingRuralRepurchaseMessage(
  sellerName: string,
  productName: string,
) {
  const product = formatWhatsAppProductName(productName);
  return [
    `${resolveWhatsAppGreeting()}! Tudo bem? Aqui é o ${sellerName} do Shopping Rural 🤠.`,
    "",
    `Passei aqui porque lembrei de você e do item ${product} que levou conosco.`,
    "Como o período de recompra já chegou, queria saber se está precisando dele novamente.",
    "Fico à disposição para te atender.",
  ].join("\n");
}

function formatWhatsAppProductName(value: string) {
  const normalized = value.trim().toLocaleLowerCase("pt-BR");
  return normalized.replace(/^./u, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function alertOverdueDays(expectedDate: string, referenceDate: string) {
  const expected = Date.parse(`${expectedDate}T12:00:00Z`);
  const reference = Date.parse(`${referenceDate}T12:00:00Z`);
  if (!Number.isFinite(expected) || !Number.isFinite(reference)) return 0;
  return Math.max(0, Math.round((reference - expected) / 86_400_000));
}

function parseRepurchaseDays(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function CustomerContactModal({
  customer,
  onClose,
  onSave,
}: {
  customer: CustomerRow;
  onClose: () => void;
  onSave: (phone: string) => Promise<void>;
}) {
  const [phone, setPhone] = useState(customer.whatsapp || customer.phone || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  return (
    <ModalFrame title="Atualizar WhatsApp" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
          if (!normalizeBrazilianWhatsAppNumber(phone)) {
            setError("Informe um WhatsApp valido com DDD. Exemplo: (33) 99999-9999.");
            return;
          }

          setSaving(true);
          try {
            await onSave(phone);
          } catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "Falha ao atualizar WhatsApp.");
          } finally {
            setSaving(false);
          }
        }}
      >
        <div className="rounded-lg border border-blue-100 bg-[#f8fbff] p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Cliente</p>
          <p className="mt-1 font-semibold text-[#123252]">{customer.name}</p>
          <p className="mt-1 text-xs text-slate-500">Atualize quando estiver sem WhatsApp ou quando o numero estiver errado.</p>
        </div>
        <FormInput label="WhatsApp com DDD" value={phone} onChange={setPhone} />
        <ModalActions saving={saving} error={error} onClose={onClose} />
      </form>
    </ModalFrame>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-[#f1f8ff] px-3 py-1.5 text-xs font-semibold text-[#0753a6]">{children}</span>;
}

function ChatBubble({ role, text }: { role: "user" | "ai"; text: string }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[82%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
        role === "user"
          ? "rounded-br-sm bg-[#0753a6] text-white"
          : "rounded-bl-sm border border-blue-100 bg-white text-slate-700"
      }`}>
        {text}
      </div>
    </div>
  );
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-cyan-300/70 bg-gradient-to-br from-[#041d40] via-[#06356c] to-[#0753a6] text-white shadow-lg shadow-blue-950/20">
        <span className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-cyan-300/25 blur-sm" />
        <span className="absolute bottom-2 left-2 right-2 h-1 rounded-full bg-cyan-300" />
        <span className="relative z-10 text-2xl font-black leading-none tracking-tight drop-shadow-sm">H</span>
      </div>
      <div>
        <p className={`font-semibold ${compact ? "text-slate-950" : "text-white"}`}>Hennder CRM</p>
        <p className={`text-xs ${compact ? "text-slate-500" : "text-emerald-50/60"}`}>Inteligência Comercial e Recompra</p>
      </div>
    </div>
  );
}


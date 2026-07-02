"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Bot,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Clock3,
  Database,
  Filter,
  Download,
  FileText,
  LineChart,
  LogIn,
  LogOut,
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
  Sun,
  Target,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { motion } from "framer-motion";
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
import { useEffect, useRef, useState } from "react";
import { normalizeBrazilianWhatsAppNumber } from "@/domain/crm/rules";
import type {
  CrmAgendaEvent,
  ContactChannel,
  ContactOutcome,
  CrmContactRecord,
  CrmOpportunity,
  CrmSessionUser,
  CrmUserRole,
  CrmWorkspace,
  RepurchaseAlertStatus,
} from "@/domain/crm/types";
import {
  crmReferenceDate,
  crmViewModel,
  type AlertViewModel,
  type CustomerViewModel,
  formatCurrency,
} from "@/services/crm-view-service";

type View =
  | "dashboard"
  | "resultados"
  | "clientes"
  | "vendas"
  | "produtos"
  | "perfil"
  | "recuperacao"
  | "recompra"
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
type QuickAction = "manual-alert" | "manual-customer" | "opportunity" | "agenda" | "contact";
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
};

const contactOutcomeLabels: Record<ContactOutcome, string> = {
  not_interested: "Cliente não quis",
  follow_up: "Pediu contato mais tarde",
  no_answer: "Não respondeu",
  interested: "Demonstrou interesse",
  invalid_number: "Número inválido",
};

const {
  snapshot,
  kpis: serviceKpis,
  customers,
  alerts,
  reportBars,
  repurchaseTrend,
  categoryData,
} = crmViewModel;
const { sellers, sales, saleItems, dashboard } = snapshot;
const kpiIcons = [UsersRound, Clock3, AlertTriangle, Target, CircleDollarSign, ShieldCheck];
const kpis = serviceKpis.map((kpi, index) => ({ ...kpi, icon: kpiIcons[index] }));

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
      { id: "vendas", label: "Vendas", description: "Vendas importadas, itens e rastreabilidade do ERP.", icon: ShoppingBag },
      { id: "produtos", label: "Produtos", description: "Produtos, recompra ativa e potencial recorrente.", icon: ClipboardList },
      { id: "recompra", label: "Alertas", description: "Acompanhe clientes no momento ideal de recompra.", icon: Bell },
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
      { id: "campanhas", label: "Campanhas", description: "Ações comerciais em lote e públicos de recompra.", icon: Sparkles },
      { id: "ia", label: "IA Comercial", description: "Receba análises e recomendações para vender melhor.", icon: Bot },
      { id: "relatorios", label: "Relatórios", description: "Analise resultados, recuperação e recorrência.", icon: PieChart },
    ],
  },
  {
    title: "Sistema",
    items: [
      { id: "motor-recompra", label: "Motor de Recompra", description: "Regras por produto, departamento e palavra-chave.", icon: SlidersHorizontal },
      { id: "sincronizacao", label: "Sincronização", description: "Saúde da integração, logs e reprocessamentos.", icon: RefreshCcw },
      { id: "configuracoes", label: "Configurações", description: "Usuários, permissões, empresa e parâmetros.", icon: Settings },
    ],
  },
];

const sellerAllowedViews: View[] = ["dashboard", "clientes", "recompra", "agenda", "carteira", "atividades", "ia"];
const supervisorBlockedViews: View[] = ["configuracoes"];
export default function Home() {
  const [user, setUser] = useState<CrmSessionUser | null>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [activeView, setActiveView] = useState<View>("dashboard");
  const [selectedCustomer, setSelectedCustomer] = useState(customers[0]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [contactRecords, setContactRecords] = useState<ContactRecord[]>([]);
  const [alertStatuses, setAlertStatuses] = useState<Record<string, RepurchaseAlertStatus>>({});
  const [agendaItems, setAgendaItems] = useState<CrmAgendaEvent[]>(snapshot.agenda);
  const [opportunityItems, setOpportunityItems] = useState<CrmOpportunity[]>(snapshot.opportunities);
  const [theme, setTheme] = useState<Theme>("light");
  const [manualCustomers, setManualCustomers] = useState<CustomerRow[]>([]);
  const [manualAlerts, setManualAlerts] = useState<AlertRow[]>([]);
  const [quickAction, setQuickAction] = useState<QuickAction | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const appCustomers = [...manualCustomers, ...customers];
  const appAlerts = [...manualAlerts, ...alerts];

  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { user: CrmSessionUser | null }) => {
        setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
        setUser(result.user);
      })
      .finally(() => setAuthChecking(false));
  }, []);

  useEffect(() => {
    if (!user) return;
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
      });
  }, [user]);

  if (authChecking) {
    return <SystemLoadingScreen label="Carregando sessao comercial" detail="Preparando dashboard, alertas e carteira de clientes." />;
  }


  if (!user) {
    return (
      <LoginScreen
        onLogin={async (email, password) => {
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
          setUser(result.user);
        }}
      />
    );
  }

  const openProfile = (customer: CustomerRow) => {
    setSelectedCustomer(customer);
    setActiveView("perfil");
    setMobileOpen(false);
  };

  const registerContact = async (record: Omit<ContactRecord, "id">) => {
    const saved = await mutateWorkspace<ContactRecord>({
      action: "create_contact",
      record,
    });
    setContactRecords((current) => [saved, ...current]);
  };

  const updateAlertStatus = async (id: string, status: RepurchaseAlertStatus) => {
    await mutateWorkspace({ action: "update_alert", id, status });
    setAlertStatuses((current) => ({ ...current, [id]: status }));
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

  const changeTheme = (nextTheme: Theme) => {
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("henndercrm-theme", nextTheme);
    localStorage.removeItem("agrocrm-theme");
  };

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
            onThemeChange={changeTheme}
            user={user}
            onQuickAction={setQuickAction}
            onLogout={async () => {
              setIsSigningOut(true);
              await new Promise((resolve) => window.setTimeout(resolve, 650));
              await fetch("/api/auth/session", { method: "DELETE" });
              setUser(null);
              setActiveView("dashboard");
              setIsSigningOut(false);
            }}
          />
          <motion.div
            key={activeView}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32 }}
            className="mx-auto w-full max-w-[1560px] px-3 py-4 sm:px-5 lg:px-6"
          >
            {activeView === "dashboard" && (
              <Dashboard
                customers={appCustomers}
                openProfile={openProfile}
                contactRecords={contactRecords}
                openRecovery={() => setActiveView("recuperacao")}
                theme={theme}
              />
            )}
            {activeView === "resultados" && (
              <CrmResults
                customers={appCustomers}
                alerts={appAlerts}
                opportunities={opportunityItems}
                contactRecords={contactRecords}
              />
            )}
            {activeView === "clientes" && <Customers customers={appCustomers} openProfile={openProfile} />}
            {activeView === "vendas" && <SalesModule customers={appCustomers} />}
            {activeView === "produtos" && <ProductsModule customers={appCustomers} alerts={appAlerts} />}
            {activeView === "recuperacao" && (
              <RecoveryCustomers
                customers={appCustomers}
                openProfile={openProfile}
                contactRecords={contactRecords}
                onRegisterContact={registerContact}
              />
            )}
            {activeView === "perfil" && (
              <CustomerProfile
                alerts={appAlerts}
                customer={selectedCustomer}
                contactRecords={contactRecords.filter((record) => record.customerId === selectedCustomer.id)}
              />
            )}
            {activeView === "recompra" && (
              <RepurchaseAlerts
                alerts={appAlerts}
                customers={appCustomers}
                alertStatuses={alertStatuses}
                onStatusChange={updateAlertStatus}
              />
            )}
            {activeView === "carteira" && <SellerPortfolio customers={appCustomers} alerts={appAlerts} openProfile={openProfile} />}
            {activeView === "vendedores" && <SellersModule customers={appCustomers} alerts={appAlerts} />}
            {activeView === "saude" && <DataHealth customers={appCustomers} openProfile={openProfile} />}
            {activeView === "atividades" && <ActivitiesModule contactRecords={contactRecords} />}
            {activeView === "campanhas" && <CampaignsModule customers={appCustomers} alerts={appAlerts} />}
            {activeView === "oportunidades" && (
              <Opportunities
                items={opportunityItems}
                user={user}
                onSave={saveOpportunity}
                onDelete={deleteOpportunity}
              />
            )}
            {activeView === "agenda" && (
              <Agenda
                items={agendaItems}
                user={user}
                onSave={saveAgendaEvent}
                onDelete={deleteAgendaEvent}
              />
            )}
            {activeView === "ia" && (
              <CommercialAi
                customers={appCustomers}
                alerts={appAlerts}
                opportunities={opportunityItems}
                agenda={agendaItems}
                contactRecords={contactRecords}
              />
            )}
            {activeView === "motor-recompra" && <RepurchaseEngineModule alerts={appAlerts} />}
            {activeView === "sincronizacao" && <SyncModule />}
            {activeView === "configuracoes" && <SettingsModule user={user} sellers={sellers} />}
            {activeView === "relatorios" && (
              <Reports
                theme={theme}
                customers={appCustomers}
                alerts={appAlerts}
                opportunities={opportunityItems}
                contactRecords={contactRecords}
              />
            )}
          </motion.div>
        </section>
      </div>
      <QuickActionModals
        action={quickAction}
        user={user}
        customers={appCustomers}
        onClose={() => setQuickAction(null)}
        onGoTo={(view) => setActiveView(view)}
        onCreateCustomer={(customer) => {
          setManualCustomers((current) => [customer, ...current]);
          setSelectedCustomer(customer);
          setActiveView("perfil");
        }}
        onCreateAlert={(alert) => {
          setManualAlerts((current) => [alert, ...current]);
          setActiveView("recompra");
        }}
        onCreateAgenda={saveAgendaEvent}
        onCreateOpportunity={saveOpportunity}
        onCreateContact={registerContact}
      />
      {isSigningOut && <SystemExitOverlay />}
    </main>
  );
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

function SystemLoadingScreen({
  label,
  detail,
}: {
  label: string;
  detail: string;
}) {
  return (
    <main className="crm-loading-screen flex min-h-screen items-center justify-center overflow-hidden bg-[#02040a] px-6 text-white">
      <div className="crm-loading-orb crm-loading-orb-a" />
      <div className="crm-loading-orb crm-loading-orb-b" />
      <motion.div
        initial={{ opacity: 0, y: 18, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45 }}
        className="relative z-10 w-full max-w-md rounded-3xl border border-cyan-300/18 bg-white/8 p-8 text-center shadow-2xl shadow-cyan-950/30 backdrop-blur-xl"
      >
        <LogoMark />
        <div className="crm-loader-grid mx-auto mt-8">
          {Array.from({ length: 9 }).map((_, index) => (
            <span key={index} style={{ animationDelay: `${index * 0.08}s` }} />
          ))}
        </div>
        <h1 className="mt-8 text-2xl font-bold">{label}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">{detail}</p>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="crm-loading-progress h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-blue-400" />
        </div>
      </motion.div>
    </main>
  );
}

function SystemExitOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/86 px-6 text-white backdrop-blur-md"
    >
      <motion.div
        initial={{ y: 16, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        className="rounded-3xl border border-cyan-300/20 bg-white/8 p-8 text-center shadow-2xl"
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400 text-[#06356c]">
          <LogOut size={24} />
        </div>
        <p className="mt-5 text-lg font-bold">Encerrando sessao</p>
        <p className="mt-2 text-sm text-slate-300">Salvando contexto comercial e fechando acesso com seguranca.</p>
        <div className="mx-auto mt-6 h-1.5 w-64 overflow-hidden rounded-full bg-white/10">
          <div className="crm-loading-progress h-full rounded-full bg-gradient-to-r from-cyan-300 to-emerald-300" />
        </div>
      </motion.div>
    </motion.div>
  );
}

function LoginLoadingOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/62 px-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ y: 16, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        className="rounded-3xl border border-emerald-300/20 bg-white/10 p-7 text-center shadow-2xl"
      >
        <div className="crm-login-pulse mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-300 text-emerald-950">
          <ShieldCheck size={27} />
        </div>
        <p className="mt-5 text-lg font-bold text-white">Validando acesso</p>
        <p className="mt-2 max-w-xs text-sm leading-6 text-emerald-50/75">
          Carregando permissoes, carteira comercial e operacao do dia.
        </p>
      </motion.div>
    </motion.div>
  );
}

function QuickActionModals({
  action,
  user,
  customers,
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
  onClose: () => void;
  onGoTo: (view: View) => void;
  onCreateCustomer: (customer: CustomerRow) => void;
  onCreateAlert: (alert: AlertRow) => void;
  onCreateAgenda: (event: Omit<CrmAgendaEvent, "id">) => Promise<void>;
  onCreateOpportunity: (opportunity: Omit<CrmOpportunity, "id">) => Promise<void>;
  onCreateContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  if (!action) return null;

  if (action === "manual-customer") {
    return (
      <ManualCustomerModal
        onClose={onClose}
        onSave={(customer) => {
          onCreateCustomer(customer);
          onClose();
        }}
      />
    );
  }

  if (action === "manual-alert") {
    return (
      <ManualAlertModal
        customers={customers}
        user={user}
        onClose={onClose}
        onSave={(alert) => {
          onCreateAlert(alert);
          onClose();
        }}
      />
    );
  }

  if (action === "opportunity") {
    return (
      <OpportunityModal
        user={user}
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
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (customer: CustomerRow) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Manhuacu");
  const [category, setCategory] = useState("Cliente manual");
  const [sellerId, setSellerId] = useState(sellers[0]?.id ?? "");
  const [cycleDays, setCycleDays] = useState("45");

  return (
    <ModalFrame title="Cadastrar cliente manual" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const seller = sellers.find((item) => item.id === sellerId);
          const normalized = normalizeBrazilianWhatsAppNumber(phone);
          const qualityScore = normalized ? 70 : 45;
          onSave({
            id: `manual-customer-${Date.now()}`,
            uniplusId: Date.now(),
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
            status: "Atencao",
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
            preferredSeller: seller?.name ?? "Sem preferencia",
            preferredSellerId: seller?.id,
            sellerAffinity: seller ? 100 : 0,
            qualityScore,
            qualityStatus: qualityScore >= 70 ? "bom" : "regular",
            purchaseCycleDays: Number(cycleDays) || 45,
            totalPurchases: 0,
            totalPurchased: formatCurrency(0),
          });
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
          <FormSelect label="Vendedor responsavel" value={sellerId} onChange={setSellerId}>
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </FormSelect>
        </div>
        <p className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs leading-5 text-cyan-800">
          Cadastro operacional de sessao. A fonte oficial do cliente continuara sendo o ERP quando o Sync Agent estiver ativo.
        </p>
        <ModalActions saving={false} error="" onClose={onClose} />
      </form>
    </ModalFrame>
  );
}

function ManualAlertModal({
  customers,
  user,
  onClose,
  onSave,
}: {
  customers: CustomerRow[];
  user: CrmSessionUser;
  onClose: () => void;
  onSave: (alert: AlertRow) => void;
}) {
  const defaultCustomer = customers[0];
  const defaultSeller = sellers.find((seller) => seller.id === user.sellerId) ?? sellers[0];
  const [customerId, setCustomerId] = useState(defaultCustomer?.id ?? "");
  const [product, setProduct] = useState("Racao premium 15kg");
  const [days, setDays] = useState("45");
  const [recommendedIso, setRecommendedIso] = useState(addIsoDays(crmReferenceDate, 7));
  const [priority, setPriority] = useState<AlertRow["priorityCode"]>("alta");
  const [sellerId, setSellerId] = useState(defaultSeller?.id ?? "");

  return (
    <ModalFrame title="Cadastrar alerta manual" onClose={onClose}>
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          const customer = customers.find((item) => item.id === customerId);
          const seller = sellers.find((item) => item.id === sellerId);
          if (!customer) return;
          onSave({
            id: `manual-alert-${Date.now()}`,
            customerId: customer.id,
            product,
            client: customer.name,
            buyDate: customer.lastBuy,
            buyDateIso: customer.lastBuyIso,
            days: `${Number(days) || 45} dias`,
            recommended: formatContactDate(recommendedIso),
            recommendedIso,
            priority: capitalizePriority(priority),
            priorityCode: priority,
            seller: seller?.name ?? customer.preferredSeller,
            department: "Manual",
            status: "pendente",
            origin: "manual",
          });
        }}
      >
        <FormSelect label="Cliente" value={customerId} onChange={setCustomerId}>
          {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
        </FormSelect>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormInput label="Produto / motivo" value={product} onChange={setProduct} />
          <FormInput label="Recorrencia em dias" value={days} onChange={setDays} type="number" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <FormInput label="Data do alerta" value={recommendedIso} onChange={setRecommendedIso} type="date" />
          <FormSelect label="Prioridade" value={priority} onChange={(value) => setPriority(value as AlertRow["priorityCode"])}>
            <option value="alta">Alta</option>
            <option value="media">Media</option>
            <option value="baixa">Baixa</option>
          </FormSelect>
          <FormSelect label="Responsavel" value={sellerId} onChange={setSellerId} disabled={user.role === "vendedor"}>
            {sellers.map((seller) => <option key={seller.id} value={seller.id}>{seller.name}</option>)}
          </FormSelect>
        </div>
        <ModalActions saving={false} error="" onClose={onClose} />
      </form>
    </ModalFrame>
  );
}

function QuickContactModal({
  customers,
  onClose,
  onSave,
}: {
  customers: CustomerRow[];
  onClose: () => void;
  onSave: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const customer = customers.find((item) => item.id === customerId) ?? customers[0];

  if (!customer) return null;

  return (
    <ContactOutcomeModal
      customer={customer}
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

  return (
    <main className="min-h-screen overflow-hidden bg-[#0d1211] text-white">
      {submitting && <LoginLoadingOverlay />}
      <div className="grid min-h-screen lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex items-center px-6 py-10 sm:px-10 lg:px-16">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <LogoMark />
            <h1 className="mt-10 text-4xl font-semibold leading-tight sm:text-5xl">
              Hennder CRM
            </h1>
            <p className="mt-4 text-lg leading-8 text-emerald-50/72">
              Inteligência Comercial e Recompra
            </p>
            <form
              className="mt-10 space-y-4"
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
              <label className="block">
                <span className="text-sm font-medium text-emerald-50/80">Email</span>
                <input
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  required
                  className="mt-2 h-12 w-full rounded-lg border border-white/12 bg-white/8 px-4 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:bg-white/12"
                />
              </label>
              <label className="block">
                <span className="text-sm font-medium text-emerald-50/80">Senha</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  required
                  className="mt-2 h-12 w-full rounded-lg border border-white/12 bg-white/8 px-4 text-sm text-white outline-none transition focus:border-emerald-300/70 focus:bg-white/12"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 text-sm font-semibold text-emerald-950 shadow-[0_24px_60px_rgba(52,211,153,0.24)] transition hover:bg-emerald-300"
              >
                {submitting ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-950/25 border-t-emerald-950" />
                ) : (
                  <LogIn size={18} />
                )}
                {submitting ? "Entrando..." : "Entrar"}
                <ChevronRight size={17} className="transition group-hover:translate-x-0.5" />
              </button>
              {error && (
                <p className="rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                  {error}
                </p>
              )}
            </form>
            {!isProduction && (
            <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-300">
              <p className="font-semibold text-white">Acessos de demonstração</p>
              <p>Administrador: admin@henndercrm.local / Admin@123</p>
              <p>Supervisor: supervisor@henndercrm.local / Supervisor@123</p>
              <p>Vendedor: vendedor@henndercrm.local / Vendedor@123</p>
            </div>
            )}
          </motion.div>
        </section>
        <section className="relative hidden items-center justify-center p-10 lg:flex">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_42%_32%,rgba(16,185,129,0.28),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(59,130,246,0.18),transparent_28%)]" />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, rotateX: 8 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ delay: 0.12, duration: 0.5 }}
            className="relative w-full max-w-3xl rounded-2xl border border-white/14 bg-white/10 p-4 shadow-2xl backdrop-blur-xl"
          >
            <div className="rounded-xl bg-slate-950/92 p-5">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-emerald-300">Live CRM</p>
                  <h2 className="mt-2 text-2xl font-semibold">Painel executivo</h2>
                </div>
                <div className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-xs text-emerald-200">
                  IA ativa
                </div>
              </div>
              <DashboardPreview />
            </div>
          </motion.div>
        </section>
      </div>
    </main>
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

  return (
    <>
      {mobileOpen && <button className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden" onClick={() => setMobileOpen(false)} />}
      <aside
        data-open={mobileOpen}
        style={{ left: mobileOpen ? 0 : -288, transform: "none" }}
        className="crm-sidebar fixed inset-y-0 z-40 w-64 overflow-hidden border-r border-white/10 bg-[#083d80] px-3 py-4 text-white shadow-2xl shadow-blue-950/25 lg:sticky lg:shadow-none"
      >
        <div className="flex items-center justify-between">
          <LogoMark compact />
          <button
            type="button"
            aria-label="Fechar menu"
            className="rounded-md p-2 text-blue-100 lg:hidden"
            onClick={() => setMobileOpen(false)}
          >
            <X size={20} />
          </button>
        </div>
        <nav className="mt-7 space-y-5 overflow-y-auto pr-1">
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
        <div className="mt-8 rounded-xl border border-cyan-300/25 bg-white/10 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-400 text-[#06356c]">
            <Sparkles size={18} />
          </div>
          <p className="mt-3 text-sm font-semibold text-white">Motor de recompra</p>
          <p className="mt-1 text-xs leading-5 text-blue-100">
            {alerts.length} alertas priorizados pelas regras comerciais.
          </p>
        </div>
      </aside>
    </>
  );
}

function Topbar({
  onMenu,
  theme,
  onThemeChange,
  user,
  onQuickAction,
  onLogout,
}: {
  onMenu: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  user: CrmSessionUser;
  onQuickAction: (action: QuickAction) => void;
  onLogout: () => Promise<void>;
}) {
  const ThemeIcon = theme === "dark" ? Moon : Sun;
  const [actionOpen, setActionOpen] = useState(false);
  const quickActionRef = useRef<HTMLDivElement>(null);
  const quickActions: Array<{
    id: QuickAction;
    label: string;
    description: string;
    icon: typeof Plus;
  }> = [
    { id: "manual-alert", label: "Cadastrar alerta manual", description: "Criar lembrete de recompra para um cliente.", icon: Bell },
    { id: "manual-customer", label: "Cadastrar cliente manual", description: "Adicionar cliente operacional durante a sessao.", icon: UsersRound },
    { id: "opportunity", label: "Nova oportunidade", description: "Registrar venda cruzada ou sugestao comercial.", icon: Target },
    { id: "agenda", label: "Novo compromisso", description: "Agendar ligacao, visita, retorno ou recompra.", icon: CalendarDays },
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
          <div className="hidden h-10 w-[340px] items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-sm text-blue-50 md:flex">
            <Search size={17} />
            Buscar cliente, produto ou alerta
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="crm-theme-picker flex h-10 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-2 text-white transition hover:bg-white/15">
            <ThemeIcon size={17} className="shrink-0" />
            <span className="sr-only">Selecionar tema</span>
            <select
              aria-label="Selecionar tema"
              value={theme}
              onChange={(event) => onThemeChange(event.target.value as Theme)}
              className="max-w-24 bg-transparent text-xs font-semibold text-white outline-none sm:max-w-none sm:text-sm"
            >
              <option value="light">Claro</option>
              <option value="dark">Dark profundo</option>
            </select>
          </label>
          <div ref={quickActionRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => setActionOpen((current) => !current)}
              className="flex h-10 items-center gap-2 rounded-lg border border-white/20 bg-white px-3 text-sm font-semibold text-[#0753a6] shadow-sm transition hover:bg-cyan-50"
            >
              <Plus size={17} />
              Nova ação
              <ChevronRight size={15} className={`transition ${actionOpen ? "rotate-90" : ""}`} />
            </button>
            {actionOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="absolute right-0 top-12 z-40 w-80 overflow-hidden rounded-xl border border-blue-100 bg-white p-2 text-slate-900 shadow-2xl"
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
                      className="flex w-full gap-3 rounded-lg px-3 py-3 text-left transition hover:bg-cyan-50"
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
          <button
            type="button"
            aria-label="Abrir notificações"
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-white/10 text-white"
          >
            <Bell size={18} />
          </button>
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
  alerts,
  opportunities,
  contactRecords,
}: {
  customers: CustomerRow[];
  alerts: AlertRow[];
  opportunities: CrmOpportunity[];
  contactRecords: ContactRecord[];
}) {
  const contactedCustomerIds = new Set(contactRecords.map((record) => record.customerId));
  const recoveredCustomerIds = new Set(
    contactRecords
      .filter((record) => record.outcome === "interested" || record.outcome === "follow_up")
      .map((record) => record.customerId),
  );
  const recoveredCustomers = customers.filter((customer) => recoveredCustomerIds.has(customer.id));
  const influencedCustomers = customers.filter(
    (customer) => contactedCustomerIds.has(customer.id) || alerts.some((alert) => alert.customerId === customer.id),
  );
  const recoveredRevenue = recoveredCustomers.reduce((total, customer) => total + customer.ticketValue, 0);
  const influencedRevenue = influencedCustomers.reduce((total, customer) => total + customer.potentialValue, 0);
  const convertedAlerts = alerts.filter((alert) => alert.status === "convertido");
  const conversionRate = contactRecords.length
    ? Math.round((recoveredCustomerIds.size / contactRecords.length) * 100)
    : 0;
  const roi = recoveredRevenue ? Math.max(1, Math.round(recoveredRevenue / 350)) : 0;
  const sellerRanking = buildSellerAttentionRanking({ customers, alerts, opportunities, agenda: [], contactRecords })
    .slice(0, 5);

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Resultados" title="Resultados do CRM" description="Impacto financeiro, conversões e recuperação gerada pela operação comercial." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Faturamento recuperado" value={formatCurrency(recoveredRevenue)} />
        <MetricCard label="Faturamento influenciado" value={formatCurrency(influencedRevenue)} />
        <MetricCard label="Clientes recuperados" value={`${recoveredCustomers.length}`} />
        <MetricCard label="ROI estimado" value={`${roi}x`} />
        <MetricCard label="Alertas convertidos" value={`${convertedAlerts.length}`} />
        <MetricCard label="Taxa de conversão" value={`${conversionRate}%`} />
        <MetricCard label="Ticket médio recuperado" value={formatCurrency(recoveredCustomers.length ? recoveredRevenue / recoveredCustomers.length : 0)} />
        <MetricCard label="Oportunidades abertas" value={`${opportunities.filter((item) => item.status === "aberta").length}`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
        <Panel title="Evolução mensal recuperada" icon={LineChart}>
          <div className="h-80">
            <MeasuredChart>
              {({ width, height }) => (
                <AreaChart width={width} height={height} data={repurchaseTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="mes" tickLine={false} axisLine={false} />
                  <YAxis tickLine={false} axisLine={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="recuperados" stroke="#0753a6" fill="#bfdbfe" strokeWidth={3} />
                </AreaChart>
              )}
            </MeasuredChart>
          </div>
        </Panel>
        <Panel title="Ranking por recuperação" icon={UsersRound}>
          <div className="space-y-3">
            {sellerRanking.map((seller, index) => (
              <div key={seller.name} className="flex items-center justify-between rounded-lg border border-blue-50 bg-[#f8fbff] p-3">
                <div>
                  <p className="font-bold text-[#123252]">{index + 1}. {seller.name}</p>
                  <p className="text-xs text-slate-500">{seller.riskCustomers} clientes em risco · {seller.pendingAlerts} alertas</p>
                </div>
                <span className="font-black text-[#0753a6]">{formatCurrency(seller.potentialValue)}</span>
              </div>
            ))}
            {!sellerRanking.length && <EmptyState text="Sem vendedores vinculados aos dados atuais." />}
          </div>
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Top clientes recuperados" icon={CheckCircle2}>
          <SimpleRows rows={recoveredCustomers.slice(0, 6).map((customer) => [customer.name, customer.ticket, customer.preferredSeller])} empty="Nenhum cliente recuperado registrado ainda." />
        </Panel>
        <Panel title="Top produtos de recompra" icon={ShoppingBag}>
          <SimpleRows rows={buildProductRepurchaseRanking(alerts).map((item) => [item.name, `${item.count} alertas`, `${item.days} dias`])} empty="Nenhum produto com alerta pendente." />
        </Panel>
      </div>
    </div>
  );
}

function SalesModule({ customers }: { customers: CustomerRow[] }) {
  const [selectedSaleId, setSelectedSaleId] = useState(sales[0]?.id ?? "");
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const itemsBySale = new Map<string, typeof saleItems>();
  for (const item of saleItems) {
    const current = itemsBySale.get(item.saleId) ?? [];
    current.push(item);
    itemsBySale.set(item.saleId, current);
  }
  const selectedSale = sales.find((sale) => sale.id === selectedSaleId) ?? sales[0];
  const selectedItems = selectedSale ? itemsBySale.get(selectedSale.id) ?? [] : [];

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Comercial" title="Vendas" description="Conferência das vendas importadas do ERP, respeitando uma venda para vários itens." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Vendas importadas" value={`${sales.length}`} />
        <MetricCard label="Itens importados" value={`${saleItems.length}`} />
        <MetricCard label="Ticket médio" value={formatCurrency(sales.length ? sales.reduce((total, sale) => total + sale.totalValue, 0) / sales.length : 0)} />
        <MetricCard label="Vinculadas a alertas" value={`${snapshot.alerts.filter((alert) => sales.some((sale) => sale.id === alert.saleId)).length}`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Listagem de vendas" icon={ShoppingBag} action={`${sales.length} registros únicos`}>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
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
                {sales.map((sale) => {
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
            {!sales.length && <EmptyState text="Nenhuma venda importada no momento." />}
          </div>
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
                rows={selectedItems.map((item) => [item.productName, `${item.quantity} un.`, formatCurrency(item.estimatedValue)])}
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

function ProductsModule({ customers, alerts }: { customers: CustomerRow[]; alerts: AlertRow[] }) {
  const salesById = new Map(sales.map((sale) => [sale.id, sale]));
  const productStats = snapshot.products.map((product) => {
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
        <MetricCard label="Produtos" value={`${snapshot.products.length}`} />
        <MetricCard label="Usam CRM" value={`${snapshot.products.filter((product) => product.usesCrm).length}`} />
        <MetricCard label="Recompra ativa" value={`${snapshot.products.filter((product) => product.repurchaseActive).length}`} />
        <MetricCard label="Com alertas" value={`${new Set(alerts.map((alert) => alert.product)).size}`} />
      </div>
      <Panel title="Catálogo comercial" icon={ClipboardList} action={`${productStats.length} produtos`}>
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

function ActivitiesModule({ contactRecords }: { contactRecords: ContactRecord[] }) {
  const outcomes = contactRecords.reduce<Record<string, number>>((acc, record) => {
    acc[record.outcome] = (acc[record.outcome] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Inteligência" title="Atividades" description="Histórico de contatos, retornos, observações e ações feitas pela equipe." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Atividades" value={`${contactRecords.length}`} />
        <MetricCard label="Interessados" value={`${outcomes.interested ?? 0}`} />
        <MetricCard label="Retornos" value={`${outcomes.follow_up ?? 0}`} />
        <MetricCard label="Sem resposta" value={`${outcomes.no_answer ?? 0}`} />
      </div>
      <Panel title="Histórico de contatos" icon={Phone}>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2">Canal</th>
                <th className="px-3 py-2">Resultado</th>
                <th className="px-3 py-2">Responsável</th>
                <th className="px-3 py-2">Data</th>
                <th className="px-3 py-2">Observação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-blue-50">
              {contactRecords.map((record) => (
                <tr key={record.id} className="hover:bg-cyan-50/60">
                  <td className="px-3 py-3 font-semibold text-[#123252]">{record.customerName}</td>
                  <td className="px-3 py-3">{record.channel}</td>
                  <td className="px-3 py-3">{contactOutcomeLabels[record.outcome]}</td>
                  <td className="px-3 py-3">{record.responsible}</td>
                  <td className="px-3 py-3">{formatContactDate(record.contactedAt)}</td>
                  <td className="px-3 py-3">{record.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!contactRecords.length && <EmptyState text="Nenhuma atividade registrada ainda." />}
        </div>
      </Panel>
    </div>
  );
}

function CampaignsModule({ customers, alerts }: { customers: CustomerRow[]; alerts: AlertRow[] }) {
  const campaigns = [
    {
      name: "Clientes sem compra há 60 dias",
      audience: customers.filter((customer) => customer.days >= 60).length,
      period: "Mensal",
      status: "Planejada",
      result: "Aguardando disparo",
    },
    {
      name: "Recompra de produtos recorrentes",
      audience: new Set(alerts.map((alert) => alert.customerId)).size,
      period: "Semanal",
      status: "Ativa",
      result: `${alerts.filter((alert) => alert.status === "convertido").length} conversões`,
    },
    {
      name: "Atualização cadastral",
      audience: customers.filter((customer) => !customer.whatsapp || customer.qualityScore < 70).length,
      period: "Pontual",
      status: "Sugestão",
      result: "Qualificar WhatsApp e cidade",
    },
    {
      name: "Grande chance de conversão",
      audience: customers.filter((customer) => customer.score >= 75).length,
      period: "Quinzenal",
      status: "Planejada",
      result: "Abordagem consultiva",
    },
  ];

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Inteligência" title="Campanhas" description="Estrutura inicial para ações comerciais em lote com público, período e resultado." />
      <Panel title="Campanhas comerciais" icon={Sparkles} action={`${campaigns.length} modelos`}>
        <div className="grid gap-4 xl:grid-cols-2">
          {campaigns.map((campaign) => (
            <div key={campaign.name} className="rounded-xl border border-blue-100 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-black text-[#123252]">{campaign.name}</p>
                  <p className="mt-1 text-sm text-slate-500">Público-alvo: {campaign.audience} cliente(s)</p>
                </div>
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700">{campaign.status}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <MiniStat label="Período" value={campaign.period} />
                <MiniStat label="Resultado" value={campaign.result} />
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function RepurchaseEngineModule({ alerts }: { alerts: AlertRow[] }) {
  const activeProducts = snapshot.products.filter((product) => product.repurchaseActive);
  const departments = [...new Set(activeProducts.map((product) => product.department || "Sem departamento"))];
  const manualRules = alerts.filter((alert) => alert.origin === "manual");

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Sistema" title="Motor de Recompra" description="Visualização das regras que alimentam alertas por produto, departamento e comportamento." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Regras por produto" value={`${activeProducts.length}`} />
        <MetricCard label="Departamentos" value={`${departments.length}`} />
        <MetricCard label="Regras manuais" value={`${manualRules.length}`} />
        <MetricCard label="Alertas gerados" value={`${alerts.length}`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="Regras por produto" icon={SlidersHorizontal}>
          <SimpleRows
            rows={activeProducts.slice(0, 12).map((product) => [
              product.name,
              product.department || "Sem departamento",
              `${product.defaultRepurchaseDays ?? 45} dias`,
            ])}
            empty="Nenhuma regra de produto ativa."
          />
        </Panel>
        <Panel title="Regras complementares" icon={Database}>
          <SimpleRows
            rows={[
              ["Palavra-chave", "ração, vermífugo, vacina", "Ativa"],
              ["Departamento", departments.slice(0, 3).join(", ") || "Sem dados", "Ativa"],
              ["Histórico do cliente", "Média de recompra observada", "Ativa"],
              ["Manual cliente/produto", `${manualRules.length} regra(s)`, "Operacional"],
            ]}
            empty="Sem regras complementares."
          />
        </Panel>
      </div>
    </div>
  );
}

function SyncModule() {
  const ignoredSales = Math.max(0, snapshot.sales.length - sales.length);
  const syncRows = [
    ["Última sincronização", "Demonstração local"],
    ["Status", "Pronta para importação manual"],
    ["Total lidos", `${snapshot.sales.length + ignoredSales}`],
    ["Total importados", `${sales.length}`],
    ["Total atualizados", `${customers.length + snapshot.products.length + sellers.length}`],
    ["Total ignorados", `${ignoredSales}`],
  ];

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Sistema" title="Sincronização" description="Saúde da integração, histórico, idempotência e reprocessamento seguro." />
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Status" value="OK" />
        <MetricCard label="Vendas" value={`${sales.length}`} />
        <MetricCard label="Itens" value={`${saleItems.length}`} />
        <MetricCard label="Produtos" value={`${snapshot.products.length}`} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Resumo da integração" icon={RefreshCcw}>
          <SimpleRows rows={syncRows} empty="Sem sincronização registrada." />
        </Panel>
        <Panel title="Reprocessamento seguro" icon={Database}>
          <div className="space-y-3 text-sm leading-6 text-slate-600">
            {[
              "UPSERT por uniplus_id para prevenir duplicidade.",
              "Uma venda por uniplus_venda_id e vários itens por uniplus_item_id.",
              "Janela de segurança para reler períodos recentes.",
              "Log de vendas ignoradas com motivo e payload de auditoria.",
              "Reprocessar período ou venda sem apagar histórico comercial.",
            ].map((item) => (
              <div key={item} className="rounded-lg border border-blue-50 bg-[#f8fbff] px-3 py-2">{item}</div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function SettingsModule({
  user,
  sellers,
}: {
  user: CrmSessionUser;
  sellers: typeof snapshot.sellers;
}) {
  const settings = [
    ["Usuários", "Perfis de administrador, supervisor e vendedor."],
    ["Permissões", "Estrutura preparada para ocultar menus por perfil."],
    ["Empresa", "Parâmetros comerciais e preferências do sistema."],
    ["Atribuição", "Janela e regras para reconhecer conversões do CRM."],
    ["Integração", "Configurações futuras do Sync Agent local."],
    ["Preferências", "Tema, notificações e comportamento operacional."],
  ];

  return (
    <div className="space-y-5">
      <UserManagementPanel user={user} sellers={sellers} />
      <PageTitle eyebrow="Sistema" title="Configurações" description="Parâmetros operacionais, usuários, permissões e integração." />
      <Panel title="Central de configurações" icon={Settings}>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {settings.map(([title, description]) => (
            <div key={title} className="rounded-xl border border-blue-100 bg-[#f8fbff] p-4">
              <p className="font-black text-[#123252]">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function UserManagementPanel({
  user,
  sellers,
}: {
  user: CrmSessionUser;
  sellers: typeof snapshot.sellers;
}) {
  const [managedUsers, setManagedUsers] = useState<ManagedCrmUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<CrmUserRole>("vendedor");
  const [sellerId, setSellerId] = useState(sellers[0]?.id ?? "");
  const [loadingUsers, setLoadingUsers] = useState(user.role === "administrador");
  const [savingUser, setSavingUser] = useState(false);
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
        if (!response.ok) throw new Error(result.error ?? "Falha ao carregar usuarios.");
        if (active) setManagedUsers(result.users ?? []);
      })
      .catch((error) => {
        if (active) setUserError(error instanceof Error ? error.message : "Falha ao carregar usuarios.");
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
      if (!response.ok || !result.user) throw new Error(result.error ?? "Falha ao cadastrar usuario.");

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
      setUserError(error instanceof Error ? error.message : "Falha ao cadastrar usuario.");
    } finally {
      setSavingUser(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
      <Panel title="Cadastrar usuario" icon={UsersRound} action={user.role === "administrador" ? "Supabase Auth" : "Acesso restrito"}>
        {user.role !== "administrador" ? (
          <EmptyState text="Somente administradores podem cadastrar usuarios." />
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
                className="flex h-11 items-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Plus size={17} />
                {savingUser ? "Cadastrando..." : "Cadastrar usuario"}
              </button>
            </div>
          </form>
        )}
      </Panel>

      <Panel title="Usuarios ativos" icon={ShieldCheck} action={loadingUsers ? "Carregando" : `${managedUsers.length} usuarios`}>
        {user.role !== "administrador" ? (
          <EmptyState text="Lista disponivel apenas para administradores." />
        ) : managedUsers.length === 0 ? (
          <EmptyState text={loadingUsers ? "Carregando usuarios..." : "Nenhum usuario cadastrado."} />
        ) : (
          <div className="space-y-2">
            {managedUsers.map((managedUser) => {
              const seller = sellers.find((item) => item.id === managedUser.sellerId);
              return (
                <div key={managedUser.id} className="rounded-lg border border-blue-50 bg-[#f8fbff] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-bold text-[#123252]">{managedUser.name}</p>
                      <p className="mt-1 text-sm text-slate-500">{managedUser.email}</p>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-xs font-bold uppercase text-cyan-700">
                      {managedUser.role}
                    </span>
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
        <div key={`${row.join("-")}-${index}`} className="grid gap-2 rounded-lg border border-blue-50 bg-[#f8fbff] p-3 text-sm text-slate-600 md:grid-cols-3">
          {row.map((cell, cellIndex) => (
            <span key={`${cell}-${cellIndex}`} className={cellIndex === 0 ? "font-bold text-[#123252]" : ""}>
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
  openRecovery,
  theme,
}: {
  customers: CustomerRow[];
  openProfile: (customer: CustomerRow) => void;
  contactRecords: ContactRecord[];
  openRecovery: () => void;
  theme: Theme;
}) {
  const chartColors = getChartColors(theme);
  const inactiveCustomers = [...customers]
    .filter((customer) => customer.activityStatus !== "ativo")
    .sort((a, b) => b.days - a.days);

  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="Visão executiva"
        title="Dashboard comercial inteligente"
        description="Priorize recuperação, recompra e venda cruzada com dados acionáveis."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((kpi, index) => (
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
          {inactiveCustomers.slice(0, 3).map((customer) => {
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
                <AreaChart width={width} height={height} data={repurchaseTrend}>
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
          <div className="h-80">
            <MeasuredChart>
              {({ width, height }) => (
                <RePieChart width={width} height={height}>
                  <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={96} paddingAngle={4}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={chartColors.tooltip} />
                </RePieChart>
              )}
            </MeasuredChart>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {categoryData.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-sm text-slate-600">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                {item.name}
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel title="Clientes para contatar hoje" icon={Phone} action="Ranking de prioridade">
        <div className="grid gap-3">
          {customers.slice(0, 4).map((customer, index) => (
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
                  message={`Olá! Aqui é da Hennder CRM. Identificamos uma oportunidade de recompra e gostaríamos de conversar com você.`}
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
      <Panel title="Ranking de vendedores" icon={UsersRound} action="Por potencial da carteira">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {sellers.map((seller, index) => (
            <div key={seller.id} className="rounded-xl border border-blue-100 bg-[#f8fbff] p-4">
              <div className="flex items-center justify-between">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0753a6] text-sm font-bold text-white">
                  {index + 1}
                </span>
                <span className="text-xs font-semibold text-emerald-700">{seller.conversionRate}% conversão</span>
              </div>
              <p className="mt-4 font-bold text-slate-900">{seller.name}</p>
              <p className="mt-1 text-xs text-slate-500">{seller.customerCount} clientes · {seller.openAlertCount} alertas</p>
              <p className="mt-3 text-lg font-bold text-orange-700">{formatCurrency(seller.potentialValue)}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function RecoveryCustomers({
  customers,
  openProfile,
  contactRecords,
  onRegisterContact,
}: {
  customers: CustomerRow[];
  openProfile: (customer: CustomerRow) => void;
  contactRecords: ContactRecord[];
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  const [contactCustomer, setContactCustomer] = useState<CustomerRow | null>(null);
  const inactiveCustomers = [...customers]
    .filter((customer) => customer.activityStatus !== "ativo")
    .sort((a, b) => b.days - a.days);

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
        <RecoveryMetric value={`${contactRecords.length}`} label="Contatos registrados" tone="blue" />
        <RecoveryMetric
          value={`${contactRecords.filter((record) => record.nextContact).length}`}
          label="Retornos agendados"
          tone="amber"
        />
      </div>

      <Panel title="Fila de recuperação" icon={AlertTriangle} action="Ordenada por dias sem compra">
        <div className="mb-4 flex flex-wrap gap-2">
          {["Todos", "30 a 60 dias", "60 a 90 dias", "+90 dias", "Sem retorno"].map((filter, index) => (
            <button
              key={filter}
              type="button"
              className={`rounded-lg px-3 py-2 text-sm font-medium ${
                index === 0
                  ? "bg-orange-600 text-white"
                  : "border border-orange-100 bg-white text-slate-600 hover:border-orange-300"
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {inactiveCustomers.map((customer) => {
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
                    message="Olá! Aqui é da Hennder CRM. Sentimos sua falta e gostaríamos de ajudar com sua próxima compra. Podemos conversar?"
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
                    className="h-11 rounded-lg bg-[#0753a6] px-3 text-sm font-semibold text-white hover:bg-[#063d7c]"
                  >
                    {latestContact ? "Atualizar retorno" : "Registrar retorno"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </Panel>

      <Panel title="Histórico de contatos" icon={MessageCircle} action={`${contactRecords.length} registros`}>
        {contactRecords.length === 0 ? (
          <div className="rounded-lg border border-dashed border-blue-200 bg-[#f8fbff] px-4 py-8 text-center">
            <p className="text-sm font-semibold text-slate-700">Nenhum contato registrado ainda</p>
            <p className="mt-1 text-xs text-slate-500">Os resultados informados pela equipe aparecerão aqui.</p>
          </div>
        ) : (
          <div className="grid gap-2">
            {contactRecords.map((record) => (
              <div
                key={record.id}
                className="grid gap-2 rounded-lg border border-blue-100 bg-[#f8fbff] px-4 py-3 md:grid-cols-[1.2fr_1fr_0.8fr_1.5fr]"
              >
                <Metric label="Cliente" value={record.customerName} />
                <Metric label="Resultado" value={contactOutcomeLabels[record.outcome]} />
                <Metric label="Contato" value={record.contactedAt} />
                <Metric
                  label={record.nextContact ? "Próximo contato" : "Observação"}
                  value={record.nextContact ? formatContactDate(record.nextContact) : record.note || "Sem observação"}
                />
              </div>
            ))}
          </div>
        )}
      </Panel>

      {contactCustomer && (
        <ContactOutcomeModal
          customer={contactCustomer}
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

function Customers({
  customers,
  openProfile,
}: {
  customers: CustomerRow[];
  openProfile: (customer: CustomerRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [sellerFilter, setSellerFilter] = useState("todos");
  const [cityFilter, setCityFilter] = useState("todas");
  const [qualityFilter, setQualityFilter] = useState("todas");
  const cities = [...new Set(customers.map((customer) => customer.city))].sort();
  const sellerNames = [...new Set(customers.map((customer) => customer.preferredSeller))].sort();
  const filtered = customers.filter((customer) => {
    const matchesQuery =
      customer.name.toLowerCase().includes(query.toLowerCase()) ||
      customer.city.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "todos" || customer.activityStatus === statusFilter;
    const matchesSeller = sellerFilter === "todos" || customer.preferredSeller === sellerFilter;
    const matchesCity = cityFilter === "todas" || customer.city === cityFilter;
    const matchesQuality = qualityFilter === "todas" || customer.qualityStatus === qualityFilter;
    return matchesQuery && matchesStatus && matchesSeller && matchesCity && matchesQuality;
  });

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Base comercial" title="Clientes" description="Carteira segmentada por risco, vendedor e qualidade cadastral." />
      <Panel title="Carteira de clientes" icon={UsersRound} action={`${filtered.length} de ${customers.length} clientes`}>
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-[1.2fr_repeat(4,0.7fr)]">
          <div className="flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-[#f8fbff] px-3 focus-within:border-cyan-400">
            <Search size={17} className="text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome ou cidade" className="w-full bg-transparent text-sm outline-none" />
          </div>
          <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter}>
            <option value="todos">Todos os status</option>
            <option value="ativo">Ativos</option>
            <option value="atencao">Atenção</option>
            <option value="risco">Em risco</option>
            <option value="perdido">Perdidos</option>
          </FilterSelect>
          <FilterSelect label="Vendedor" value={sellerFilter} onChange={setSellerFilter}>
            <option value="todos">Todos vendedores</option>
            {sellerNames.map((seller) => <option key={seller} value={seller}>{seller}</option>)}
          </FilterSelect>
          <FilterSelect label="Cidade" value={cityFilter} onChange={setCityFilter}>
            <option value="todas">Todas as cidades</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </FilterSelect>
          <FilterSelect label="Qualidade" value={qualityFilter} onChange={setQualityFilter}>
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
              {filtered.map((customer) => (
                <tr key={customer.name} className="bg-[#f8fbff] shadow-sm transition hover:bg-white hover:shadow-md">
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
                      <WhatsAppButton customer={customer} compact />
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
      </Panel>
    </div>
  );
}

function CustomerProfile({
  alerts,
  customer,
  contactRecords,
}: {
  alerts: AlertRow[];
  customer: CustomerRow;
  contactRecords: ContactRecord[];
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
                  message={`Olá, ${customer.name}! Aqui é da Hennder CRM. Gostaria de conversar sobre suas próximas compras e oportunidades comerciais.`}
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
      <ManualAlertPanel customerName={customer.name} compact />
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
  alertStatuses,
  onStatusChange,
}: {
  alerts: AlertRow[];
  customers: CustomerRow[];
  alertStatuses: Record<string, RepurchaseAlertStatus>;
  onStatusChange: (id: string, status: RepurchaseAlertStatus) => Promise<void>;
}) {
  const [filter, setFilter] = useState("todos");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const nextSevenDays = addIsoDays(crmReferenceDate, 7);
  const filteredAlerts = alerts.filter((alert) => {
    if (filter === "hoje") return alert.recommendedIso === crmReferenceDate;
    if (filter === "7dias") {
      return alert.recommendedIso >= crmReferenceDate && alert.recommendedIso <= nextSevenDays;
    }
    if (filter === "atrasados") return alert.recommendedIso < crmReferenceDate;
    if (["alta", "media", "baixa"].includes(filter)) return alert.priorityCode === filter;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filteredAlerts.length / pageSize));
  const visibleAlerts = filteredAlerts.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Operação do dia" title="Alertas de recompra" description="Fila calculada por produto, departamento, palavra-chave e histórico individual." />
      <ManualAlertPanel />
      <Panel title="Alertas priorizados" icon={Bell} action={`${filteredAlerts.length} alertas`}>
        <div className="mb-4 flex flex-wrap gap-2">
          {[
            ["todos", "Todos"],
            ["hoje", "Hoje"],
            ["7dias", "Próximos 7 dias"],
            ["atrasados", "Atrasados"],
            ["alta", "Alta"],
            ["media", "Média"],
            ["baixa", "Baixa"],
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
        <div className="grid gap-3">
          {visibleAlerts.map((alert) => {
            const customer = customers.find((item) => item.id === alert.customerId);
            const status = alertStatuses[alert.id] ?? alert.status;

            return (
              <div key={alert.id} className="rounded-lg border border-blue-100 bg-[#f8fbff] p-4 transition hover:bg-white hover:shadow-md">
                <div className="grid gap-3 md:grid-cols-[1.2fr_1.15fr_0.8fr_0.8fr_0.9fr_auto]">
                  <Metric label="Produto" value={alert.product} />
                  <Metric label="Cliente" value={alert.client} />
                  <Metric label="Vendedor" value={alert.seller} />
                  <Metric label="Compra" value={alert.buyDate} />
                  <Metric label="Recompra prevista" value={alert.recommended} />
                  <Priority value={alert.priority} />
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-blue-100 pt-3">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600">
                    Status: {status.replace("_", " ")}
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {customer && (
                      <WhatsAppButton
                        customer={customer}
                        message={`Olá! Aqui é da Hennder CRM. Notamos que pode estar próximo o momento de recomprar ${alert.product}. Podemos ajudar?`}
                        compact
                      />
                    )}
                    <AlertAction label="Contatado" onClick={() => void onStatusChange(alert.id, "contatado")} />
                    <AlertAction label="Convertido" onClick={() => void onStatusChange(alert.id, "convertido")} />
                    <AlertAction label="Ignorar" onClick={() => void onStatusChange(alert.id, "ignorado")} />
                  </div>
                </div>
              </div>
            );
          })}
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
    </div>
  );
}

function ManualAlertPanel({
  customerName = "Selecionar cliente",
  compact = false,
}: {
  customerName?: string;
  compact?: boolean;
}) {
  return (
    <Panel
      title={compact ? "Alerta manual para este cliente" : "Cadastrar alerta manual"}
      icon={Plus}
      action="Controle do usuário"
    >
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Field label="Cliente" value={customerName} />
        <Field label="Produto" value="Ração premium 15kg" />
        <Field label="Recorrência" value="45 dias" />
        <Field label="Data do alerta" value="20/06/2026" />
        <Field label="Prioridade" value="Alta" />
        <button className="flex h-11 items-center justify-center gap-2 self-end rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#063d7c]">
          <Bell size={16} />
          Salvar alerta
        </button>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Observação comercial</span>
          <input
            defaultValue="Cliente pediu lembrete quando estiver próximo da próxima compra."
            className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400 focus:bg-white"
          />
        </label>
        <label className="flex items-center gap-2 self-end rounded-lg border border-blue-100 bg-[#f8fbff] px-3 py-3 text-sm font-medium text-slate-700">
          <input type="checkbox" defaultChecked className="h-4 w-4 accent-emerald-600" />
          Avisar também por WhatsApp
        </label>
      </div>
    </Panel>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
      <input
        defaultValue={value}
        className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400 focus:bg-white"
      />
    </label>
  );
}

function SellerPortfolio({
  customers,
  alerts,
  openProfile,
}: {
  customers: CustomerRow[];
  alerts: AlertRow[];
  openProfile: (customer: CustomerRow) => void;
}) {
  const [sellerId, setSellerId] = useState(sellers[0]?.id ?? "");
  const seller = sellers.find((item) => item.id === sellerId) ?? sellers[0];
  const sellerCustomers = customers.filter((customer) => customer.preferredSellerId === seller?.id);
  const sellerAlerts = alerts.filter((alert) => alert.seller === seller?.name);

  return (
    <div className="space-y-5">
      <PageTitle
        eyebrow="Gestão por vendedor"
        title="Carteira do vendedor"
        description="Clientes, alertas e potencial comercial atribuídos pelo histórico real de compras."
      />
      <Panel title="Selecionar vendedor" icon={UserRound} action={`${sellers.length} vendedores ativos`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {sellers.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setSellerId(item.id)}
              className={`rounded-xl border p-4 text-left transition ${
                item.id === seller?.id
                  ? "border-cyan-400 bg-cyan-50 shadow-sm"
                  : "border-blue-100 bg-[#f8fbff] hover:border-cyan-300"
              }`}
            >
              <p className="font-bold text-slate-900">{item.name}</p>
              <p className="mt-1 text-xs text-slate-500">{item.customerCount} clientes preferenciais</p>
            </button>
          ))}
        </div>
      </Panel>
      {seller && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Clientes da carteira" value={`${sellerCustomers.length}`} />
            <MetricCard label="Clientes em risco" value={`${seller.riskCustomerCount}`} />
            <MetricCard label="Alertas abertos" value={`${sellerAlerts.length}`} />
            <MetricCard label="Potencial perdido" value={formatCurrency(seller.potentialValue)} />
            <MetricCard label="Taxa de conversão" value={`${seller.conversionRate}%`} />
          </div>
          <Panel title={`Carteira de ${seller.name}`} icon={UsersRound} action={`${sellerCustomers.length} clientes`}>
            <div className="grid gap-3 lg:grid-cols-2">
              {sellerCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  onClick={() => openProfile(customer)}
                  className="grid gap-3 rounded-lg border border-blue-100 bg-[#f8fbff] p-4 text-left transition hover:border-cyan-400 hover:bg-white md:grid-cols-[1fr_auto]"
                >
                  <div>
                    <p className="font-bold text-slate-900">{customer.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{customer.city} · {customer.sellerAffinity}% de afinidade</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <StatusBadge status={customer.activityStatus} label={customer.status} />
                      <QualityBadge status={customer.qualityStatus} score={customer.qualityScore} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Potencial</p>
                    <p className="mt-1 font-bold text-orange-700">{customer.potential}</p>
                  </div>
                </button>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
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
  onSave,
  onDelete,
}: {
  items: CrmOpportunity[];
  user: CrmSessionUser;
  onSave: (opportunity: Omit<CrmOpportunity, "id">, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<CrmOpportunity | "new" | null>(null);
  const canManage = (item?: CrmOpportunity) =>
    user.role !== "vendedor" || !item || item.sellerId === user.sellerId;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle eyebrow="Venda cruzada" title="Central de oportunidades" description="Combinações comerciais sugeridas a partir do comportamento de compra." />
        <button type="button" onClick={() => setEditing("new")} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white hover:bg-[#063d7c]">
          <Plus size={17} />
          Nova oportunidade
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {items.map((item) => {
          const customer = customers.find((entry) => entry.id === item.customerId);

          return (
            <Panel key={item.id} title={item.customerName} icon={ShoppingBag} action={`${item.confidence}% confiança`}>
              <p className="text-sm text-slate-500">Produto comprado</p>
              <p className="mt-1 text-lg font-semibold">{item.sourceProductName}</p>
              <p className="mt-2 text-xs font-medium text-[#0753a6]">Responsável: {item.sellerName}</p>
              <div className="mt-5 flex items-center justify-between rounded-lg border border-blue-100 bg-[#f8fbff] px-3 py-3 text-sm">
                <span>{item.suggestedProductName}</span>
                <ChevronRight size={16} className="text-slate-400" />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500">{item.reason}</p>
              <div className="mt-5 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-gradient-to-r from-[#0753a6] to-cyan-400" style={{ width: `${item.confidence}%` }} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold capitalize text-cyan-700">
                  {item.status.replace("_", " ")}
                </span>
                {canManage(item) && (
                  <div className="flex gap-2">
                    <button type="button" aria-label={`Editar oportunidade de ${item.customerName}`} onClick={() => setEditing(item)} className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 bg-white text-[#0753a6]">
                      <Pencil size={15} />
                    </button>
                    <button type="button" aria-label={`Excluir oportunidade de ${item.customerName}`} onClick={() => { if (window.confirm("Excluir esta oportunidade?")) void onDelete(item.id); }} className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-white text-red-700">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>
              {customer && (
                <div className="mt-5">
                  <WhatsAppButton customer={customer} message={`Olá! Aqui é da Hennder CRM. Temos uma sugestão que combina com sua compra de ${item.sourceProductName}: ${item.suggestedProductName}. Gostaria de saber mais?`} />
                </div>
              )}
            </Panel>
          );
        })}
      </div>
      {editing && (
        <OpportunityModal
          opportunity={editing === "new" ? undefined : editing}
          user={user}
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

function Agenda({
  items,
  user,
  onSave,
  onDelete,
}: {
  items: CrmAgendaEvent[];
  user: CrmSessionUser;
  onSave: (event: Omit<CrmAgendaEvent, "id">, id?: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<CrmAgendaEvent | "new" | null>(null);
  const days = [
    ["Seg", "2026-06-08"],
    ["Ter", "2026-06-09"],
    ["Qua", "2026-06-10"],
    ["Qui", "2026-06-11"],
    ["Sex", "2026-06-12"],
  ] as const;
  const canManage = (event?: CrmAgendaEvent) =>
    user.role !== "vendedor" || !event || event.sellerId === user.sellerId;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageTitle eyebrow="Rotina comercial" title="Agenda comercial" description="Ligações, visitas, retornos e recompras previstas em visão semanal." />
        <button type="button" onClick={() => setEditing("new")} className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0753a6] px-4 text-sm font-semibold text-white hover:bg-[#063d7c]">
          <Plus size={17} />
          Novo compromisso
        </button>
      </div>
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

function OpportunityModal({
  opportunity,
  user,
  onClose,
  onSave,
}: {
  opportunity?: CrmOpportunity;
  user: CrmSessionUser;
  onClose: () => void;
  onSave: (opportunity: Omit<CrmOpportunity, "id">) => Promise<void>;
}) {
  const defaultSeller = sellers.find((seller) => seller.id === user.sellerId) ?? sellers[0];
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
          <FormSelect label="Responsável" value={sellerId} onChange={setSellerId} disabled={user.role === "vendedor"}>
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
  onClose,
  onSave,
}: {
  event?: CrmAgendaEvent;
  user: CrmSessionUser;
  onClose: () => void;
  onSave: (event: Omit<CrmAgendaEvent, "id">) => Promise<void>;
}) {
  const defaultSeller = sellers.find((seller) => seller.id === user.sellerId) ?? sellers[0];
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
          <FormSelect label="Responsável" value={sellerId} onChange={setSellerId} disabled={user.role === "vendedor"}>
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
      <Panel title="Chat comercial" icon={Bot} action="IA local orientada por dados">
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
}: {
  theme: Theme;
  customers: CustomerRow[];
  alerts: AlertRow[];
  opportunities: CrmOpportunity[];
  contactRecords: ContactRecord[];
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
    ["Produtos recorrentes", `${snapshot.products.filter((product) => product.repurchaseActive).length}`],
    ["Potencial perdido", formatCurrency(customers.reduce((total, customer) => total + customer.potentialValue, 0))],
    ["Qualidade da base", `${customers.length ? Math.round(customers.reduce((total, customer) => total + customer.qualityScore, 0) / customers.length) : 0}%`],
  ];
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
      <PageTitle eyebrow="Analytics" title="Relatorios" description="Leitura analitica e PDFs comerciais para reuniao, rotina de ligacao e apresentacao ao cliente." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {reportCards.map(([label, value]) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </div>
      <Panel title="Relatorios em PDF" icon={FileText} action="Exportacao comercial">
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
          Ao clicar, o sistema abre um relatorio pronto para salvar como PDF pelo navegador. Quando a importacao mensal entrar, esses PDFs ja saem com a base nova.
        </p>
      </Panel>
      <Panel title="Performance por relatorio" icon={BarChart3}>
        <div className="h-96">
          <MeasuredChart>
            {({ width, height }) => (
              <BarChart width={width} height={height} data={reportBars}>
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
    : `<tr><td colspan="${report.columns.length}">Nenhum registro encontrado para este relatorio.</td></tr>`;

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

function DashboardPreview() {
  const previewValues = [
    `${dashboard.activeCustomers}`,
    `${alerts.length}`,
    formatCurrency(dashboard.potentialLost),
  ];
  const previewBars = [38, 52, 48, 66, 78, 92, 84, 100];
  const priorities = [
    ["Alta", "12 clientes em risco"],
    ["Hoje", "5 retornos agendados"],
    ["IA", "3 ofertas sugeridas"],
  ];
  const agendaPreview = [
    ["09:30", "Ligacao pos-venda"],
    ["14:00", "Recompra de racao"],
    ["16:20", "Visita comercial"],
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {["Clientes ativos", "Recompra", "Receita"].map((item, index) => (
          <div key={item} className="rounded-lg border border-white/10 bg-white/6 p-3">
            <div className="mb-3 h-2 w-16 rounded-full bg-white/15" />
            <p className="text-xl font-semibold">{previewValues[index]}</p>
            <p className="text-xs text-slate-400">{item}</p>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-white/10 bg-white/6 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-200/80">Recuperacao</p>
            <p className="mt-1 text-sm text-slate-300">Previsao de recompra por semana</p>
          </div>
          <span className="rounded-full bg-emerald-300/10 px-2 py-1 text-xs font-bold text-emerald-200">+18%</span>
        </div>
        <div className="flex h-32 items-end gap-3">
          {previewBars.map((height, index) => (
            <div key={index} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex h-28 w-full items-end">
                <div
                  className="w-full rounded-t-md bg-emerald-300/80 shadow-[0_0_24px_rgba(52,211,153,0.18)]"
                  style={{ height: `${height}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-slate-500">{index + 1}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-white/10 bg-white/6 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Prioridades</p>
            <AlertTriangle size={15} className="text-amber-300" />
          </div>
          <div className="space-y-2">
            {priorities.map(([label, text]) => (
              <div key={text} className="flex items-center justify-between gap-2 rounded-md bg-white/6 px-2 py-1.5">
                <span className="rounded-full bg-white/8 px-2 py-0.5 text-[10px] font-bold text-emerald-200">{label}</span>
                <span className="truncate text-xs text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/6 p-3">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Agenda IA</p>
            <CalendarDays size={15} className="text-cyan-300" />
          </div>
          <div className="space-y-2">
            {agendaPreview.map(([time, text]) => (
              <div key={`${time}-${text}`} className="flex items-center gap-2 rounded-md bg-white/6 px-2 py-1.5">
                <span className="w-11 rounded bg-cyan-300/10 px-1.5 py-1 text-center text-[10px] font-bold text-cyan-200">{time}</span>
                <span className="truncate text-xs text-slate-300">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
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
    grid: dark ? "#253247" : "#e2e8f0",
    text: dark ? "#94a3b8" : "#64748b",
    tooltip: {
      backgroundColor: dark ? "#0b1220" : "#ffffff",
      borderColor: dark ? "#26364d" : "#dbeafe",
      borderRadius: 10,
      color: dark ? "#f8fafc" : "#0f172a",
    },
  };
}

function PageTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="flex flex-col justify-between gap-3 rounded-xl border border-blue-100 bg-white/72 px-4 py-3 shadow-sm backdrop-blur sm:flex-row sm:items-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-700">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-[#123252] sm:text-3xl">{title}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
      </div>
      <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-[#f5faff] px-3 py-2 text-sm font-medium text-[#0753a6]">
        <Activity size={16} className="text-cyan-600" />
        Dados demonstrativos
      </div>
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
    <section className="rounded-xl border border-blue-100 bg-white p-4 shadow-[0_6px_18px_rgba(30,83,135,0.07)] sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3 border-b border-blue-50 pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e7f4ff] text-[#0753a6]">
            <Icon size={18} />
          </div>
          <h2 className="font-bold tracking-tight text-[#18334d]">{title}</h2>
        </div>
        {action ? <span className="rounded-md bg-cyan-50 px-2 py-1 text-xs font-semibold text-cyan-700">{action}</span> : <MoreHorizontal size={18} className="text-slate-400" />}
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
      <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-lg border border-blue-100 bg-white px-3 text-sm text-[#0753a6] focus-within:border-cyan-400">
      <Filter size={15} className="shrink-0" />
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="min-w-0 flex-1 bg-transparent outline-none"
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

function AlertAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 rounded-lg border border-blue-100 bg-white px-3 text-xs font-semibold text-[#0753a6] hover:border-cyan-400 hover:bg-cyan-50"
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

function Priority({ value }: { value: string }) {
  const style = value === "Alta" ? "bg-red-50 text-red-700" : value === "Média" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700";
  return <span className={`self-center rounded-full px-3 py-1 text-xs font-semibold ${style}`}>{value}</span>;
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
    <div>
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
}: {
  customer: CustomerRow;
  onClose: () => void;
  onSave: (record: Omit<ContactRecord, "id">) => Promise<void>;
  header?: React.ReactNode;
}) {
  const [outcome, setOutcome] = useState<ContactOutcome>("no_answer");
  const [note, setNote] = useState("");
  const [nextContact, setNextContact] = useState("");
  const [channel, setChannel] = useState<ContactChannel>("WhatsApp");
  const [responsible, setResponsible] = useState("Hennder CRM");
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
              contactedAt: new Date().toLocaleDateString("pt-BR"),
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
            placeholder="Ex.: cliente está com estoque, pediu nova condição ou prefere contato pela manhã."
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
              onChange={(event) => setResponsible(event.target.value)}
              required
              className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400"
            />
          </label>
        </div>

        <label className="mt-4 block">
          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Próximo contato</span>
          <input
            type="date"
            value={nextContact}
            onChange={(event) => setNextContact(event.target.value)}
            required={outcome === "follow_up"}
            className="mt-2 h-11 w-full rounded-lg border border-blue-100 bg-[#f8fbff] px-3 text-sm outline-none focus:border-cyan-400"
          />
          <span className="mt-1 block text-xs text-slate-400">
            Obrigatório quando o cliente pedir contato em outro momento.
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

function addIsoDays(value: string, days: number) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
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
  | "potential";

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
    keywords: ["produto", "produtos", "recompra", "comprar de novo", "recorrente", "recorrencia"],
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

  if (!context.customers.length && !context.alerts.length) {
    return [
      "Base comercial zerada no momento.",
      "",
      "Proximo movimento recomendado:",
      "1. Emitir o relatorio mensal no PostgreSQL do ERP.",
      "2. Importar o CSV pelo importador temporario.",
      "3. Conferir clientes, vendas, itens, vendedores e alertas antes da apresentacao.",
      "",
      "Depois da importacao eu consigo priorizar contatos, sugerir recompra e apontar cadastros fracos automaticamente.",
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
      "Acao sugerida: antes de campanha em massa, valide celular/WhatsApp desses clientes para nao perder retorno por dado ruim.",
    ].join("\n");
  }

  if (knowledge?.intent === "seller") {
    return [
      "Leitura por vendedor, considerando clientes em risco, alertas pendentes e potencial perdido:",
      formatGenericList(sellerRanking.slice(0, 5).map((seller) => `${seller.name}: ${seller.score} pts, ${seller.riskCustomers} cliente(s) em risco, ${seller.pendingAlerts} alerta(s), ${formatCurrency(seller.potentialValue)} de potencial.`)),
      "Acao sugerida: comece pelo vendedor com maior pontuacao e distribua uma lista curta de contatos para hoje.",
    ].join("\n");
  }

  if (knowledge?.intent === "repurchase") {
    return [
      "Produtos com maior sinal de recompra agora:",
      formatGenericList(productRanking.map((product) => `${product.name}: ${product.count} alerta(s), prioridade ${product.priority}, ciclo medio ${product.days} dias.`)),
      "Acao sugerida: monte abordagem por produto, nao so por cliente. Isso ajuda o vendedor a falar direto do item que provavelmente acabou.",
    ].join("\n");
  }

  if (knowledge?.intent === "opportunity") {
    return [
      "Melhores oportunidades comerciais abertas:",
      formatGenericList(opportunityRanking.map((item) => `${item.customerName}: oferecer ${item.suggestedProductName} (${item.confidence}% de confianca). Motivo: ${item.reason}`)),
      "Acao sugerida: use oportunidade quando o cliente ja estiver em contato por recompra. A conversa fica mais natural.",
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
      todayAgenda.length ? `Agenda ja marcada: ${todayAgenda.map((event) => `${event.time} ${event.title}`).join("; ")}.` : "Agenda de hoje sem compromissos importados.",
      "Script curto: confirme se o produto esta acabando, ofereca reposicao e ja atualize WhatsApp/celular se necessario.",
    ].join("\n");
  }

  if (knowledge?.intent === "risk") {
    return [
      `Clientes com maior risco de abandono: ${riskCustomers.length}.`,
      formatCustomerList(riskCustomers, (customer) => `${customer.name}: ${customer.days} dias sem compra, potencial ${customer.potential}, vendedor ${customer.preferredSeller}.`),
      "Acao sugerida: priorize quem tem maior potencial perdido e WhatsApp valido. Se nao houver WhatsApp, vira tarefa de saneamento cadastral.",
    ].join("\n");
  }

  if (knowledge?.intent === "potential") {
    const topPotential = [...context.customers]
      .sort((a, b) => b.potentialValue - a.potentialValue)
      .slice(0, 5);
    const totalPotential = topPotential.reduce((total, customer) => total + customer.potentialValue, 0);
    return [
      `Top potencial recuperavel neste recorte: ${formatCurrency(totalPotential)} nos principais clientes.`,
      formatCustomerList(topPotential, (customer) => `${customer.name}: ${customer.potential}, ticket medio ${customer.ticket}, ${customer.days} dias sem compra.`),
      "Acao sugerida: use mensagem personalizada por historico de compra, evitando campanha generica.",
    ].join("\n");
  }

  return [
    "Nao entendi.",
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
  return sellers
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
  message = "Olá! Aqui é da Hennder CRM. Gostaria de conversar sobre suas próximas compras.",
  compact = false,
}: {
  customer: CustomerRow;
  message?: string;
  compact?: boolean;
}) {
  if (!customer.whatsapp) {
    return (
      <span
        aria-label={`${customer.name} não possui WhatsApp cadastrado`}
        title="WhatsApp não cadastrado"
        className={`inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg bg-slate-200 font-semibold text-slate-500 ${
          compact ? "h-10 w-10" : "h-11 px-4 text-sm"
        }`}
      >
        <MessageCircle size={compact ? 18 : 17} />
        {!compact && <span>Sem WhatsApp</span>}
      </span>
    );
  }

  const phone = normalizeBrazilianWhatsAppNumber(customer.whatsapp);
  if (!phone) return null;
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chamar ${customer.name} no WhatsApp`}
      title={`Chamar ${customer.name} no WhatsApp`}
      className={`inline-flex items-center justify-center gap-2 rounded-lg bg-[#25d366] font-semibold text-white shadow-sm transition hover:bg-[#1ebe5d] focus-visible:outline-[#25d366] ${
        compact ? "h-10 w-10" : "h-11 px-4 text-sm"
      }`}
    >
      <MessageCircle size={compact ? 18 : 17} />
      {!compact && <span>Chamar no WhatsApp</span>}
    </a>
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

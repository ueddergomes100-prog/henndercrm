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
  Clock3,
  Filter,
  Leaf,
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
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
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
import type {
  CrmAgendaEvent,
  ContactChannel,
  ContactOutcome,
  CrmContactRecord,
  CrmOpportunity,
  CrmSessionUser,
  CrmWorkspace,
  RepurchaseAlertStatus,
} from "@/domain/crm/types";
import {
  crmReferenceDate,
  crmViewModel,
  formatCurrency,
} from "@/services/crm-view-service";

type View =
  | "dashboard"
  | "clientes"
  | "perfil"
  | "recuperacao"
  | "recompra"
  | "carteira"
  | "saude"
  | "oportunidades"
  | "agenda"
  | "ia"
  | "relatorios";

type ContactRecord = CrmContactRecord;
type Theme = "light" | "dark";

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

const navItems: { id: View; label: string; description: string; icon: typeof Activity }[] = [
  { id: "dashboard", label: "Dashboard", description: "Resumo dos principais indicadores comerciais.", icon: BarChart3 },
  { id: "clientes", label: "Clientes", description: "Consulte a carteira e o histórico dos clientes.", icon: UsersRound },
  { id: "recuperacao", label: "Recuperação", description: "Gerencie clientes sem compra e registre retornos.", icon: Clock3 },
  { id: "recompra", label: "Alertas", description: "Acompanhe clientes no momento ideal de recompra.", icon: Bell },
  { id: "carteira", label: "Carteira", description: "Acompanhe clientes, alertas e potencial por vendedor.", icon: UserRound },
  { id: "saude", label: "Saúde da base", description: "Monitore a qualidade dos cadastros dos clientes.", icon: ShieldCheck },
  { id: "oportunidades", label: "Oportunidades", description: "Veja sugestões de vendas e produtos relacionados.", icon: Target },
  { id: "agenda", label: "Agenda", description: "Organize contatos, visitas e retornos comerciais.", icon: CalendarDays },
  { id: "ia", label: "IA Comercial", description: "Receba análises e recomendações para vender melhor.", icon: Bot },
  { id: "relatorios", label: "Relatórios", description: "Analise resultados, recuperação e recorrência.", icon: PieChart },
];

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
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#07111f] text-white">
        <div className="text-center">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-300" />
          <p className="mt-4 text-sm text-slate-300">Carregando sessão...</p>
        </div>
      </main>
    );
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

  const openProfile = (customer: (typeof customers)[number]) => {
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
            onLogout={async () => {
              await fetch("/api/auth/session", { method: "DELETE" });
              setUser(null);
              setActiveView("dashboard");
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
                openProfile={openProfile}
                contactRecords={contactRecords}
                openRecovery={() => setActiveView("recuperacao")}
                theme={theme}
              />
            )}
            {activeView === "clientes" && <Customers openProfile={openProfile} />}
            {activeView === "recuperacao" && (
              <RecoveryCustomers
                openProfile={openProfile}
                contactRecords={contactRecords}
                onRegisterContact={registerContact}
              />
            )}
            {activeView === "perfil" && (
              <CustomerProfile
                customer={selectedCustomer}
                contactRecords={contactRecords.filter((record) => record.customerId === selectedCustomer.id)}
              />
            )}
            {activeView === "recompra" && (
              <RepurchaseAlerts
                alertStatuses={alertStatuses}
                onStatusChange={updateAlertStatus}
              />
            )}
            {activeView === "carteira" && <SellerPortfolio openProfile={openProfile} />}
            {activeView === "saude" && <DataHealth openProfile={openProfile} />}
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
            {activeView === "ia" && <CommercialAi />}
            {activeView === "relatorios" && <Reports theme={theme} />}
          </motion.div>
        </section>
      </div>
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

function LoginScreen({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("admin@henndercrm.local");
  const [password, setPassword] = useState("Admin@123");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="min-h-screen overflow-hidden bg-[#0d1211] text-white">
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
                <LogIn size={18} />
                {submitting ? "Entrando..." : "Entrar"}
                <ChevronRight size={17} className="transition group-hover:translate-x-0.5" />
              </button>
              {error && (
                <p className="rounded-lg border border-red-300/25 bg-red-400/10 px-3 py-2 text-sm text-red-100">
                  {error}
                </p>
              )}
            </form>
            <div className="mt-5 rounded-lg border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-300">
              <p className="font-semibold text-white">Acessos de demonstração</p>
              <p>Administrador: admin@henndercrm.local / Admin@123</p>
              <p>Supervisor: supervisor@henndercrm.local / Supervisor@123</p>
              <p>Vendedor: vendedor@henndercrm.local / Vendedor@123</p>
            </div>
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
  const visibleNavItems =
    user.role === "vendedor"
      ? navItems.filter((item) => !["saude", "relatorios"].includes(item.id))
      : navItems;

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
        <nav className="mt-7 space-y-1.5">
          {visibleNavItems.map((item) => {
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
  onLogout,
}: {
  onMenu: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  user: CrmSessionUser;
  onLogout: () => Promise<void>;
}) {
  const ThemeIcon = theme === "dark" ? Moon : Sun;

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
          <button className="hidden h-10 items-center gap-2 rounded-lg border border-white/20 bg-white px-3 text-sm font-semibold text-[#0753a6] shadow-sm sm:flex">
            <Plus size={17} />
            Nova ação
          </button>
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

function Dashboard({
  openProfile,
  contactRecords,
  openRecovery,
  theme,
}: {
  openProfile: (customer: (typeof customers)[number]) => void;
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
  openProfile,
  contactRecords,
  onRegisterContact,
}: {
  openProfile: (customer: (typeof customers)[number]) => void;
  contactRecords: ContactRecord[];
  onRegisterContact: (record: Omit<ContactRecord, "id">) => Promise<void>;
}) {
  const [contactCustomer, setContactCustomer] = useState<(typeof customers)[number] | null>(null);
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

function Customers({ openProfile }: { openProfile: (customer: (typeof customers)[number]) => void }) {
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
  customer,
  contactRecords,
}: {
  customer: (typeof customers)[number];
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
  alertStatuses,
  onStatusChange,
}: {
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
  openProfile,
}: {
  openProfile: (customer: (typeof customers)[number]) => void;
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
  openProfile,
}: {
  openProfile: (customer: (typeof customers)[number]) => void;
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

function CommercialAi() {
  const prompts = [
    "Quais clientes devo ligar hoje?",
    "Quem está em risco de abandono?",
    "Quais produtos têm maior potencial de recompra?",
    "Mostre clientes que compravam mensalmente e pararam.",
  ];
  const [question, setQuestion] = useState(prompts[0]);
  const [answer, setAnswer] = useState(getCommercialAiAnswer(prompts[0]));

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Assistente comercial" title="IA Comercial" description="Interface de chat para transformar perguntas do time em ações de venda." />
      <Panel title="Chat comercial" icon={Bot} action="GPT-ready mockup">
        <div className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="space-y-3">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => {
                  setQuestion(prompt);
                  setAnswer(getCommercialAiAnswer(prompt));
                }}
                className="w-full rounded-lg border border-blue-100 bg-[#f8fbff] p-4 text-left text-sm font-medium text-slate-700 transition hover:border-cyan-400 hover:bg-white"
              >
                {prompt}
              </button>
            ))}
          </div>
          <div className="rounded-lg border border-blue-100 bg-[#f3f8fd] p-4">
            <div className="space-y-4">
              <ChatBubble role="user" text={question} />
              <ChatBubble role="ai" text={answer} />
            </div>
            <div className="mt-5 flex h-12 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Pergunte sobre clientes, produtos ou oportunidades"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
              <button
                type="button"
                onClick={() => setAnswer(getCommercialAiAnswer(question))}
                className="flex h-8 w-8 items-center justify-center rounded-md bg-[#0753a6] text-white"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function Reports({ theme }: { theme: Theme }) {
  const chartColors = getChartColors(theme);
  const reportCards = [
    ["Clientes perdidos", `${dashboard.lostCustomers}`],
    ["Alertas de recompra", `${alerts.length}`],
    ["Produtos recorrentes", `${snapshot.products.filter((product) => product.repurchaseActive).length}`],
    ["Potencial perdido", formatCurrency(dashboard.potentialLost)],
    ["Qualidade da base", `${dashboard.averageRegistrationQuality}%`],
  ];

  return (
    <div className="space-y-5">
      <PageTitle eyebrow="Analytics" title="Relatórios" description="Leitura analítica de perda, recuperação, recorrência e faturamento recuperado." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {reportCards.map(([label, value]) => (
          <MetricCard key={label} label={label} value={value} />
        ))}
      </div>
      <Panel title="Performance por relatório" icon={BarChart3}>
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

function DashboardPreview() {
  const previewValues = [
    `${dashboard.activeCustomers}`,
    `${alerts.length}`,
    formatCurrency(dashboard.potentialLost),
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
      <div className="flex h-48 items-end gap-3 rounded-lg border border-white/10 bg-white/6 p-4">
        {[38, 52, 48, 66, 78, 92, 84, 100].map((height, index) => (
          <div key={index} className="flex flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-emerald-300/80 shadow-[0_0_24px_rgba(52,211,153,0.18)]"
              style={{ height: `${height}%` }}
            />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 rounded-lg border border-white/10 bg-white/6" />
        <div className="h-24 rounded-lg border border-white/10 bg-white/6" />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Fechar modal" className="absolute inset-0 cursor-default" onClick={onClose} />
      <section className="relative z-10 max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-blue-100 bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-blue-50 pb-4">
          <h2 className="text-xl font-bold text-[#18334d]">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-100 text-slate-500 hover:bg-slate-50">
            <X size={18} />
          </button>
        </div>
        {children}
      </section>
    </div>
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
  type?: "text" | "number" | "date" | "time";
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
}: {
  customer: (typeof customers)[number];
  onClose: () => void;
  onSave: (record: Omit<ContactRecord, "id">) => Promise<void>;
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

function getCommercialAiAnswer(question: string) {
  const normalized = question.toLocaleLowerCase("pt-BR");

  if (normalized.includes("sem whatsapp")) {
    const names = customers.filter((customer) => !customer.whatsapp).map((customer) => customer.name);
    return names.length
      ? `${names.length} clientes estão sem WhatsApp: ${names.join(", ")}. Recomendo priorizar a atualização cadastral.`
      : "Todos os clientes do recorte atual possuem WhatsApp.";
  }
  if (normalized.includes("vendedor")) {
    return sellers
      .map((seller) => `${seller.name}: ${seller.customerCount} clientes e ${formatCurrency(seller.potentialValue)} de potencial`)
      .join(". ");
  }
  if (normalized.includes("produto")) {
    const names = snapshot.products
      .filter((product) => product.repurchaseActive)
      .slice(0, 5)
      .map((product) => `${product.name} (${product.defaultRepurchaseDays ?? "histórico"} dias)`);
    return `Produtos com regra ativa: ${names.join(", ")}.`;
  }
  if (normalized.includes("potencial")) {
    const priority = [...customers]
      .sort((a, b) => b.potentialValue - a.potentialValue)
      .slice(0, 3)
      .map((customer) => `${customer.name} (${customer.potential})`);
    return `Maior potencial perdido: ${priority.join(", ")}.`;
  }
  if (normalized.includes("risco") || normalized.includes("pararam")) {
    const riskCustomers = customers
      .filter((customer) => customer.activityStatus === "risco" || customer.activityStatus === "perdido")
      .map((customer) => `${customer.name} (${customer.days} dias)`);
    return `Clientes em risco ou perdidos: ${riskCustomers.join(", ")}.`;
  }

  const priority = [...customers]
    .filter((customer) => customer.activityStatus !== "ativo")
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((customer) => `${customer.name} com score ${customer.score}`);
  return `Priorize hoje: ${priority.join(", ")}. A recomendação combina inatividade, recorrência e potencial perdido.`;
}

function WhatsAppButton({
  customer,
  message = "Olá! Aqui é da Hennder CRM. Gostaria de conversar sobre suas próximas compras.",
  compact = false,
}: {
  customer: (typeof customers)[number];
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

  const localNumber = customer.whatsapp.replace(/\D/g, "");
  const phone = localNumber.startsWith("55") ? localNumber : `55${localNumber}`;
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
      <div className={`max-w-[82%] rounded-xl px-4 py-3 text-sm leading-6 ${role === "user" ? "bg-[#0753a6] text-white" : "border border-blue-100 bg-white text-slate-700"}`}>
        {text}
      </div>
    </div>
  );
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-[#06356c] shadow-lg shadow-blue-950/20">
        <Leaf size={24} />
      </div>
      <div>
        <p className={`font-semibold ${compact ? "text-slate-950" : "text-white"}`}>Hennder CRM</p>
        <p className={`text-xs ${compact ? "text-slate-500" : "text-emerald-50/60"}`}>Inteligência Comercial e Recompra</p>
      </div>
    </div>
  );
}

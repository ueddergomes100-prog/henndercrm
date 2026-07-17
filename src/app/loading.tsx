export default function Loading() {
  return (
    <main className="crm-loading-screen flex min-h-screen items-center justify-center overflow-hidden bg-[#02040a] px-6 text-white">
      <section className="crm-loading-card relative z-10 w-full max-w-md rounded-3xl border border-cyan-300/18 bg-[#061324]/86 p-8 text-center shadow-2xl shadow-cyan-950/30 backdrop-blur-xl">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border border-cyan-300/55 bg-gradient-to-br from-[#041d40] via-[#06356c] to-[#0753a6] text-white shadow-2xl shadow-cyan-950/35">
          <span className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-cyan-300/24 blur-sm" />
          <span className="absolute bottom-5 left-5 right-5 h-2 rounded-full bg-cyan-300" />
          <span className="relative z-10 text-6xl font-black leading-none tracking-tight drop-shadow-sm">H</span>
        </div>
        <p className="mt-6 text-xs font-black uppercase tracking-[0.28em] text-cyan-200">Hennder CRM</p>
        <h1 className="mt-3 text-2xl font-bold">Carregando inteligencia comercial</h1>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          Preparando carteira, alertas e oportunidades de recompra.
        </p>
        <div className="mt-7 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="crm-loading-progress h-full rounded-full bg-gradient-to-r from-cyan-300 via-emerald-300 to-blue-400" />
        </div>
      </section>
    </main>
  );
}

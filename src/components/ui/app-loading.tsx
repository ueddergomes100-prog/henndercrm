"use client";

import {
  DotLottieWorker,
  type LoadErrorEvent,
  type RenderErrorEvent,
} from "@lottiefiles/dotlottie-web";
import { useReducedMotion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { LoadingCoordinator } from "@/lib/loading-coordinator.mjs";

const LOTTIE_SOURCE = "/lottie/loading.lottie";
const INITIAL_STATE = {
  visible: false,
  activeCount: 0,
  label: "Carregando",
};

type LoadingOptions = {
  label?: string;
  timeoutMs?: number;
};

type AppLoadingContextValue = {
  activeCount: number;
  beginLoading: (options?: LoadingOptions | string) => () => void;
  runWithLoading: <T>(
    task: () => Promise<T>,
    options?: LoadingOptions | string,
  ) => Promise<T>;
};

const AppLoadingContext = createContext<AppLoadingContextValue | null>(null);

export function AppLoadingProvider({ children }: { children: ReactNode }) {
  const [loadingState, setLoadingState] = useState(INITIAL_STATE);
  const [coordinator] = useState(
    () =>
      new LoadingCoordinator({
        onChange: setLoadingState,
        showDelayMs: 150,
        minimumVisibleMs: 380,
        defaultTimeoutMs: 30000,
        onTimeout: (label: string, timeoutMs: number) => {
          if (process.env.NODE_ENV !== "production") {
            console.error(`[AppLoading] "${label}" excedeu o limite de ${timeoutMs}ms.`);
          }
        },
      }),
  );

  useEffect(() => () => coordinator.dispose(), [coordinator]);

  useEffect(() => {
    document.body.setAttribute("aria-busy", loadingState.activeCount > 0 ? "true" : "false");
    return () => document.body.removeAttribute("aria-busy");
  }, [loadingState.activeCount]);

  const beginLoading = useCallback(
    (options: LoadingOptions | string = {}) => coordinator.begin(options),
    [coordinator],
  );

  const runWithLoading = useCallback(
    async <T,>(task: () => Promise<T>, options: LoadingOptions | string = {}) => {
      const finish = beginLoading(options);
      try {
        return await task();
      } finally {
        finish();
      }
    },
    [beginLoading],
  );

  const contextValue = useMemo(
    () => ({
      activeCount: loadingState.activeCount,
      beginLoading,
      runWithLoading,
    }),
    [beginLoading, loadingState.activeCount, runWithLoading],
  );

  return (
    <AppLoadingContext.Provider value={contextValue}>
      {children}
      <GlobalLoadingOverlay
        visible={loadingState.visible}
        activeCount={loadingState.activeCount}
        label={loadingState.label}
      />
    </AppLoadingContext.Provider>
  );
}

export function useAppLoading() {
  const context = useContext(AppLoadingContext);
  if (!context) throw new Error("useAppLoading deve ser usado dentro de AppLoadingProvider.");
  return context;
}

export function AppLoadingScreen({ label = "Carregando o sistema" }: { label?: string }) {
  return (
    <main
      className="app-loading-screen"
      aria-busy="true"
      aria-live="polite"
      aria-label={label}
      role="status"
    >
      <AppLoadingAnimation active />
      <span className="sr-only">{label}</span>
    </main>
  );
}

export function AppInlineLoading({ label = "Carregando conteúdo" }: { label?: string }) {
  return (
    <div className="app-inline-loading" aria-busy="true" aria-live="polite" role="status">
      <AppLoadingAnimation active compact />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function AppLoadingMark({ active }: { active: boolean }) {
  return (
    <span className="app-loading-mark" aria-hidden="true">
      <AppLoadingAnimation active={active} icon />
    </span>
  );
}

function GlobalLoadingOverlay({
  visible,
  activeCount,
  label,
}: {
  visible: boolean;
  activeCount: number;
  label: string;
}) {
  return (
    <div
      className={`app-loading-overlay ${visible ? "app-loading-overlay--visible" : ""}`}
      aria-hidden={!visible}
      aria-live={visible ? "polite" : "off"}
      aria-label={visible ? label : undefined}
      data-active-count={activeCount}
      role={visible ? "status" : undefined}
    >
      <AppLoadingAnimation active={visible} />
      <span className="sr-only">{visible ? label : ""}</span>
    </div>
  );
}

function AppLoadingAnimation({
  active,
  compact = false,
  icon = false,
}: {
  active: boolean;
  compact?: boolean;
  icon?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [playerFailed, setPlayerFailed] = useState(false);
  const shouldAnimate = Boolean(active && !reduceMotion && !playerFailed);
  const shouldAnimateRef = useRef(shouldAnimate);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const playerRef = useRef<DotLottieWorker | null>(null);

  useEffect(() => {
    shouldAnimateRef.current = shouldAnimate;
    const player = playerRef.current;
    if (!player) return;

    const syncPlayback = async () => {
      if (shouldAnimate && player.isLoaded) {
        await player.setLoop(true);
        await player.setLoopCount(0);
        await player.setUseFrameInterpolation(true);
        await player.unfreeze();
        await player.play();
        return;
      }

      await player.pause();
      await player.freeze();
    };

    void syncPlayback();
  }, [shouldAnimate]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let disposed = false;
    const player = new DotLottieWorker({
      canvas,
      src: new URL(LOTTIE_SOURCE, window.location.origin).href,
      loop: true,
      loopCount: 0,
      autoplay: shouldAnimateRef.current,
      useFrameInterpolation: true,
      renderConfig: {
        autoResize: true,
        freezeOnOffscreen: false,
        quality: 100,
      },
    });
    playerRef.current = player;

    const reportPlayerError = (error: unknown) => {
      if (disposed) return;
      setPlayerFailed(true);
      if (process.env.NODE_ENV !== "production") {
        console.error("[AppLoading] Falha ao executar o arquivo Lottie.", error);
      }
    };
    const startContinuousPlayback = async () => {
      if (!shouldAnimateRef.current || !player.isLoaded) return;
      await player.setLoop(true);
      await player.setLoopCount(0);
      await player.setUseFrameInterpolation(true);
      await player.unfreeze();
      await player.play();
    };
    const resumeContinuousPlayback = () => {
      void startContinuousPlayback().catch(reportPlayerError);
    };
    const handleLoad = () => {
      setPlayerFailed(false);
      resumeContinuousPlayback();
    };
    const handleComplete = () => {
      if (!shouldAnimateRef.current) return;
      void player
        .setFrame(0)
        .then(startContinuousPlayback)
        .catch(reportPlayerError);
    };
    const handleUnexpectedFreeze = () => {
      if (shouldAnimateRef.current) resumeContinuousPlayback();
    };
    const handleLoadError = ({ error }: LoadErrorEvent | RenderErrorEvent) => {
      reportPlayerError(error);
    };

    player.addEventListener("load", handleLoad);
    player.addEventListener("ready", resumeContinuousPlayback);
    player.addEventListener("complete", handleComplete);
    player.addEventListener("freeze", handleUnexpectedFreeze);
    player.addEventListener("loadError", handleLoadError);
    player.addEventListener("renderError", handleLoadError);
    resumeContinuousPlayback();

    return () => {
      disposed = true;
      player.removeEventListener("load", handleLoad);
      player.removeEventListener("ready", resumeContinuousPlayback);
      player.removeEventListener("complete", handleComplete);
      player.removeEventListener("freeze", handleUnexpectedFreeze);
      player.removeEventListener("loadError", handleLoadError);
      player.removeEventListener("renderError", handleLoadError);
      if (playerRef.current === player) playerRef.current = null;
      void player.destroy();
    };
  }, []);

  const showFallback = Boolean(reduceMotion || playerFailed);

  return (
    <div
      className={`app-loading-animation ${compact ? "app-loading-animation--compact" : ""} ${icon ? "app-loading-animation--icon" : ""}`}
    >
      <canvas
        ref={canvasRef}
        className={showFallback ? "hidden" : "h-full w-full"}
        aria-hidden="true"
      />
      {showFallback && (
        <div className="app-loading-fallback" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      )}
    </div>
  );
}

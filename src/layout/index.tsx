import { lazy, Suspense, useEffect, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BuildInfo } from "@/components/build-info";
import { LanguageSelect } from "@/components/language-select";
import { AppUpdateChecker } from "@/components/providers/app-update-checker";
import { SiteBrand } from "@/components/site-brand";
import { ThemeSelect } from "@/components/theme/theme-select";
import { Pending } from "@/components/toolkit";
import { AnimatedSegmentedTabs } from "@/components/ui/animated-segmented-tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "@/hooks/use-theme";
import { t } from "@/i18n";
import {
  Home,
  ArrowRightFromLine,
  Activity,
  Sparkles,
  Search,
} from "lucide-react";
import { Tabs } from "radix-ui";
import { Toaster } from "sonner";
import { RouteErrorBoundary } from "./route-error-boundary";
import { activeNavigationRoute, navigationRoutes } from "./routes";

const MobileNavGlass = lazy(() => import("@/components/mobile-nav-glass"));

const menuIcons = {
  "/": Home,
  "/network/ip": Search,
  "/ai/": Sparkles,
  "/status/": Activity,
  "/network/egress": ArrowRightFromLine,
};

const options = navigationRoutes.map((route) => {
  const Icon = menuIcons[route.value];
  return {
    value: route.value,
    label: (
      <>
        <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
        <span className="nav-full">{route.label}</span>
        <span className="nav-short">{route.short}</span>
      </>
    ),
  };
});

export function AppLayout() {
  const { scheme } = useTheme();
  const mobile = useIsMobile();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navRef = useRef<HTMLElement>(null);
  const activeRoute = activeNavigationRoute(pathname);

  useEffect(() => {
    window.scrollTo(0, 0);
    const viewport = navRef.current?.querySelector<HTMLElement>(
      "[data-slot=scroll-area-viewport]",
    );
    const trigger = navRef.current?.querySelector<HTMLElement>(
      "[role=tab][data-state=active]",
    );
    if (!viewport || !trigger) return;
    const parent = viewport.getBoundingClientRect();
    const child = trigger.getBoundingClientRect();
    const offset =
      child.left < parent.left
        ? child.left - parent.left - 8
        : child.right > parent.right
          ? child.right - parent.right + 8
          : 0;
    if (offset)
      viewport.scrollBy({
        left: offset,
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [pathname]);

  return (
    <>
      <div className="app-container">
        <header className="mobile-site-header">
          <SiteBrand />
          <div className="flex items-center gap-1">
            <LanguageSelect />
            <ThemeSelect className="size-8 rounded-full text-muted-foreground hover:bg-accent/50" />
          </div>
        </header>
        <AnimatedSegmentedTabs
          label={t("网络诊断工具")}
          options={options}
          value={activeRoute}
          onValueChange={(value) => {
            if (value !== activeRoute) navigate(value);
          }}
          activationMode="manual"
          className="min-w-0"
          listClassName="h-9 w-max justify-start gap-1 bg-transparent p-0"
          highlightClassName="rounded-full bg-primary/12"
          triggerClassName="h-8 flex-none rounded-full border-0 px-3.5 text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/40 data-[state=active]:font-bold data-[state=active]:text-primary transition-[color,background-color,transform] duration-150 ease-out"
          renderList={(list) => (
            <nav ref={navRef} className="app-nav" aria-label={t("主导航")}>
              {mobile && (
                <Suspense fallback={null}>
                  <MobileNavGlass light={scheme === "light"} />
                </Suspense>
              )}
              <SiteBrand className="desktop-site-brand" />
              <ScrollArea className="nav-tabs-scroll">
                {list}
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
              <div className="desktop-preferences flex items-center gap-1.5 pl-2 border-l border-border/40">
                <LanguageSelect />
                <ThemeSelect className="size-8 shrink-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50" />
              </div>
            </nav>
          )}
        >
          <Tabs.Content value={activeRoute} asChild>
            <main className="outline-none">
              <RouteErrorBoundary key={activeRoute}>
                <Suspense
                  fallback={
                    <p className="status-line">
                      <Pending>{t("正在加载页面…")}</Pending>
                    </p>
                  }
                >
                  <Outlet />
                </Suspense>
              </RouteErrorBoundary>
            </main>
          </Tabs.Content>
        </AnimatedSegmentedTabs>
        <footer className="app-footer">
          <div className="app-footer-brand">
            <SiteBrand />
            <span className="app-footer-copy">
              © {new Date().getFullYear()}
            </span>
            <span className="app-footer-tagline">
              {t("面向代理与分流用户的出口诊断工作台 · 不提供纯净度排名")}
            </span>
          </div>
          <nav className="app-footer-nav" aria-label={t("站点链接")}>
            <Link className="app-footer-link" to="/docs/health">
              API
            </Link>
            <Link className="app-footer-link" to="/share">
              {t("分享报告")}
            </Link>
            <Link className="app-footer-link" to="/terms">
              {t("使用条款")}
            </Link>
            <Link className="app-footer-link" to="/privacy">
              {t("隐私政策")}
            </Link>
          </nav>
        </footer>
      </div>
      <aside aria-label={t("站点通知")} className="update-notices">
        <AppUpdateChecker />
      </aside>
      <BuildInfo />
      <Toaster richColors theme={scheme} position="top-right" />
    </>
  );
}

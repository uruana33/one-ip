import { lazy } from "react";
import {
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";
import { AppLayout } from "@/layout";
import { legacyRoutes } from "@/layout/routes";
import { ToolLayout } from "@/layout/tool-layout";
import { aiPlatforms } from "@/views/ai/platforms";
import { lookupLocation } from "@/views/lookup/href";

const PlatformDiagnostics = lazy(() => import("@/views/ai"));
const AiFleetBoard = lazy(() =>
  import("@/views/ai/fleet-board").then((module) => ({
    default: module.AiFleetBoard,
  })),
);
const HomePage = lazy(() => import("@/views/home"));
const ClaudePage = lazy(() => import("@/views/claude"));
const GptPage = lazy(() => import("@/views/gpt"));
const LookupPage = lazy(() => import("@/views/lookup"));
const SubdomainsPage = lazy(() => import("@/views/subdomains"));
const EgressPage = lazy(() => import("@/views/egress"));
const WebRtcPage = lazy(() => import("@/views/webrtc"));
const StatusPage = lazy(() => import("@/views/status"));
const ClaudeStatusPage = lazy(() => import("@/views/claude/status"));
const GptStatusPage = lazy(() => import("@/views/gpt/status"));
const ApiUsagePage = lazy(() => import("@/views/api-usage"));
const PolicyPage = lazy(() => import("@/views/policy"));
function Redirect({ to }: { to: string }) {
  const { search, hash } = useLocation();
  const { ip } = useParams();
  return (
    <Navigate
      replace
      to={{
        pathname: ip ? `${to}/${encodeURIComponent(ip)}` : to,
        search,
        hash,
      }}
    />
  );
}

function RedirectLookup({ view }: { view: "whois" | "ping" }) {
  const { search, hash } = useLocation();
  const params = new URLSearchParams(search);
  const q = params.get("q") ?? params.get("host") ?? "";
  const to = lookupLocation(q, q || view === "ping" ? view : undefined);
  return (
    <Navigate replace to={{ pathname: to.pathname, search: to.search, hash }} />
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="docs/api" element={<ApiUsagePage />} />
        <Route path="terms" element={<PolicyPage page="terms" />} />
        <Route path="privacy" element={<PolicyPage page="privacy" />} />
        <Route path="network/ip">
          <Route index element={<LookupPage />} />
          <Route path=":ip" element={<LookupPage />} />
        </Route>
        <Route path="network/whois" element={<RedirectLookup view="whois" />} />
        <Route path="network/subdomains" element={<SubdomainsPage />} />
        <Route path="network/ping" element={<RedirectLookup view="ping" />} />
        <Route path="network" element={<ToolLayout group="network" />}>
          <Route index element={<Navigate replace to="/network/egress" />} />
          <Route
            path="connectivity"
            element={<Navigate replace to="/network/ip" />}
          />
          <Route path="egress" element={<EgressPage />} />
          {/* The merged observation deck replaced three sibling pages. */}
          <Route
            path="exits"
            element={<Navigate replace to="/network/egress" />}
          />
          <Route
            path="dns"
            element={<Navigate replace to="/network/egress?tab=dns" />}
          />
          <Route
            path="cdn"
            element={<Navigate replace to="/network/egress?tab=cdn" />}
          />
        </Route>
        <Route path="webrtc" element={<WebRtcPage />} />
        <Route path="browser/*" element={<Navigate replace to="/" />} />
        <Route path="ai" element={<ToolLayout group="ai" />}>
          <Route index element={<AiFleetBoard />} />
          <Route path="gpt" element={<GptPage />} />
          <Route path="claude" element={<ClaudePage />} />
          {aiPlatforms
            .filter((platform) => !["gpt", "claude"].includes(platform.id))
            .map((platform) => (
              <Route
                key={platform.id}
                path={platform.id}
                element={
                  <PlatformDiagnostics key={platform.id} platform={platform} />
                }
              />
            ))}
        </Route>
        <Route path="status">
          <Route index element={<StatusPage />} />
          <Route path="openai" element={<GptStatusPage />} />
          <Route path="claude" element={<ClaudeStatusPage />} />
        </Route>
        {Object.entries(legacyRoutes).map(([from, to]) => (
          <Route key={from} path={from} element={<Redirect to={to} />} />
        ))}
        <Route
          path="*"
          element={
            <section className="status-line">
              <h1>{t("404 · 页面不存在")}</h1>
              <Button variant="outline" asChild>
                <Link to="/">{t("返回首页")}</Link>
              </Button>
            </section>
          }
        />
      </Route>
    </Routes>
  );
}

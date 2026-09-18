import { createConcurrencyLimiter, endpoint } from "@/lib/network";

export interface ServiceStatus {
  status: { indicator: string; description: string };
  incidents?: {
    id: string;
    name: string;
    status: string;
    updated_at?: string;
    shortlink?: string;
  }[];
  components?: { id: string; name: string; status: string }[];
  fetchedAt: string;
  source: string;
}

/** Keep category expansion and manual refresh from opening a request storm. */
export const statusConcurrencyLimit = 6;
const statusLimiter = createConcurrencyLimiter(statusConcurrencyLimit);

export const getStatus = (id: string, signal?: AbortSignal) =>
  statusLimiter.run(signal, () =>
    endpoint<ServiceStatus>(`/status/${id}`, { signal }),
  );

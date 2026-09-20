# IP network tools

<p align="left">
  <img src="https://img.shields.io/badge/React-19-282C34?logo=react&amp;logoColor=61DAFB" alt="React 19" />
  <img src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&amp;logoColor=white" alt="Vite 8" />
  <img src="https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&amp;logoColor=white" alt="TypeScript 6" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-06B6D4?logo=tailwindcss&amp;logoColor=white" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/shadcn%2Fui-000000?logo=shadcnui&amp;logoColor=white" alt="shadcn/ui" />
  <img src="https://img.shields.io/badge/Lucide-F56565?logo=lucide&amp;logoColor=white" alt="Lucide" />
  <img src="https://img.shields.io/badge/Jotai-000000" alt="Jotai" />
  <img src="https://img.shields.io/badge/TanStack_Query-FF4154?logo=reactquery&amp;logoColor=white" alt="TanStack Query" />
  <img src="https://img.shields.io/badge/Cloudflare_Workers-F38020?logo=cloudflareworkers&amp;logoColor=white" alt="Cloudflare Workers" />
  <img src="https://img.shields.io/badge/pnpm-10-F69220?logo=pnpm&amp;logoColor=white" alt="pnpm 10" />
  <img src="https://img.shields.io/badge/Prettier-F7B93E?logo=prettier&amp;logoColor=black" alt="Prettier" />
</p>

A toolbox for IP lookups, network diagnostics and AI service status.

[中文](README.md) · **English**

[GitHub](https://github.com/uruana33/one-ip)

Click the button below for one-click deployment to Cloudflare.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https%3A%2F%2Fgithub.com%2Furuana33%2Fone-ip)

## Terminal and API

After deploying this version, use `GET /api/ip/health` without an API key:

```bash
# Explicit public IPv4, readable terminal output (local Worker requires ip)
curl -fsS 'http://127.0.0.1:8787/api/ip/health?ip=1.1.1.1&format=text'
# JSON (default)
curl -fsS 'http://127.0.0.1:8787/api/ip/health?ip=1.1.1.1'
# IPv6
curl -fsS 'http://127.0.0.1:8787/api/ip/health?ip=2606:4700:4700::1111&format=text'
```

Replace the hostname with your domain after deploying. Production can omit `ip`; the API then uses the caller address identified by Cloudflare. A proxy changes that egress address.

Returns `ip`, `checked_at`, `score`, `status`, location, ISP, ASN and `flags` (residential, datacenter, mobile, VPN, proxy, Tor, crawler, abuser). The trust score ranges from 0 to 100, higher is better. Matching the UI, 75–100 is `good`, 45–74 is `moderate`, below 45 is `poor`. Missing or invalid scores yield `score: null` and `status: "unknown"`; missing flags are `null`, not `false`.

`format` accepts `json` (default) or `text`. Errors always use JSON `{ "error": "…" }`: 400 for invalid input, 429 for rate limits, 503 when the caller IP is unavailable, and 502 for provider failures or mismatched IPs. Existing API rate limits apply; responses are not cached. This reports third-party IP reputation, not terminal speed tests, browser diagnostics or AI account availability.

## Deploy to Cloudflare

1. [Fork this project](https://github.com/uruana33/one-ip/fork) into your GitHub account.
2. Open the [Cloudflare dashboard](https://dash.cloudflare.com/), go to **Workers & Pages**, create a Worker and choose to import a Git repository.
3. Connect GitHub, select your `one-ip` fork and set the production branch to `main`.
4. Set the build command to `pnpm build` and the deploy command to `pnpm run deploy`. Use Node.js 24 and pnpm 10.32.1. Keep the default root directory.
5. Deploy and open the assigned `workers.dev` address. Use the Worker settings to connect a custom domain.

The project uses **Cloudflare Workers with Static Assets**. The `/api/*` routes need a Worker. Core features require no application environment variables or API keys.

For map access from mainland China, configure `TIANDITU_TOKEN` under Worker → Settings → Variables and Secrets (or run `pnpm exec wrangler secret put TIANDITU_TOKEN`). Maps prefer Tianditu and fall back to OpenStreetMap when unavailable; without the token, OpenStreetMap remains the default.

Workers Builds builds and deploys when `main` receives a commit. The button above points to this repository. Follow the steps to import your fork for your own deployment.

## Features

| Module             | Features                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview           | Domestic and external IPv4 probes, location, ISP, reputation and network classifications                                                                |
| IP details         | IPv4 / IPv6 lookups, ASN, CIDR, registration, network attributes, risk flags, location comparison and related addresses, subject to source availability |
| Egress observation | Compare website egress addresses, group sites by IP, inspect DNS resolver egress and CDN serving nodes                                                  |
| Global Ping        | Globalping probes, region and city selection, latency, packet loss and incremental results                                                              |
| DNS / CDN          | DNS resolver egress, CDN serving nodes and available cache metadata                                                                                     |
| WHOIS              | RDAP records for domains, IPs and ASNs, including raw responses                                                                                         |
| AI access          | ChatGPT, Claude, Grok, Perplexity, Gemini, DeepSeek, Qwen and Kimi resource probes, with egress comparisons where supported                             |
| Service status     | Official status feeds, incidents, maintenance, components and event details                                                                             |
| Usability          | Chinese / English, light / dark themes, mobile layouts and drawers, local lookup history, QR sharing and link copying                                   |

Some lookups rely on third-party services and may fail because of rate limits or CORS restrictions. HTTP timing isn't the same as ICMP Ping. IP classifications and reputation scores are references, not official decisions from AI platforms.

## Screenshots

IP addresses, detailed locations and ISP / ASN information have been redacted. Values are not live results.

![Desktop overview, redacted](docs/screenshots/desktop-home-redacted.png)

<table>
  <tr><th>Mobile · Light</th><th>Mobile · Dark</th></tr>
  <tr>
    <td><img src="docs/screenshots/mobile-home-light-redacted.png" alt="Redacted mobile light overview" width="360" /></td>
    <td><img src="docs/screenshots/mobile-home-dark-redacted.png" alt="Redacted mobile dark overview" width="360" /></td>
  </tr>
</table>

## Sync a fork

If you forked this repository, click **Sync fork → Update branch** on your GitHub repository page. Review differences if you have local changes, and resolve merge conflicts with a merge.

## GitHub Actions deployment (optional)

Choose Workers Builds or GitHub Actions to avoid duplicate deployments. Actions runs builds and tests by default. To enable deployment, add these settings to your repository's Actions configuration:

| Kind     | Name                    | Purpose                                              |
| -------- | ----------------------- | ---------------------------------------------------- |
| Variable | `ENABLE_CF_DEPLOY=true` | Enable deployment                                    |
| Secret   | `CLOUDFLARE_API_TOKEN`  | Worker deployment credentials for the target account |
| Secret   | `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare account ID                         |

Push to `main` or run `Build and deploy one-ip`. Deployment starts after builds and tests pass. External PRs run tests without deployment credentials. These credentials are used by CI.

## Local development and deployment

```bash
pnpm install --frozen-lockfile
pnpm worker:dev
```

Open `http://127.0.0.1:8787`. The command starts Vite and the local Worker with hot reload. The launcher sets `LOCAL_DEV=true` for the local process, with no changes to your Wrangler configuration.

```bash
pnpm build
pnpm test
pnpm lint

# Log in to Cloudflare and deploy
pnpm exec wrangler login
pnpm run deploy
```

`pnpm run deploy` uses the build output in `dist`; run `pnpm build` before deployment. `make deploy` updates the version, builds and deploys without a secrets file.

## Structure and data sources

- `src/app.css`: interface styles; `src/components/ui`: shadcn/ui components.
- `src/views`: network, AI and status pages; `public/worker`: Worker APIs.
- Net.Coffee: IP details. Available fields depend on the API response.
- Globalping: global measurements; IANA / RDAP: registration records; official platform status feeds: service status.

Issues and suggestions are welcome. Redact private information such as IPs, locations and fingerprint identifiers before sharing screenshots.

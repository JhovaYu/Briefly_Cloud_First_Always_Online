# Minimal EC2 Deployment Strategy for a Docker Compose Microservices Demo App

## Recommended EC2 architecture

For a 1‑week student demo, a single EC2 instance running Docker Compose with an HTTP reverse proxy is the simplest, lowest‑risk approach. All app services (three FastAPI backends and PostgreSQL) run as internal containers on a user‑defined Docker network, with only the reverse proxy’s HTTP/HTTPS ports exposed via the EC2 security group.[^1][^2]

The recommended stack:

- EC2 (t3.micro or t3.small, 1 instance) with Ubuntu or Amazon Linux.
- Docker + Docker Compose.
- Reverse proxy container (Caddy or Traefik) in front of your services.
- Static frontend built with Vite and served by the proxy.
- FastAPI services reachable only on the internal Docker network.
- PostgreSQL as a container with a named volume for data.

Caddy or Traefik is easier than bare Nginx for a quick demo because they can auto‑provision and renew Let’s Encrypt certificates and have simple reverse‑proxy configuration syntax, while Nginx usually requires separate Certbot and more complex configuration.[^3][^4][^1]

## HTTP vs HTTPS for the demo

Supabase Auth is designed to work with production URLs and commonly uses secure cookies and redirect validations; mis‑configured URLs are a frequent cause of being redirected back to localhost or the wrong origin. For a public demo on EC2, using HTTPS with a real domain and matching Supabase URL configuration avoids cookie/redirect issues and mirrors a real deployment.[^5][^6][^7][^8][^9]

Running plain HTTP on a raw IP can be made to work if you configure Supabase’s Site URL and Redirect URLs to use that exact `http://IP` origin, but this is brittle: any mismatch or later switch to HTTPS requires reconfiguration and can break email confirmation/password reset flows. For that reason, using an automatic HTTPS reverse proxy (Caddy or Traefik with Let’s Encrypt) with a cheap or free DNS domain is the safest option that still fits within a few hours of work.[^6][^7][^8][^4][^3][^1]

## Supabase URL configuration

Supabase’s Auth settings have a **Site URL** (default redirect) and a list of additional **Redirect URLs** used for OAuth flows and redirectTo parameters. For production, the Site URL should be set to your real HTTPS origin (for example `https://demo.yourdomain.com`), replacing the default `http://localhost:3000`.[^7][^8][^6]

Redirect URLs must list every origin and path that Supabase is allowed to redirect users back to, including wildcards for preview/local URLs when needed. Common patterns include `https://demo.yourdomain.com/**` for production and `http://localhost:5173/**` for Vite dev; these must match exactly what you pass as redirectTo in the frontend or what your auth helper library uses.[^8][^10][^6][^7]

For a simple student demo, email/password auth is usually easier than Google OAuth because it avoids configuring OAuth client IDs, authorized redirect URIs with the provider, and possible mismatch issues between Supabase and the provider’s console. OAuth works well but adds another place where incorrect redirect URLs can cause login failures.[^11][^9][^10]

## EC2 security group design

Security groups are stateful, allow‑only firewalls; if an inbound rule allows port 80 or 443, the corresponding response traffic is automatically permitted. For a single web server, best practice is to allow inbound 80 and 443 from the internet (`0.0.0.0/0`) and restrict SSH (22) to your own IP range.[^2][^12]

No database or internal service ports need to be exposed externally because all microservices and PostgreSQL communicate on the Docker network behind the reverse proxy. Outbound access can use the default "allow all" rule for simplicity during a short‑lived student project, or be tightened later if needed.[^12][^1][^2]

## PostgreSQL for a student demo

Running PostgreSQL as a Docker container with a named volume is sufficient for a short demo and avoids the cost and setup of RDS. A named volume or bind‑mounted directory on the EC2 instance ensures data persists across container restarts while keeping everything self‑contained on one host.[^1][^2]

For backups, a simple `pg_dump` to a file in the instance (optionally uploaded to S3) is enough for a 1‑week demo; RDS would be overkill unless the project needs managed backups, automatic failover, or long‑term production reliability.[^2][^1]

## Cost considerations and teardown

For a 1‑week demo, a small general‑purpose instance (t3.micro or t3.small) in a low‑cost region keeps compute costs minimal while still handling a handful of containers. Using a single instance with Docker Compose and no managed database or extra networking keeps the architecture simple and predictable in cost.[^12][^2]

Teardown is straightforward: stop or terminate the EC2 instance and delete any attached EBS volumes, and then remove DNS records pointing to the demo domain; security groups and key pairs can be reused or deleted as desired. Supabase itself is a managed service and can be left as‑is or have its project paused or removed once the demo is finished.[^2][^12]

## Nginx/Caddy/Traefik routing configuration

A minimal reverse proxy configuration needs to:

- Serve the static frontend on `/`.
- Proxy `/api/workspace` to the workspace FastAPI service.
- Proxy `/api/planning` to the planning service.
- Proxy `/api/collab` to the collaboration service.

With Traefik or Caddy, these routes are defined by host/path rules and backends pointing at containers on the internal Docker network. Nginx can accomplish the same pattern but will require explicit upstream and location blocks, whereas Caddy’s `reverse_proxy` directive or Traefik’s labels are higher‑level abstractions that reduce boilerplate.[^4][^13][^3][^1]

## Common pitfalls

Misconfigured Supabase Site URL or Redirect URLs often cause redirects to localhost or another unexpected origin, especially when the default `http://localhost:3000` is left in place. Incorrect use of `/auth/callback` versus `/auth/confirm` routes can also lead to invite/confirmation flows not returning to the intended page.[^14][^9][^10][^15][^5][^11][^7][^8]

On the infrastructure side, common issues include forgetting to open ports 80/443 in the security group, not binding the reverse proxy to `0.0.0.0`, or misconfiguring Docker networking so that the proxy cannot reach backend services. Path‑based reverse proxy rules must be tested to ensure they preserve or strip prefixes exactly as expected, otherwise backend routes may not match.[^13][^1][^12][^2]

Environment variable mistakes (such as wrong Supabase URL or anon key between dev and prod) and missing secrets files in the EC2 environment are another frequent cause of authentication and API failures. Vite’s build‑time environment variables require the correct `VITE_` prefixes and must be set at build time for the production frontend to send requests to the correct origin and API paths.[^6][^7][^8]

## Risk and mitigation table

| Area | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| Supabase URLs | Site URL left as localhost or missing redirect patterns | Logins redirect back to localhost or fail | Update Site URL to production domain and add Redirect URLs for all environments.[^6][^7][^8][^10] |
| HTTP vs HTTPS | Using plain HTTP or IP‑only URLs | Cookie/redirect issues, browser warnings | Use domain + HTTPS via Caddy or Traefik with Let’s Encrypt.[^3][^1][^4] |
| Security group | Ports 80/443 or 22 misconfigured | Service unreachable or SSH blocked | Allow 80/443 from world, restrict 22 to own IP range.[^2][^12] |
| Docker networking | Wrong network/ports in proxy config | 502/504 errors from proxy | Place all services and proxy on same Docker network and use container names as hosts.[^1][^13] |
| Reverse proxy paths | Incorrect path rewrite/prefix handling | Backend 404 or broken static assets | Use explicit path rules and test `/api/...` endpoints manually.[^1][^13] |
| Database persistence | Missing volume or backup | Data loss on container removal | Use named volumes and run `pg_dump` before teardown.[^1][^2] |
| Env/secrets | Incorrect Supabase URL/keys, missing VITE_ vars | Auth or API calls fail in prod | Store env in `.env` or SSM and ensure correct values at build time.[^6][^7] |

## 4‑hour implementation plan (today)

Within 4 hours, it is realistic to:

1. **Provision EC2 and base OS setup (45–60 minutes).**
   - Create a t3.micro or t3.small instance with a security group allowing 80/443 (and 22 from your IP).[^12][^2]
   - SSH in, install Docker and Docker Compose.

2. **Wire up Docker Compose with reverse proxy (60–90 minutes).**
   - Define services for workspace, planning, collaboration APIs, PostgreSQL, frontend, and proxy in `docker-compose.yml` using a shared Docker network.[^13][^1]
   - Choose Caddy or Traefik container and configure basic HTTP routing for `/`, `/api/workspace`, `/api/planning`, `/api/collab` to the respective containers.[^3][^4][^1][^13]

3. **Build and serve the frontend (45–60 minutes).**
   - Add a Dockerfile for the Vite frontend that builds static assets and serves them via the proxy (or a simple static file server behind the proxy).
   - Confirm that hitting the EC2 public IP in a browser shows the app and that API routes work.

4. **Configure Supabase for the demo (45–60 minutes).**
   - In Supabase Auth URL configuration, set Site URL to the EC2 origin (temporary) and add redirect URLs for `http://EC2-IP/**` and local dev.[^7][^8][^6]
   - Test email/password login end‑to‑end from another machine.

If time remains, begin setting up a domain (Route 53 or external DNS) and switch the Site URL/Redirect URLs to the HTTPS origin.

## 1‑week hardening and polish plan

Over the week before final delivery, incremental improvements can include:

1. **Add a domain and HTTPS (0.5–1 day).**
   - Purchase or reuse a domain, point a DNS record (A or CNAME) to the EC2 instance.
   - Configure Caddy or Traefik to obtain and renew a Let’s Encrypt certificate for that domain, and switch Supabase’s Site URL and Redirect URLs to `https://yourdomain`.[^4][^3][^1]

2. **Tighten security and secrets management (0.5 day).**
   - Restrict SSH to a specific IP range and consider disabling password login.
   - Move secrets (Supabase keys, DB password) into environment files or AWS SSM Parameter Store rather than hardcoding.[^2][^12]

3. **Improve monitoring and resilience (0.5 day).**
   - Add basic container healthchecks and restart policies in Docker Compose.[^1][^13]
   - Create a simple `pg_dump` backup script and, if desired, sync dumps to S3.

4. **Refine app behavior and Supabase flows (0.5–1 day).**
   - Verify all auth flows (sign‑up, login, reset, email confirmations) use correct redirect URLs and that multi‑environment behavior is correct.[^9][^10][^5][^8][^6][^7]
   - Optionally add Google OAuth once email/password is stable, updating provider redirect URIs to match Supabase’s configuration.[^10][^11][^9]

5. **Documentation and reproducibility (0.5 day).**
   - Write a README with `docker compose up` instructions, environment variable descriptions, and troubleshooting for common issues such as redirect problems or 502 from the proxy.

## Warnings and what not to do

- Do not expose FastAPI or PostgreSQL container ports directly in the EC2 security group or as published host ports; always front them with the reverse proxy and keep them on the internal Docker network.[^1][^2]
- Do not leave Supabase’s Site URL set to localhost when using a public EC2 demo; this is a leading cause of redirects back to local addresses.[^8][^10][^6][^7]
- Do not mix HTTP and HTTPS origins without updating Supabase and frontend configuration, as this can cause cookie, CORS, and redirect issues.[^6][^7]
- Do not hardcode secrets in the frontend or commit Supabase service keys to the repository; use environment variables and only expose the anon key in the browser.[^7][^6]
- Do not over‑engineer the deployment by introducing ECS or Kubernetes for a one‑week student demo; a single EC2 instance with Docker Compose is both simpler and less error‑prone for this scope.[^13][^1]

---

## References

1. [Setup Traefik Proxy in Docker Standalone](https://doc.traefik.io/traefik/setup/docker/) - This guide provides an in-depth walkthrough for installing and configuring Traefik Proxy within a Do...

2. [How to Set Up Security Groups for EC2 Instances - OneUptime](https://oneuptime.com/blog/post/2026-02-12-set-up-security-groups-for-ec2-instances/view) - Security groups are stateful. If you allow inbound traffic on port 80, the response traffic is autom...

3. [Why Choose Caddy Server instead Nginx? - LinkedIn](https://www.linkedin.com/pulse/why-choose-caddy-server-instead-nginx-usama-malik-rei8f) - Caddy: Automatically handles HTTPS out of the box, including certificate generation and renewal via ...

4. [Caddy vs Nginx: How Do These Web Servers / Reverse Proxies ...](https://www.reddit.com/r/selfhosted/comments/hur1hx/caddy_vs_nginx_how_do_these_web_servers_reverse/) - Caddy has automatic HTTPS with Let's Encrypt. Caddy has (arguably) easier and simpler configs. Nginx...

5. [Always redirects to localhost despite correct redirect URLs #26483](https://github.com/orgs/supabase/discussions/26483) - I keep being redirected to https://localhost:3000 despite having correctly set the production URLs i...

6. [Redirect URLs | Supabase Docs](https://supabase.com/docs/guides/auth/redirect-urls) - Looking for OAuth client redirect URIs? This guide covers redirect URLs for users signing into your ...

7. [Why am I being redirected to the wrong url when using ... - Supabase](https://supabase.com/docs/guides/troubleshooting/why-am-i-being-redirected-to-the-wrong-url-when-using-auth-redirectto-option-_vqIeO) - Why are redirects going to localhost instead of the production site URL? In order for the provided r...

8. [How can I add multiple Site URLs? · supabase · Discussion #1514](https://github.com/orgs/supabase/discussions/1514) - Under Authentication > Settings, there is an option to add a site URL. If I am doing local testing, ...

9. [Supabase Oauth redirect not working for localhost - Stack Overflow](https://stackoverflow.com/questions/78594750/supabase-oauth-redirect-not-working-for-localhost) - I'm trying to configure my app to redirect to the address: http://localhost:3000/home when the user ...

10. [Configuring Environment-Specific Redirect URLs in Next.js with ...](https://stackoverflow.com/questions/77757052/configuring-environment-specific-redirect-urls-in-next-js-with-supabase-auth) - To address this issue add http://localhost:3000/** to your redirect URLs in Supabase under URL confi...

11. [/auth/callback always redirects to localhost : r/Supabase - Reddit](https://www.reddit.com/r/Supabase/comments/1ehuwto/authcallback_always_redirects_to_localhost/) - It's a common issue cause by misconfigured authorized and callback URLs. Make sure your config.toml ...

12. [Mastering AWS Security Groups: Essential Best Practices - Wiz](https://www.wiz.io/academy/cloud-security/aws-security-groups-best-practices) - Secure your cloud environment with AWS security groups best practices. Learn how to protect and rein...

13. [Quick Start | Traefik | v2.0](https://doc.traefik.io/traefik/v2.0/getting-started/quick-start/) - Now you can launch Traefik! Start your reverse-proxy with the following command: docker-compose up -...

14. [Invite to Supabase Auth redirects to localhost:3000 #35443 - GitHub](https://github.com/supabase/supabase/issues/35443) - Go to any database · On the sidebar, click on 'Authentication' · Go to 'Users' under 'Manage' · Clic...

15. [Supabase Auth doesn't redirect to https://localhost:3000 · Issue #8085](https://github.com/supabase/supabase/issues/8085) - I'm using Next.js with Supabase Auth Helpers. After the auth, I need the users to be redirected back...


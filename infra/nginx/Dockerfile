FROM nginx:1.27-alpine

# Use the default nginx entrypoint which automatically runs envsubst on
# templates in /etc/nginx/templates/*.template, outputting to /etc/nginx/conf.d/
# This is the standard nginx way to handle environment variable substitution.

# Build context is repo root (.), not infra/nginx/
# This Dockerfile is referenced by docker-compose.ec2.yml as:
#   build:
#     context: .
#     dockerfile: infra/nginx/Dockerfile

# Copy nginx config template
COPY infra/nginx/nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy Vite static build output to serve the SPA frontend
# Build the frontend first: cd apps/desktop && npm run build
COPY apps/desktop/dist/ /usr/share/nginx/html/
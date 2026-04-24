FROM nginx:1.27-alpine

# Use the default nginx entrypoint which automatically runs envsubst on
# templates in /etc/nginx/templates/*.template, outputting to /etc/nginx/conf.d/
# This is the standard nginx way to handle environment variable substitution.

# Copy our template to the templates directory
# The default entrypoint will process it with envsubst automatically
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
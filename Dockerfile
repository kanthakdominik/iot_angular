# Frontend image: builds the Angular app and serves it with Caddy.
# Caddy also terminates HTTPS and proxies /api to the backend
# (the Caddyfile is mounted from iot_spring/deploy).

# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

# --- runtime stage ---
FROM caddy:2-alpine
COPY --from=build /app/dist/iot-angular/browser /srv

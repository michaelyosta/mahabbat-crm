# Mahabbat POS standalone gateway + web
# Build stage: compile standalone web (Vite) against src/pos-ui source
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS web-build
WORKDIR /app

COPY src ./mahabbat-app/src
COPY pos-standalone/web/package.json pos-standalone/web/package-lock.json ./mahabbat-app/pos-standalone/web/
COPY pos-standalone/web/index.html pos-standalone/web/vite.config.ts ./mahabbat-app/pos-standalone/web/
COPY pos-standalone/web/src ./mahabbat-app/pos-standalone/web/src

WORKDIR /app/mahabbat-app/pos-standalone/web
# standalone web has a bounded, exact npm lock so Docker and local package builds agree
RUN npm ci
RUN npm run build

# Runtime stage: Node gateway serving /api + static (no extra npm install)
FROM node:24-alpine@sha256:ebfe2f90462722a7a4de65e91990e97fe0d401c70e0e762c5b53302f905ec1c1 AS runtime
WORKDIR /app
COPY --from=web-build /app/mahabbat-app/pos-standalone/dist-web ./dist-web
COPY pos-standalone/server ./server
ENV NODE_ENV=production
ENV POS_STATIC_DIR=/app/dist-web
ENV POS_GATEWAY_PORT=3100
EXPOSE 3100
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD node -e "fetch('http://localhost:'+ (process.env.POS_GATEWAY_PORT||3100)+'/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/gateway.mjs"]

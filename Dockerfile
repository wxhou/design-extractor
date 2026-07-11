# === 阶段1: 安装依赖 ===
FROM node:20-slim AS deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    chromium \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

# === 阶段2: 构建 ===
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /usr/bin/chromium /usr/bin/chromium
COPY --from=deps /usr/lib/chromium /usr/lib/chromium

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"
ENV NEXT_TELEMETRY_DISABLED=1

COPY . .

RUN rm -rf .next && npm run build

# 复制静态文件到 standalone 目录
RUN cp -r .next/static .next/standalone/.next/ 2>/dev/null || mkdir -p .next/standalone/.next && cp -r .next/static .next/standalone/.next/

# 复制 sql.js wasm 文件到 standalone 输出目录
RUN mkdir -p .next/standalone && \
    cp node_modules/sql.js/dist/sql-wasm.wasm .next/standalone/ && \
    mkdir -p .next/standalone/node_modules/sql.js/dist && \
    cp node_modules/sql.js/dist/sql-wasm.wasm .next/standalone/node_modules/sql.js/dist/

# === 阶段3: 运行 ===
FROM node:20-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    wget \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV CHROME_PATH=/usr/bin/chromium
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage"

# 复制构建产物（使用 root 用户避免权限问题）
COPY --from=builder /app/.next/standalone ./

# 复制 public 目录并创建可写目录
COPY --from=builder /app/public ./public
RUN mkdir -p ./public/screenshots

EXPOSE 3000

# Operators: after deploy, before serving auth features, run:
#   npm run migrate:auth  (requires TURSO_URL and TURSO_AUTH_TOKEN)

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
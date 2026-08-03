FROM node:20-slim

# Install Chromium dependencies for whatsapp-web.js (Puppeteer)
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    chromium \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use installed Chromium & set default PORT=5760
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PORT=5760

WORKDIR /app
# Force rebuild native modules (better-sqlite3)
COPY package*.json ./
RUN npm install --production && npm rebuild better-sqlite3 --build-from-source

COPY . .

EXPOSE 5760

CMD ["node", "server.js"]

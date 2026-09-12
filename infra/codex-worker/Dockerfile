FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates python3 make g++ ripgrep \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/cutaway
COPY package.json package-lock.json ./
RUN npm ci --include=optional \
    && ln -s /opt/cutaway/node_modules /node_modules
COPY worker.mjs ./
ENV PATH="/opt/cutaway/node_modules/.bin:${PATH}"
USER node
WORKDIR /workspace
ENTRYPOINT ["node", "/opt/cutaway/worker.mjs"]

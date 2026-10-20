# Tinted gateway. Node 24 runs the TypeScript sources directly (type stripping), so the image is the repo source plus
# locked dependencies: what you read on GitHub is what the TEE measures.
FROM node:24-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY src ./src
COPY scripts ./scripts
RUN mkdir -p /app/.data && chown -R node:node /app
USER node
EXPOSE 8787
CMD ["node", "src/gateway/server.ts"]

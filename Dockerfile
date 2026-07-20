FROM node:22-alpine

WORKDIR /app
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node backend ./backend

ENV NODE_ENV=production \
    TRANSLATION_SERVER_HOST=0.0.0.0 \
    TRANSLATION_SERVER_PORT=8787

USER node
EXPOSE 8787
CMD ["node", "backend/server.mjs"]

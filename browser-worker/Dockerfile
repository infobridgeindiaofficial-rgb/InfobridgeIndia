FROM node:24-bookworm-slim
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npx playwright install --with-deps chromium \
    && groupadd -g 10001 browser && useradd -u 10001 -g browser -m browser
COPY --chown=browser:browser . .
USER browser
EXPOSE 8090
CMD ["node", "server.js"]

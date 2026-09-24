FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
COPY models ./models
COPY public ./public
COPY tests ./tests
COPY scripts ./scripts
RUN npm test
ENV PORT=3000
EXPOSE 3000
CMD ["node","src/dashboard.mjs"]

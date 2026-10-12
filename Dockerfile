FROM node:22-alpine
WORKDIR /app

# Build an application image, not an integration-test environment.
# No DATABASE_URL build argument, ENV assignment or production secret.
COPY package.json ./
RUN npm install --omit=dev

COPY src ./src
COPY models ./models
COPY public ./public
COPY scripts ./scripts

# Tests are executed separately in isolated CI with disposable PostgreSQL.
# Never run npm test in the production Docker build.
ENV PORT=3000
EXPOSE 3000
CMD ["node","src/dashboard.mjs"]

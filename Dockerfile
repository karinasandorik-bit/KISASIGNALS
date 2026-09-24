FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY models ./models
COPY public ./public
COPY tests ./tests
RUN npm test
ENV PORT=3000
EXPOSE 3000
CMD ["node","src/dashboard.mjs"]
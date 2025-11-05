FROM node:20-alpine AS build
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl

COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

RUN npx prisma generate

COPY tsconfig.json ./
COPY tsconfig.test.json ./
COPY jest.config.ts ./
COPY src ./src

COPY tests ./tests
RUN npm test --silent

RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat openssl

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/dist ./dist
COPY package*.json ./

EXPOSE 7000

CMD ["sh", "-c", "node_modules/.bin/prisma migrate deploy && node dist/src/start.js"]

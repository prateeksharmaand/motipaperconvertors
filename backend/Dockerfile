FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled app
COPY --from=builder /app/dist ./dist

# Copy migration script, migration files, seeds and knexfile
# (needed at runtime for npm run migrate:latest and npm run seed)
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/knexfile.js ./knexfile.js
COPY --from=builder /app/knexfile.ts ./knexfile.ts

EXPOSE 3000
CMD ["node", "dist/src/index.js"]

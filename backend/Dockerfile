FROM node:20

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev || npm install --omit=dev

COPY src ./src

ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "start"]

FROM node:20 AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install || npm install

COPY index.html ./
COPY vite.config.mts ./
COPY src ./src
COPY public ./public
COPY tailwind.config.cjs postcss.config.cjs ./

RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

FROM node:22-alpine AS builder
RUN apk add --no-cache curl rust cargo
RUN curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM nginx:alpine
COPY --from=builder /app/build /var/www/mandelbrot/build
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

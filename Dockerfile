# Build Image
FROM node:10 as build-image

COPY . .

RUN npm install -g typescript
RUN npm install
RUN npm install @types/node
RUN npm install @types/micro
RUN tsc
RUN npm prune --production

# Production Image ~25MB
FROM alpine

COPY --from=build-image ./dist ./dist
COPY --from=build-image ./node_modules ./node_modules
COPY package.json ./package.json
RUN apk add --update nodejs

CMD [ "node", "dist/invoque-container.js" ]
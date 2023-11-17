FROM node:20-alpine

LABEL org.opencontainers.image.authors="morgyn@gmail.com"

WORKDIR /rustservergraphite

COPY index.mjs package.json ./

RUN npm install

CMD ["node", "index.mjs"]

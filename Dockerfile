FROM node:12-alpine

RUN mkdir /app
WORKDIR /app

COPY package.json package.json

RUN npm install && mv node_modules /node_modules

COPY . .

ENV CERT=
ENV ENTRYPOINT=
ENV ISSUER=
ENV SECRET=

CMD node main.js

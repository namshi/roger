FROM node:8

MAINTAINER Alessandro Nadalin "alessandro.nadalin@gmail.com"

# dev deps
RUN npm install -g nodemon \
    apt-get update && \
    apt-get install -y git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    find /var/log -type f | while read f; do echo -ne '' > $f; done; \
    mkdir /tmp/roger-builds \
        && mkdir /tmp/roger-builds/logs \
        && mkdir /tmp/roger-builds/tars \
        && mkdir /tmp/roger-builds/sources

COPY ./src/client/package.json /src/src/client/
COPY ./src/client/package-lock.json /src/src/client/
WORKDIR /src/src/client
RUN npm install

COPY ./package.json /src/
COPY ./package-lock.json /src/
WORKDIR /src
RUN npm install

COPY . /src

WORKDIR /src/src/client
RUN npm run build

COPY ./db /db

WORKDIR /src

EXPOSE 8080
CMD ["node", "src/index.js", "--config", "/config.yml"]

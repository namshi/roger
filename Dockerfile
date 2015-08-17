FROM node:0.12-slim

MAINTAINER Alessandro Nadalin "alessandro.nadalin@gmail.com"

# dev deps
RUN npm install -g nodemon
RUN apt-get update
RUN apt-get install -y git python
RUN apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    find /var/log -type f | while read f; do echo -ne '' > $f; done;

RUN mkdir /tmp/roger-builds /tmp/roger-builds/logs /tmp/roger-builds/tars /tmp/roger-builds/sources

COPY . /src

# build the client
WORKDIR /src/src/client
RUN npm install
RUN npm run build

# build the server
WORKDIR /src
RUN npm install

EXPOSE  6600
CMD ["node", "src/index.js", "--config", "/config.yml"]

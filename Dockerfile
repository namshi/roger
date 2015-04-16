FROM node:0.12-slim

MAINTAINER Alessandro Nadalin "alessandro.nadalin@gmail.com"

RUN mkdir /tmp/roger-builds

# dev deps
RUN npm install -g nodemon
RUN apt-get update && \
    apt-get install -y git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* && \
    find /var/log -type f | while read f; do echo -ne '' > $f; done;

COPY . /src
WORKDIR /src
RUN npm install

EXPOSE  6600
CMD ["node", "src/index.js", "--config", "/config.yml"]

FROM dockerfile/nodejs

MAINTAINER Alessandro Nadalin "alessandro.nadalin@gmail.com"

RUN mkdir /tmp/roger-builds

# dev deps
RUN npm install -g nodemon clusterjs
RUN apt-get install -y git

COPY . /src
WORKDIR /src
RUN npm install

EXPOSE  6600
CMD ["clusterjs", "src/index.js", "--config", "/config.yml"]

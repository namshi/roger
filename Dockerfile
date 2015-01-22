FROM dockerfile/nodejs

MAINTAINER Alessandro Nadalin "alessandro.nadalin@gmail.com"

RUN mkdir /projects

# dev deps
RUN npm install -g nodemon
RUN apt-get install -y git

COPY . /src
WORKDIR /src
RUN npm install

EXPOSE  3000
CMD ["node", "src/index.js", "--config", "some.yml"]

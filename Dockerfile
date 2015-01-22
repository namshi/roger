FROM dockerfile/nodejs

MAINTAINER Alessandro Nadalin "alessandro.nadalin@gmail.com"

RUN mkdir /projects

# dev deps
RUN npm install -g nodemon
RUN apt-get install -y git
RUN cd /projects && git clone https://github.com/tutumcloud/tutum-docker-mysql

COPY . /src
WORKDIR /src
RUN npm install

EXPOSE  3000
CMD ["node", "index.js"]

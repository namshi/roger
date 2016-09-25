<img align="right" width="160px" src="https://raw.githubusercontent.com/namshi/roger/master/bin/images/logo.png" />

# Roger

> A continuous integration and build server and for docker containers

Roger is a simple yet powerful build
server for docker containers: you will
only need to specify your configuration
and it will build your projects every time
you schedule a build or, for example,
open a pull request on github.

It is easy to deploy and comes with
built-in integration with platforms
like Github or the Docker Registry,
which means that you can build your
private repositories and push them to
the Docker Hub or your own private
registry out of the box.

![frontend](https://raw.githubusercontent.com/namshi/roger/master/bin/images/frontend.png)

Ready to hack?

* [installation](#installation)
* [configuration](#configuration-reference)
  * [configuring a project](#project-configuration)
  * [configuring the server](#server-configuration)
  * [configuring auth](#configuring-auth)
* [build hooks](#build-hooks)
  * [github](#github)
* [notification](#notifications)
  * [comments on Github pull requests](#pull-requests-on-github)
  * [email (Amazon SES)](#email-through-amazon-ses)
  * [slack (Builds Channel)](#notification-on-slack)
* [publishing](#publishing-artifacts)
  * [s3](#s3)
* [use different images for building and running your app](#use-different-images-for-building-and-running-your-app)
* [hooks](#hooks)
  * [after-build](#after-build)
* [Slim your images](#use-different-images-for-building-and-running)
* [APIs](#apis)
  * [get all projects](#listing-all-projects)
  * [get all builds](#listing-all-builds)
  * [get a build](#getting-a-build)
  * [start a build](#triggering-builds)
* [roger in production](#in-production)
* [why roger?](#why-did-you-build-this)
* [contributing](#contributing)
* [tests](#tests)

## Installation

Create a `config.yml` file for roger:

``` yaml
auth:
  dockerhub: # these credentials are only useful if you need to push to the dockerhub
    username: user # your username on the dockerhub
    email:    someone@gmail.com # your...well, you get it
    password: YOUR_DOCKERHUB_PASSWORD
  github: YOUR_GITHUB_TOKEN # General token to be used to authenticate to clone any project or comment on PRs (https://github.com/settings/tokens/new)
```

and run roger:

```
docker run -ti -p 8080:8080 \
-v /tmp/logs:/tmp/roger-builds/logs \
-v $(pwd)/db:/db \
-v /path/to/your/config.yml:/config.yml \
-v /var/run/docker.sock:/tmp/docker.sock \
namshi/roger
```

If roger starts correctly, you should see
something like:

```
2015-01-27T17:52:50.827Z - info: using config: {...}}
Roger running on port 8080
```

and you can open the web interface up
on your [localhost](http://localhost:8080).

Now, time for our first build: pick a project of yours,
on github, and add a `build.yml` file in the root of the
repo:

``` yaml
redis: # this is the name of your project
  registry: registry.company.com # your private registry, ie. 127.0.0.1:5000
```

then visit `http://localhost:8080/api/build?repo=URL_OF_YOUR_REPO`
(ie. `localhost:8080/api/build?repo=https://github.com/namshi/test-build`)
and you should receive a confirmation that the build has been
scheduled:

![build-sched](https://raw.githubusercontent.com/namshi/roger/master/bin/images/build-scheduled.png)

Now open the web interface, your docker build is running!

![build-frontend](https://raw.githubusercontent.com/namshi/roger/master/bin/images/build-frontend.png)

> Protip: if you do a docker-compose up in the root
> of roger, the dev environment for roger, including
> a local registry, starts on its own: you might want to
> use this if you are playing with Roger for the first
> time and you don't have a registry available at
> registry.company.com

## Configuration reference

### Project configuration

In your repos, you can specify a few different
configuration options, for example:

``` yaml
redis: # name of the project, will be the name of the image as well
  registry:   127.0.0.1:5001 # url of the registry to which we're gonna push
```

Want to push to the dockerhub?

``` yaml
redis: # if you don't specify the registry, we'll assume you want to push to a local registry at 127.0.0.1:5000
  registry:     dockerhub
```

Want to publish assets to S3? Run tests? Here's a full overview of what roger
can do with your project:

``` yaml
redis:
  dockerfilePath: some/subdir # location of the dockerfile, omit this if it's in the root of the repo
  registry:       127.0.0.1:5001
  revfile:        somedir # means roger will create a rev.txt file with informations about the build at this path
  after-build: # hooks to execute after an image is built, before pushing it to the registry, ie. tests
    - ls -la
    - npm test
  notify:
    - github
    - emailSes
    - slack
  publish:
    -
      to: s3
      copy: /src/build/public/ # this is the path inside the container
      bucket: my-bucket # name of the s3 bucket
      bucketPath: initial-path # the initial path, ie. s3://my-bucket/initial-path
      command: gulp build # optional: a command to run right before publishing (you might wanna build stuff here)
```

Want to build 2 projects from the same repo?

``` yaml
redis:
  dockerfilePath: src
redis-server:
  dockerfilePath: server/src
```

### Server configuration

Roger will read a `/config.yml` file that you
need to mount in the container:

``` yaml
app: # generic settings
  url: 'https://builds.yourcompany.com' # optional, just used for logging
  auth: ~ # authentication turned off by default, see next paragraph
builds:
  concurrent: 5 # max number of builds to run in parallel, use ~ to disable
  retry-after: 30 # interval, in seconds, for Roger to check whether it can start queued builds
auth: # authentication on various providers
  dockerhub: # these credentials are only useful if you need to push to the dockerhub
    username: odino # your username on the dockerhub
    email:    alessandro.nadalin@gmail.com # your...well, you get it
    password: YOUR_DOCKERHUB_PASSWORD
  github: YOUR_SECRET_TOKEN # General token to be used to authenticate to clone any project (https://github.com/settings/tokens/new)
notifications: # configs to notify of build failures / successes
  github: '{{ auth.github }}' # config values can reference other values, this will post a comment on an open PR
  emailSes: # sends an email through amazon SES
    accessKey: 1234
    secret: 5678
    region: eu-west-1
    to:
      - john.doe@gmail.com # a list of people who will be notified
      - committer # this is a special value that references the email of the commit author
    from: builds@company.com # sender email (needs to be verified on SES: http://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses.html)
docker:
  client: # here you can specify any option accepted by dockerode (https://github.com/apocas/dockerode#getting-started)
    # by default, we will try to connect to this socket, that is why we launch roger with -v /var/run/docker.sock:/tmp/docker.sock
    socketPath: '/tmp/docker.sock'
    # you can specify host, port, protocol...
    host: __gateway__ # this is a special value that will resolve to the gateway through netroute (http://npmjs.org/package/netroute)
    port: 2375
    protocol: http
```

### Configuring auth

Roger comes with no authentication: all its
routes are public and everyone with access to
roger can trigger builds and see everything.

Since everyone has different needs, we want to
let you specify the auth mechanism of your
choice, based on [passport](http://passportjs.org/).

Just define an auth provider in roger's config:

``` yaml
app:
  auth:
    provider: '/auth/myProvider.js'
```

At this point, mount your provider when launching
the container with `-v mycode/auth:/auth`: Roger will
dynamically load your own module and import it in
the app.

The `myProvider.js` module needs to expose a function
that accepts an app and register its own auth mechanism:
it sounds more complicated than it is, so I'll just
forward you to the [example provider](https://github.com/namshi/roger/blob/master/examples/auth/local.js).

## Use different images for building and running your app

Ever felt like your images are too chubby?

Deploying the same image you use for development and building
often carries expendable `stuff` with it.

An example might be compass: css-ninjias love
their scss files but we end up with an images full of
ruby we might not really need.

You can easilly instruct Roger to use a specific
building image, extract the result and package it up in a slimmer one!

Simply add the `build` section to the fatty project in your `build.yml`

```yml
  project:
    build:
      dockerfile: dockerfile.build
      extract: /src
```

Roger will than use `dockerfile.build` as dockerfile for the building image,
extract the content of `/src` and repack it in a slimmer image as defined
by the usuale Dockerfile (you need to provide you own build and slim Dockerfile ;)).

For example this could be your regular `Dockerfile`:

```
FROM alpine:edge

MAINTAINER you@gmail.com

RUN apk add --update nodejs='=4.1.1-r0' && rm -rf /var/cache/apk/*

COPY . /src
WORKDIR /src

EXPOSE 8080

CMD ["node", "src/app.js"]
```

while the `Dockerfile.build` could look like this:

```
FROM node:latest

MAINTAINER you@gmail.com

RUN apt-get update
RUN apt-get install -y ruby-full build-essential
RUN gem install sass compass --no-ri --no-rdoc

RUN npm install -g gulp nodemon
RUN npm install -g gulp bower
RUN npm install -g gulp mocha

COPY . /src
WORKDIR /src

RUN npm install && \
    bower install --allow-root && \
    gulp sass
```

So that the `build.yml` would look like this:

``` yaml
myProject:
  build:
    dockerfile: Dockerfile.build
    extract: /src
```

## Build hooks

Roger exposes a simple HTTP interface
and provides integration with some SCM
provider, ie. GitHub.

### Github

Simply add a new webhook to your repo at
`https://github.com/YOU/YOUR_PROJECT/settings/hooks/new`
and configure it as follows:

![github webhook](https://raw.githubusercontent.com/namshi/roger/master/bin/images/webhook.png)

Roger will build everytime you push to
github, a new tag is created or you
comment on a PR with the text `build please!`.

## Notifications

Once your build finishes, you can notify
*someone* about its result (ie. success / failure).

### Pull requests on Github

This notification lets you update the status of a PR
by commenting on it.

![comment on pull requests](https://raw.githubusercontent.com/namshi/roger/master/bin/images/notification-github.png)

If you have a PR from the branch `my-patch`
open and roger is building that branch, it
will then update the PR accordingly.

``` yaml
my-project:
  notify:
    - github
```

### Email (through Amazon SES)

If you want to receive notifications
via email, you can simply configure
the `emailSes` handler that will
send emails through [Amazon SES](http://aws.amazon.com/ses/).

![ses notifications](https://raw.githubusercontent.com/namshi/roger/master/bin/images/notification-ses.png)

``` yaml
my-project:
  branch:       master
  from:         https://github.com/me/awesome-project
  notify:
    - emailSes
```

and then in roger's `config.yml`:

``` yaml
notifications:
  emailSes:
    accessKey: 1a2b3c4d5e6f
    secret: 1a2b3c4d5e6f
    region: eu-west-1
    to:
      - committer
      - someone@yourcompany.com
    from: admin@namshi.com
```

Note that:

* the `from` address needs to be
[verified on SES](http://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses.html)
* `committer` is a special value that represents the committer's email

### Notification on Slack
Once the build is complete, it pushes a notification to a slack channel mentioned in the config
![slack channel notification](https://raw.githubusercontent.com/namshi/roger/master/bin/images/notification-slack.png)

To enable slack notification for individual projects the build.yml file can be updated with the slack parameter in the notification block:

``` yaml
my-project:
  branch:       master
  from:         https://github.com/me/awesome-project
  notify:
    - slack
```

for enabling slack notification for all the projects, the base.yml can be updated as:

```
notifications:
  slack:
    global: 'true'
    channel: '#channel-name'
    icon_emoji: ':slack-emoji:'
    username: 'Roger'
```

## Publishing artifacts

Roger provides some ways to upload your build to
some supported providers.

### S3

You can upload stuff from your container to an S3
bucket by simply specifying the following in your
project configuration:

``` yaml
myproject:
  publish:
    -
      to: s3
      copy: /src/build/public/ # this is the path inside the container
      bucket: my-bucket # name of the s3 bucket
      bucketPath: initial-path # the initial path, ie. s3://my-bucket/initial-path
      command: gulp build # optional: a command to run right before publishing (you might wanna build stuff here)
```

Then just store the s3 credentials in roger's `config.yml`:

``` yaml
publishers:
  s3:
    key: 1a2b3c4d5e6f
    secret: 1a2b3c4d5e6f
```

What happens is that we're gonna run a container
with the image we just built, then copy a directory
outside of the container (yes, to the host machine)
and then upload that to S3.

## Hooks

Roger has the concept of hooks, which are
commands that you can run at certain steps
of the build.

### after-build

After an image is built, you can run as many
hooks as you want **in a container running
that specific image**; this means that if you
want to run the tests of your applications you
will most likely configure the project as follows:

``` yaml
my-node-app:
  registry: registry.company.com
  after-build:
    - npm test
```

That is it! Now, after an image is built, before
tagging it and sending it to the registry, roger
will run `npm test` in your container and, if the
tests fail, will stop the build.

Neat, ah?

## APIs

### Listing all projects

`/api/projects` will return you the latest
10 projects that were updated (added on roger,
a build was triggered, etc).

You can customize the number of projects you will
get back by adding a `limit` parameter to the
query string.

``` json
{
    "projects": [
        {
            "name": "https://github.com/company/redis__redis-server",
            "alias": "redis-server (company/redis)",
            "latest_build": {
                "branch": "patch-1",
                "project": "https://github.com/company/redis__redis-server",
                "status": "passed",
                "id": "0715a3b5-43fe-4d07-9705-82641db07c25-redis-server",
                "tag": "registry.company.com/redis-server:patch-1",
                "created_at": "2015-07-02T08:44:28+00:00",
                "updated_at": "2015-07-02T08:45:09+00:00"
            }
        },
        ...
    ]
}
```

### Listing all builds

`/api/builds` will return you the latest
10 builds roger ran. You can customize the
number of builds you will get back by adding
a `limit` parameter to the query string.

### Getting a build

`/api/builds/BUILD_ID` will return you the
details of a build:

``` json
{
    "build": {
        "branch": "patch-1",
        "project": "https://github.com/company/redis__redis",
        "status": "passed",
        "id": "0715a3b5-43fe-4d07-9705-82641db07c25-redis",
        "tag": "registry.company.com/redis:patch-1",
        "created_at": "2015-07-02T08:44:28+00:00",
        "updated_at": "2015-07-02T08:45:09+00:00"
    }
}
```

If you add `/log` at the end of the URL (ie. `/api/builds/1234/log`)
you will be streamed the log output of that build:

```
2015-01-27T19:18:34.810Z - info: [127.0.0.1:5000/redis:patch-1] Scheduled a build of cb5ea16d-5266-4018-b571-954e75b825e0
2015-01-27T19:18:34.810Z - info: Cloning https://github.com/namshi/redis:patch-1 in /tmp/roger-builds/sources/cb5ea16d-5266-4018-b571-954e75b825e0
2015-01-27T19:18:34.816Z - info: git clone https://github.com/namshi/redis: Cloning into '/tmp/roger-builds/sources/cb5ea16d-5266-4018-b571-954e75b825e0'...

2015-01-27T19:18:37.274Z - info: [127.0.0.1:5000/redis:patch-1] Created tarball for cb5ea16d-5266-4018-b571-954e75b825e0
2015-01-27T19:18:37.365Z - info: Build of 127.0.0.1:5000/redis:patch-1 is in progress...
2015-01-27T19:18:37.365Z - info: [127.0.0.1:5000/redis:patch-1] Step 0 : FROM dockerfile/redis

2015-01-27T19:18:37.365Z - info: [127.0.0.1:5000/redis:patch-1]  ---> c08280595650
...
...
...
```

### Triggering builds

You can simply issue a GET request to the endpoint
`/api/v2/build?repo=REPO_URL&branch=BRANCH`.

For example, both of these URLs are valid endpoints:

* `/api/build?repo=https://github.com/redis/redis`
* `/api/build?repo=https://github.com/redis/redis&branch=master`

If you don't specify a branch, `master`
will be used.

The same endpoint supports `POST` requests as well, `GET`
should only really be used for debugging or so
([here's why](http://www.looah.com/source/view/2284)).

You can also specify [docker options](https://docs.docker.com/reference/api/docker_remote_api_v1.17/#build-image-from-a-dockerfile) in your request,
ie. if you want the build to run with the `--no-cache` flag
just call `/api/build?repo=https://github.com/redis/redis&options[nocache]=true`.

## In production

Every container (even Roger itself) at [Namshi](https://github.com/namshi)
gets built through Roger: we have been running it, behind our own firewall,
for the past 6 months or so and had no issues with it; whenever our engineers
push to github Roger builds the project and pushes it to our private registry,
often in a matter of seconds.

## Why did you build this?

Good question, especially since we hate to re-invent the wheel!

Roger was built since, at the very beginning of our experience
with Docker, there were no decent SaaS that could run Docker
builds in a matter of seconds: we first tried the DockerHub
and it could even take up to 15 minutes to get a build done, which was
frustrating. We wanted new images to be available in seconds.
At the same time, neither Travis-CI, CodeShip nor Drone.io
seemed to have a tight and nice integration with Docker
(though some of them have made giant steps over the past few
months so...who knows what we're gonna be using in a year!).

Thus, one day, we decided to try [dockerode](https://github.com/apocas/dockerode)
out and see if we could hack a Docker builder in a couple
evenings. The idea of running Roger in its own container,
sharing the docker socket, comes from the
[nginx proxy container](https://github.com/jwilder/nginx-proxy#usage).

At the beginning, Roger only ran via its APIs: once we
started flirting with the idea of making it public,
we decided to take some time off and build a small
frontend with ReactJS, as an experiment -- part of the
[perks of working at Namshi](http://tech.namshi.com/join-us/) ;-)

Roger has been running without problems for a few months,
and we're pretty happy with it.

## Contributing

You can easily hack on roger by simply cloning
this repository and then running:

```
docker-compose build
docker-compose run server npm install
docker-compose run server bash -c "cd src/client && npm install && npm run build"
docker-compose up
```

and you will have the roger server and a simple docker registry
running on your localhost.

When you trigger a build, you should see something
like:

```
~  ᐅ docker ps
CONTAINER ID        IMAGE                 COMMAND                CREATED             STATUS              PORTS                              NAMES
12e1d7e6d260        roger_server:latest   "nodemon /src/src/in   4 minutes ago       Up 4 minutes        3000/tcp, 0.0.0.0:5000->5000/tcp   roger_server_1
e3bf2bfa935e        registry:latest       "docker-registry"      4 minutes ago       Up 4 minutes        0.0.0.0:5001->5000/tcp             roger_registry_1
~  ᐅ docker logs -f --tail=0 12e1d7e6d260
2015-01-23T14:53:29.610Z - info: Scheduled a build of 127.0.0.1:5001/redis:master
2015-01-23T14:53:29.610Z - info: Cloning https://github.com/dockerfile/redis:master in /tmp/roger-builds/sources/redis/1422024809
2015-01-23T14:53:32.807Z - info: Finished cloning https://github.com/dockerfile/redis:master
2015-01-23T14:53:32.820Z - info: created tarball for 127.0.0.1:5001/redis:master
2015-01-23T14:53:32.897Z - info: Build of 127.0.0.1:5001/redis:master is in progress...
2015-01-23T14:53:32.897Z - info: [127.0.0.1:5001/redis:master] Step 0 : FROM dockerfile/ubuntu

2015-01-23T14:53:32.897Z - info: [127.0.0.1:5001/redis:master]  ---> 57d0bc345ba9

2015-01-23T14:53:32.897Z - info: [127.0.0.1:5001/redis:master] Step 1 : RUN cd /tmp &&   wget http://download.redis.io/redis-stable.tar.gz &&   tar xvzf redis-stable.tar.gz &&   cd redis-stable &&   make &&   make install &&   cp -f src/redis-sentinel /usr/local/bin &&   mkdir -p /etc/redis &&   cp -f *.conf /etc/redis &&   rm -rf /tmp/redis-stable* &&   sed -i 's/^\(bind .*\)$/# \1/' /etc/redis/redis.conf &&   sed -i 's/^\(daemonize .*\)$/# \1/' /etc/redis/redis.conf &&   sed -i 's/^\(dir .*\)$/# \1\ndir \/data/' /etc/redis/redis.conf &&   sed -i 's/^\(logfile .*\)$/# \1/' /etc/redis/redis.conf

2015-01-23T14:53:33.285Z - info: [127.0.0.1:5001/redis:master]  ---> Using cache

2015-01-23T14:53:33.286Z - info: [127.0.0.1:5001/redis:master]  ---> 26bc665c9295

2015-01-23T14:53:33.286Z - info: [127.0.0.1:5001/redis:master] Step 2 : VOLUME /data

2015-01-23T14:53:33.645Z - info: [127.0.0.1:5001/redis:master]  ---> Using cache

2015-01-23T14:53:33.645Z - info: [127.0.0.1:5001/redis:master]  ---> 6e4b36e3b7b6

2015-01-23T14:53:33.645Z - info: [127.0.0.1:5001/redis:master] Step 3 : WORKDIR /data

2015-01-23T14:53:34.007Z - info: [127.0.0.1:5001/redis:master]  ---> Using cache

2015-01-23T14:53:34.008Z - info: [127.0.0.1:5001/redis:master]  ---> 9baac5d2adc3

2015-01-23T14:53:34.008Z - info: [127.0.0.1:5001/redis:master] Step 4 : CMD redis-server /etc/redis/redis.conf

2015-01-23T14:53:34.341Z - info: [127.0.0.1:5001/redis:master]  ---> Using cache

2015-01-23T14:53:34.341Z - info: [127.0.0.1:5001/redis:master]  ---> 3910333848f1

2015-01-23T14:53:34.341Z - info: [127.0.0.1:5001/redis:master] Step 5 : EXPOSE 6379

2015-01-23T14:53:34.690Z - info: [127.0.0.1:5001/redis:master]  ---> Using cache

2015-01-23T14:53:34.691Z - info: [127.0.0.1:5001/redis:master]  ---> 36c9365e8364

2015-01-23T14:53:34.692Z - info: [127.0.0.1:5001/redis:master] Successfully built 36c9365e8364

2015-01-23T14:53:34.693Z - info: Image 127.0.0.1:5001/redis:master built succesfully
2015-01-23T14:53:34.714Z - info: Docker confirmed the build of 127.0.0.1:5001/redis:master, author , created on 2015-01-23T01:29:49.039114234Z on docker 1.4.1
2015-01-23T14:53:34.714Z - info: Tagging 127.0.0.1:5001/redis:master
2015-01-23T14:53:34.723Z - info: Pushing 127.0.0.1:5001/redis:master to 127.0.0.1:5001
2015-01-23T14:53:36.852Z - info: [127.0.0.1:5001/redis:master] The push refers to a repository [127.0.0.1:5001/redis] (len: 1)
2015-01-23T14:53:36.897Z - info: [127.0.0.1:5001/redis:master] Sending image list
2015-01-23T14:53:37.037Z - info: [127.0.0.1:5001/redis:master] Pushing repository 127.0.0.1:5001/redis (1 tags)
2015-01-23T14:53:37.067Z - info: [127.0.0.1:5001/redis:master] Image 511136ea3c5a already pushed, skipping
2015-01-23T14:53:37.070Z - info: [127.0.0.1:5001/redis:master] Image 53f858aaaf03 already pushed, skipping
2015-01-23T14:53:37.073Z - info: [127.0.0.1:5001/redis:master] Image 837339b91538 already pushed, skipping
2015-01-23T14:53:37.078Z - info: [127.0.0.1:5001/redis:master] Image 615c102e2290 already pushed, skipping
2015-01-23T14:53:37.080Z - info: [127.0.0.1:5001/redis:master] Image b39b81afc8ca already pushed, skipping
2015-01-23T14:53:37.084Z - info: [127.0.0.1:5001/redis:master] Image 5aa9da73df5b already pushed, skipping
2015-01-23T14:53:37.086Z - info: [127.0.0.1:5001/redis:master] Image ec4206da3b16 already pushed, skipping
2015-01-23T14:53:37.089Z - info: [127.0.0.1:5001/redis:master] Image e00f3af60b33 already pushed, skipping
2015-01-23T14:53:37.095Z - info: [127.0.0.1:5001/redis:master] Image e0a769f35586 already pushed, skipping
2015-01-23T14:53:37.099Z - info: [127.0.0.1:5001/redis:master] Image f6060d642297 already pushed, skipping
2015-01-23T14:53:37.104Z - info: [127.0.0.1:5001/redis:master] Image 17eef17d52cf already pushed, skipping
2015-01-23T14:53:37.112Z - info: [127.0.0.1:5001/redis:master] Image 57d0bc345ba9 already pushed, skipping
2015-01-23T14:53:37.118Z - info: [127.0.0.1:5001/redis:master] Image 26bc665c9295 already pushed, skipping
2015-01-23T14:53:37.124Z - info: [127.0.0.1:5001/redis:master] Image 6e4b36e3b7b6 already pushed, skipping
2015-01-23T14:53:37.131Z - info: [127.0.0.1:5001/redis:master] Image 9baac5d2adc3 already pushed, skipping
2015-01-23T14:53:37.138Z - info: [127.0.0.1:5001/redis:master] Image 3910333848f1 already pushed, skipping
2015-01-23T14:53:37.146Z - info: [127.0.0.1:5001/redis:master] Image 36c9365e8364 already pushed, skipping
2015-01-23T14:53:37.146Z - info: [127.0.0.1:5001/redis:master] Pushing tag for rev [36c9365e8364] on {http://127.0.0.1:5001/v1/repositories/redis/tags/master}
2015-01-23T14:53:37.202Z - info: Pushed image 127.0.0.1:5001/redis:master to the registry at http://127.0.0.1:5001
2015-01-23T14:53:37.203Z - info: Finished build of 127.0.0.1:5001/redis:master in a few seconds #SWAG
```

Problems? [Open an issue](https://github.com/namshi/roger/issues)! Suggestions? Feel free
to [send a PR](https://github.com/namshi/roger/pulls)!

## Tests

There are currently no automated tests and it's
a shame :)

As of now we didn't find a good way / method to
run the whole server and check how it behaves in
different scenarios in an automated way, as all
tests are manually ran at the moment. Unit-testing
the various scripts under `src` would be simple
enough but the problem is that you should ensure
that the whole server runs fine, doesn't crash,
etc etc.

If you have a suggestion or would like to create
a spike feel **uberfree** to do so, as we believe
that, to go further, automated tests are always
a must.

## TODO

* client
  * wall (use query parameters to include / exclude projects)
* build tracking
  * persist to SQLite
  * mount sqlite

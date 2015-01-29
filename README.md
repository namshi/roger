<img align="right" width="160px" src="https://openclipart.org/image/800px/svg_to_png/12949/Anonymous-man-face.png" />

# Roger

> A build server for docker containers

Roger is a simple yet powerful build
server for docker containers: you will
only need to specify your configuration
and it will build your projects everytime
you schedule a build or, for example,
open a pull request on github.

It is easy to deploy and comes with
built-in integration with platforms
like Github or the Docker Registry,
which means that you can build your
private repositories and push them to
the Docker Hub or your own private
registry out of the box.

Ready to hack?

## Installation

Create a configuration file, `config.yml`:

``` yaml
projects:
  redis:
    branch:       master
    from:         https://github.com/dockerfile/redis
    registry:     127.0.0.1:5000
```

then you can clone and run roger:

```
git clone git@github.com:namshi/roger.git

cd roger

docker build -t namshi/roger .

docker run -ti -p 6600:6600 -v /path/to/your/config.yml:/config.yml -v /var/run/docker.sock:/tmp/docker.sock namshi/roger
```

If roger starts correctly, you should see
something like:

```
2015-01-27T17:52:50.827Z - info: using config: {...}}
Roger running on port 6600
```

## Configuration

Roger will read a `/config.yml` file that you
need to mount in the container:

``` yaml
app: # generic settings
  url: 'https://builds.yourcompany.com' # optional, just used for logging
auth: # authentication on various providers
  dockerhub: # these credentials are only useful if you need to push to the dockerhub
    username: odino # your username on the dockerhub
    email:    alessandro.nadalin@gmail.com # your...well, you get it
    password: YOUR_DOCKERHUB_PASSWORD --> see https://github.com/namshi/roger#sensitive-data
  github: YOUR_SECRET_TOKEN # General token to be used to authenticate to clone any project (https://github.com/settings/tokens/new)
projects: # list of projects that are gonna be built within the app
  nginx-pagespeed: # name of the project, will be the name of the image as well
    branch:     master # default branch to build from, optional
    from:       https://github.com/namshi/docker-node-nginx-pagespeed # url of the git repo
    registry:   127.0.0.1:5001 # url of the registry to which we're gonna push, only support private registries for now
    after-build: # hooks to execute after an image is built, before pushing it to the registry, ie. tests
      - ls -la
      - sleep 1
    notifications: # configs to notify of build failures / successes
      github: # will post a comment on an open PR
        token: YOUR_GITHUB_TOKEN
      email-ses: # sends an email through amazon SES
        access-key: YOUR_ACCESS_KEY
        secret: YOUR_SECRET_KEY
        region: YOUR_SES_REGION
        to: # a list of people who will be notified
          - you@example.org
        from: admin@example.org # sender email (needs to be verified on SES: http://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses.html)
  redis: # if you don't specify the registry, we'll assume you want to push to the dockerhub
    branch:       master
    from:         https://github.com/dockerfile/redis
  privaterepo: # a private project
    branch:         master
    from:           https://github.com/odino/secret
    dockerfilePath: some/subdir # location of the dockerfile, omit this if it's in the root of the repo
    github-token:   YOUR_SECRET_TOKEN # project-specific github oauth token (https://github.com/settings/tokens/new)
    registry:       127.0.0.1:5001
```

### Sensitive data

You can also configure the app from environment
variables, which means that in case of sensitive
information like Github OAuth tokens you might
not want to store them directly in the config
file.

The format of these environment variables is
`ROGER_CONFIG_underscore_separated_path_in_your_configuration`,
ie. `ROGER_CONFIG_projects_private-repo_github-token=MY_SECRET_TOKEN`.

For example, you can start roger specifying the
oauth tokens for each project:

```
docker run -ti -e ROGER_CONFIG_projects_private-repo_github-token=MY_SECRET_TOKEN -p 8000:5000 roger
```

Avoid using underscores in config keys, we are trying
to fix this in the [library we use to parse the configuration](https://github.com/namshi/reconfig/issues/15).

## Build triggers

Roger exposes a simple HTTP interface
and provides integration with some SCM
provider, ie. GitHub.

### Github

Simply add a new webhook to your repo at
`https://github.com/YOU/YOUR_PROJECT/settings/hooks/new`
and configure it as follows:

![github webhook](https://raw.githubusercontent.com/namshi/roger/master/bin/images/webhook.png?token=AAUC5KUrL2asRgmAob6t_Lxp0XVB_LCmks5U0MHgwA%3D%3D)

Roger will now that the hook refers to a
particular project because it matches the
repository name with the `from` parameter
of your project:

``` yaml
# Your repo full name is hello/world

projects:
  hello-world:
    branch:     master
    from:       https://github.com/hello/world # we are matching this
```

Roger will build everytime you push to
github or a new tag is created.

## Notifications

Once your build finishes, you can notify
*someone* about its result (ie. success / failure).

### Pull requests on Github

This notification lets you update the status of a PR
by commenting on it.

![comment on pull requests](https://raw.githubusercontent.com/namshi/roger/master/bin/images/notification-github.png?token=AAUC5O20LTEbpPUwbL_Nwk4yQwUHR1HQks5U01WTwA%3D%3D)

If you have a PR from the branch `my-patch`
open and roger is building that branch, it
will then update the PR accordingly.

``` yaml
my-project:
  branch:       master
  from:         https://github.com/me/awesome-project
  github-token: YOUR_SECRET_TOKEN
  notifications:
    github: YOUR_SECRET_TOKEN
```

### Email (through Amazon SES)

If you want to receive notifications
via email, you can simply configure
the `email-ses` handler that will
send emails through [Amazon SES](http://aws.amazon.com/ses/).

![ses notifications](https://raw.githubusercontent.com/namshi/roger/master/bin/images/notification-ses.png?token=AAUC5L9Lk4x65t7ttfcE1htsbWOkfgnuks5U09A4wA%3D%3D)

``` yaml
my-project:
  branch:       master
  from:         https://github.com/me/awesome-project
  github-token: YOUR_SECRET_TOKEN
  notifications:
    email-ses:
      access-key: 123456
      secret:     1a2b3c4d5e6f
      region:     eu-west-1
      to: 
        - you@example.org
        - build-status@example.org
      from: roger@example.org
```

The `from` address needs to be
[verified on SES](http://docs.aws.amazon.com/ses/latest/DeveloperGuide/verify-email-addresses.html).

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

```
my-node-app:
  branch:   master
  from:     https://github.com/me/my-node-app
  registry: hub.docker.io
  after-build:
    - npm test
```

That is it! Now, after an image is built, before
tagging it and sending it to the registry, roger
will run `npm test` in your container and, if the
tests fail, will stop the build.

Neat, ah?

## APIs

### List projects

You can get a list of projects at
`/api/projects/` or of a specific
project at `/api/projects/{project}`, ie.
`/api/projects/redis/`

``` json
# GET /api/projects/redis
{
    "branch":   "master",
    "from":     "https://github.com/dockerfile/redis",
    "name":     "redis",
    "registry": "odino"
}
```

### Triggering builds

You can simply issue a POST request to the endpoint
`/api/projects/{project}[:{branch}]/build`.

For example, both of these URLs are valid endpoints:

* `/api/projects/redis/build`
* `/api/projects/redis:master/build`

If you don't specify a branch, the one specified in
the configuration file will be built. If you didn't
add a default branch in the configuration, `master`
will be used.

The same endpoint supports `GET` requests as well,
though it's only recommended to use this method when
you want to manually trigger a build ([here's why](http://www.looah.com/source/view/2284)).

``` json
# POST /api/projects/redis:master/build
{
    "result": "build scheduled",
    "build": {
        "project": "redis",
        "branch": "master",
        "id": "27f466aa-fce9-4323-9642-55f4cf760506",
        "path": "/tmp/roger-builds/sources/27f466aa-fce9-4323-9642-55f4cf760506",
        "tar": "/tmp/roger-builds/27f466aa-fce9-4323-9642-55f4cf760506.tar",
        "tag": "odino/redis:master"
    }
}
```

### Build status

You can see a build's status by visiting
`/api/builds/BUILD_ID`.

```
2015-01-27T19:18:34.810Z - info: [127.0.0.1:5000/nginx-pagespeed:something] Scheduled a build of cb5ea16d-5266-4018-b571-954e75b825e0
2015-01-27T19:18:34.810Z - info: Cloning https://github.com/namshi/docker-node-nginx-pagespeed:something in /tmp/roger-builds/sources/cb5ea16d-5266-4018-b571-954e75b825e0
2015-01-27T19:18:34.816Z - info: git clone https://github.com/namshi/docker-node-nginx-pagespeed: Cloning into '/tmp/roger-builds/sources/cb5ea16d-5266-4018-b571-954e75b825e0'...

2015-01-27T19:18:37.274Z - info: [127.0.0.1:5000/nginx-pagespeed:something] Created tarball for cb5ea16d-5266-4018-b571-954e75b825e0
2015-01-27T19:18:37.365Z - info: Build of 127.0.0.1:5000/nginx-pagespeed:something is in progress...
2015-01-27T19:18:37.365Z - info: [127.0.0.1:5000/nginx-pagespeed:something] Step 0 : FROM dockerfile/nodejs

2015-01-27T19:18:37.365Z - info: [127.0.0.1:5000/nginx-pagespeed:something]  ---> c08280595650
...
...
...
```

This is the only API that uses plaintext
responses.

When you trigger a build, you will receive
a link to the build status API:

```
{
    "result": "build scheduled",
    "build": {
        ...
        "status": "/api/builds/cb5ea16d-5266-4018-b571-954e75b825e0",
        ...
    }
    ...
}
```

You can just visit that URL to see the build
output, which will be streamed until the build
is complete.

### Build all projects

Sometimes it is useful to trigger builds for
all projects, especially when the server restarts
or simply because your registry might have gone
on vacation: simply hit `/api/build-all` and all
projects will build their default branch in
parallel.

``` json
# POST /api/build-all
{
    "builds": [
        {
            "project": "nginx-pagespeed",
            "branch": "master",
            "id": "c57e73ee-3f15-47ee-b452-a9efc5255fc5",
            "path": "/tmp/roger-builds/sources/c57e73ee-3f15-47ee-b452-a9efc5255fc5",
            "tar": "/tmp/roger-builds/c57e73ee-3f15-47ee-b452-a9efc5255fc5.tar",
            "tag": "127.0.0.1:5001/nginx-pagespeed:master"
        },
        {
            "project": "redis",
            "branch": "master",
            "id": "3618ea27-7463-4166-967c-773e7abbdab6",
            "path": "/tmp/roger-builds/sources/3618ea27-7463-4166-967c-773e7abbdab6",
            "tar": "/tmp/roger-builds/3618ea27-7463-4166-967c-773e7abbdab6.tar",
            "tag": "odino/redis:master"
        },
        {
            "project": "privaterepo",
            "branch": "master",
            "id": "2d4be379-36cf-4c88-834f-08c1902fcb68",
            "path": "/tmp/roger-builds/sources/2d4be379-36cf-4c88-834f-08c1902fcb68",
            "tar": "/tmp/roger-builds/2d4be379-36cf-4c88-834f-08c1902fcb68.tar",
            "tag": "127.0.0.1:5001/privaterepo:master"
        }
    ],
    "_links": {
        "config": {
            "href": "/api/config"
        },
        "projects": {
            "href": "/api/projects"
        },
        "self": {
            "href": "/api/build-all"
        }
    }
}
```

### List configuration

You can access roger's configuration
at `/api/config`.

``` json
# GET /api/config
{
    "auth": {
        "dockerhub": {
            "username": "odino",
            "email": "alessandro.nadalin@gmail.com",
            "password": "*****"
        },
        "github": "*****"
    },
    "projects": {
        "nginx-pagespeed": {
            "branch": "master",
            "from": "https://github.com/namshi/docker-node-nginx-pagespeed",
            "registry": "127.0.0.1:5001",
            "after-build": [
                "ls -la",
                "sleep 1"
            ],
            "name": "nginx-pagespeed"
        },
        "redis": {
            "branch": "master",
            "from": "https://github.com/dockerfile/redis",
            "name": "redis",
            "registry": "odino"
        },
        "privaterepo": {
            "branch": "master",
            "from": "https://YOUR_SECRET_TOKEN@github.com/odino/secret",
            "github-token": "*****",
            "registry": "127.0.0.1:5001",
            "name": "privaterepo"
        }
    }
}
```

## Contributing

You can easily hack on roger by simply cloning
this repository and then running `fig up`: you
will have then a copy of roger and a private
registry running on your machine so that you
can easily hack on stuff.

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

* docs
  * how to setup a minimal server
* client
  * homepage with simple layout
  * list of projects
  * project view
  * build a project
  * view builds of a project
  * view build of a project
  * wall (use query parameters to include / exclude projects)
* build tracking
  * save build result
  * persist to SQLite
  * mount sqlite
* api
  * `/api/test` an api that takes an example config file, runs builds and asserts their output
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

Roger should be running as a docker container
itself:

```
docker build -t namshi/roger .

docker run -p 5000:5000 -ti namshi/roger
```

## Configuration

An example configuration:

``` yaml
app: # app-specific configuration
  port: 5000 # port on which the app is running
auth:
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
  redis: # if you don't specify the registry, we'll assume you want to push to the dockerhub
    branch:       master
    from:         https://github.com/dockerfile/redis
  privaterepo: # a private project
    branch:       master
    from:         https://github.com/odino/holland
    github-token: YOUR_SECRET_TOKEN # project-specific github oauth token (https://github.com/settings/tokens/new)
    registry:     127.0.0.1:5001
```

Things to notice:

* in order to push to the dockerhub, simply omit the registry
* if you don't specify a default branch, we'll pick `master` for you
* don't store your password / tokens in the config file, inject them from the environment (see [below](https://github.com/namshi/roger#sensitive-data))

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

## Triggering builds

You can simply issue a POST request to the endpoint
`/api/builds/{project}[/{branch}]`.

For example, both of these URLs are valid endpoints:

* `/api/builds/redis`
* `/api/builds/redis/master`

If you don't specify a branch, the one specified in
the configuration file will be built. If you didn't
add a default branch in the configuration, `master`
will be used.

The same endpoint supports `GET` requests as well,
though it's only recommended to use this method when
you want to manually trigger a build ([here's why](http://www.looah.com/source/view/2284)).

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
projects:
  my_node_app:
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

## Adding your own source

TBD

## Running your own post-build scripts (ie. tests)

See [after-build hooks](https://github.com/namshi/roger#after_build).

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

* documentation
  * how to run / extend / pass config file
* run a single build
  * build projects where the dockerfile is not in the root of the repo
* allow people to trigger builds from github
  * trigger builds on pull requests
  * trigger builds on pushes of open pull requests

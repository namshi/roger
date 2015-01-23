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
app:
  port: 5000 # port on which roger is gonna run
projects: # list of project that will be built
  nginx_pagespeed: # name of the project (will be the image name)
    branch:   master # default branch, optional
    from:     https://github.com/namshi/docker-node-nginx-pagespeed # source URL, for now only public git repos work
    registry: 127.0.0.1:5001 # registry to push to, for now only private unauthenticated registries work
  redis: # another project, etc etc
    branch:   master
    from:     https://github.com/dockerfile/redis
    registry: 127.0.0.1:5001
```

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

## Adding your own hook

TBD

## Adding your own source

TBD

## Running your own post-build scripts (ie. tests)

TBD

## Contributing

You can easily hack on roger by simply cloning
this repository and then running `fig up`: you
will have then a copy of roger and a private
registry running on your machine so that you
can easily hack on stuff.

Problems? [Open an issue](https://github.com/namshi/roger/issues)! Suggestions? Feel free
to [send a PR](https://github.com/namshi/roger/pulls)!

# TODO

* documentation
* ~~load YML config file~~
* run a single build
  * ~~clone a repo from master~~
  * clone a private repo
  * ~~build from a dockerfile~~
  * push it to the dockerhub
  * ~~push it to a private registry~~
  * build projects where the dockerfile is not in the root of the repo
  * tests
  * run post install trigger
    * ability to reference the just built container through a trigger
    * if these triggers dont work, just mark the build as failed
  * ~~log the build output~~
  * comment on a github pull request if the build failed or passed 
* ~~expose its interface through HTTP (people will protect it through some other thing like nginx if needed)~~
  * ~~trigger builds by HTTP GET / POST~~
* allow people to trigger builds from github
  * trigger builds on pull requests
  * trigger builds on pushes of open pull requests

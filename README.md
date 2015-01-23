# Roger

> A build server for docker containers

Roger is a simple yet powerful build
server for docker containers: you will
only need to specify your configuration
and it will build your projects everytime
you schedule a build or, for example,
open a pull request on github.

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
    branch: master # default branch, optional
    from:   https://github.com/namshi/docker-node-nginx-pagespeed # source URL, for now only public git repos work
    to:     127.0.0.1:5001 # registry to push to, for now only private unauthenticated registries work
```

## Triggering builds

TBD

## Adding your own hook

TBD

## Adding your own source

TBD

## Running your own post-build scripts (ie. tests)

TBD

## Contributing

TBD

# TODO

* ~~load YML config file~~
* run a single build
  * ~~clone a repo from master~~
  * clone a private repo
  * ~~build from a dockerfile~~
  * push it to the dockerhub
  * ~~push it to a private registry~~
  * run post install trigger
    * ability to reference the just built container through a trigger
    * if these triggers dont work, just mark the build as failed
  * log the build output in the filesystem
  * comment on a github pull request if the build failed or passed 
* ~~expose its interface through HTTP (people will protect it through some other thing like nginx if needed)~~
  * ~~trigger builds by HTTP GET / POST~~
* allow people to trigger builds from github
  * trigger builds on pull requests
  * trigger builds on pushes of open pull requests

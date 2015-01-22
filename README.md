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

TBD

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
  * build from a dockerfile
  * push it somewhere
  * run post install trigger
    * ability to reference the just built container through a trigger
    * if these triggers dont work, just mark the build as failed
  * log the build output in the filesystem
  * comment on a github pull request if the build failed or passed 
* expose its interface through HTTP (people will protect it through some other thing like nginx if needed)
  * ~~trigger builds by HTTP GET / POST~~
* allow people to trigger builds from github
  * trigger builds on pull requests
  * trigger builds on pushes of open pull requests

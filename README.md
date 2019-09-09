# Invoque (BETA)

A pattern for function oriented service composition / decomposition. **This is beta / poc software**

## "All I want to do is write functions"

Invoque is a tool that gives you the ability to maintain application code as a monolith and supplies tooling that lets you easily deploy groups of functions (endpoints) as containerized services or invididual serverless functions. By adpoting the invoque handler pattern you can easily switch between deployment strategies **without rewriting code.**

#### You will never have to hand-code an http/express service in Node again! 🎉

### Conventions over Configuration

1. TypeScript, because, TypeScript.
2. Application code (i.e. functions) lives in a `/src` folder and gets compiled to `/dist`.
3. Functions take an `Invoquation` object as their only argument which has `type`, `payload` and `uriArgs` properties.
4. Functions can throw, be async or sync and service will respond accordingly. To send back another status code, attach `code` or `statusCode` to an extensible error object.
5. Functions return a `Response` which can be a plain object, or have `data`, `status`, and `headers` props for more control over HTTP responses.
6. Service routes map `http://my-service.com/myFunction` to the name of your function' `export const myFunction = {...}`*
7. Additional route "arguments" are passed a `uriArgs: string[]` prop of `Invoquation` e.g. `/users/123` will invoke with `{ uriArgs: ['123'] }`*

*Any query string params will also be parsed and passed along with the payload.

## Quick Start

To start using invoque add it as a dependency to your node project:
```sh
npm i invoque
```

Create a `src/` directory and add a file called `hello.ts` that exports two handler functions:

```ts
import { Invoquation } from 'invoque';
export const hello = ({ type, payload }: Invoquation) => {
    return { hello: type, payload };
}

export const healthcheck = () => ({
  service: 'up',
  time: new Date().toISOString()
})
```

Run the service with invoque command:
```sh
invoque http ./
```

You should see the following output:
```
Service running on port 3000, available routes:
/hello
/healthcheck
```

The service will respond to any type of HTTP request, and the Invoquation type property will reflect the request type. e.g.

```
curl -d '{ "hello": "world" }' http://localhost:3000/hello
```

Will output `{"hello":"HTTP_POST","payload":{"hello":"world"}}`.

Requests are logged in the running console.


### Building Docker Containers

This assumes you have docker installed and running on your local machine.

To create a container from your new service run:

```sh
invoque build ./ --tag hello-service
```
This will package the invoque service code and your compiled project to `dist/`. A `Dockerfile` will be created for you which you can use to fine tune your desired deployment(s). `docker build` is run to create the a container corresponding to the `--tag` argument.

You can now run your container locally to test it. For example, this will interactively run the hello-service container on port 8080 and expose it to port 3001 locallly.

```
docker run -p 3001:8080 -e 'PORT=8080' t my-container
```

You should be able to make requests to the container at `http://localhost:3001/healthcheck`

## Usage/API

The **first argument** to `invoque` is a command. Currently supported commands are
* `http` Runs http dev server
* `event` Runs dev server simuating event context (poorly)
* `build` build a local docker container
* `deploy` deploy to GCF/CloudRun.

**The second argument is the directory or single ts module**.

This allows you to organize code into groups of endpoints by exporting multiple functions from a single file, or grouping collections of functions into files and folders, or both.

For example, this project structure
```
/src
  /users
     userCrud.ts
     userAuth.ts
  /accounts
     accountService.ts
```

Could be used to build two separate service containers with invoque:
```
invoque build users/ --tag user-service
invoque build accounts/ --tag account-service
```

Similarly, to run a local server for dev
```
invoque http users/ --port 3030
```

### Deployment

`invoque deploy [sourceDirectoryOrModule] [functionOrServiceName] [gcf|run]`

Currently deployment to Google Cloud Functions and Google Cloud Run is supported out of the box, though Docker deployment gives great flexibility beyond Cloud Run.

For deployment to work, the [gcloud sdk](https://cloud.google.com/sdk/docs/quickstarts) must be installed on the machine running `invoque deploy`.

Additionally, a GCP `project` must be set via [gcloud config set](https://cloud.google.com/sdk/gcloud/reference/config/set) or the deploy commands will exit 1.

#### Deploy to GCF

```
invoque deploy ./ hello gcf
```

Currently the Google Functions name reference and the single handler contained somewhere in the source directory are the same. In this example, hello is a function exported in any file contained in the `./src` directory.


#### Deploy to CloudRun
```
invoque deploy ./ hello run
```

The third argument for this deployment is the service name. Because clould build will use this as the container image name, only lower case characters are allowed. As with the above, this could likely be improved.

## Testing

Though you can use any test tools you wish, Invoque exposes two functions that allow you to use [Supertest](https://github.com/visionmedia/supertest) for HTTP calls: `functionsFromPath` and `serviceFromFunctions`

Here's an example that tests our `/healthcheck` route from the example above:

```js
import { resolve } from 'path';
import * as request from 'supertest';
import {
  functionsFromPath,
  serviceFromFunctions,
} from 'invoque';

describe('my cool service', () => {
  let app: any;
  const handlers = resolve(process.cwd(), 'src/service.ts');
  beforeAll(() => {
    app = serviceFromFunctions(
      functionsFromPath(handlers),
    );

  });

  test('healthcheck', async () => {
      const { body } = await request(app)
        .get('/healthcheck')
        .expect(200);
      expect(body.service).toBe('up')
  });
});
```

You will also need to install some dev dependencies:
`npm i -D typescript jest ts-test @types/jest supertest @types/supertest`

Add a jest.config.js:

```
module.exports = {
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  silent: true,
  preset: 'ts-jest',
  testEnvironment: 'node',
  testRegex: '(/tests/.*|(\\.|/)(test))\\.(ts)$',
  moduleFileExtensions: ['js', 'ts', 'json'],
  testPathIgnorePatterns: ['node_modules', 'dist', 'task', 'types'],
  collectCoverage: true,
};

```

Then add a test script to package.json: `"test": "jest"`


#### Tips:
* Although you likely could co-locate shared dependencies between deployment units, we suggest storing common service dependencies in a separate repo and publishing them to npm.
* You can use the created `Dockerfile` along with `docker-compose` to bring up dependent servcies, local aws, pubsub, database etc.
* More examples and articles to come soon as we build out beyond POC!

## Roadmap
 * Google Cloud Function Trigger Option
 * Support for AWS Lambda/Azure Functions/Now.sh
 * CI/CD Tooling Via Git Diff/Other mechanism

## Credit

The idea for invoque was in partly inspired by the [Google Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework-nodejs)
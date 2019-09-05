# Invoque

A pattern for function oriented service composition / decomposition.

### "All I want to do is write functions..."

Invoque is a tool that gives you the ability to maintain your application code as a monolith and supplies tooling that lets you deploy either containerized service or invididual serverless functions depending on workload requirements and costing.

#### You will never have to hand-code an http/express service in Node again! 🎉

### Conventions

Invoque opts for conventions over configuration:

1. TypeScript, because, TypeScript.
2. Aplication live in a `/src` folder.
3. Functions all take `Invoquation` object as their only argument, with a `type` and `payload`.
4. Functions simply throw and the service will respond accordingly.
5. Functions return a `Response` which can be a plain object, or have `data`, `status`, and `headers` props for more control over HTTP responses.
6. Service routes map `http://my-service.com/my-function` to the name of your function' `export const my-function = {...}`*

*No URL pattern matching is supported (at this time). Instead, payloads for GET requests are created with good old fashioned query string params.

## Using Invoque

### HTTP Dev Server

To start using invoque add it as a devDependency:
```sh
npm i -D invoque
```

Create a `src/` folder in your project and add a `hello.ts` file. Add the following handler:

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

Run your new service with Invoque:
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

Will output `{"hello":"HTTP_POST","payload":{"hello":"world"}}`. You will also see the request logged in the running console.


### Create a Docker Container

This assumes you have docker installed and running on your local machine. To create a container from your new service run:

```sh
invoque build ./ --tag hello-service
```
This will package the invoque service code and your project into to `dist/`. A `Dockerfile` will be created for you which you can use to fine tune your desired deployment(s). `docker build` is run to create the a container corresponding to the `--tag` argument.

You can now run your container locally to test it. For example, this will interactively run the hello-service container on port 8080 and expose it to port 3001 locallly.

```
docker run -p 3001:8080 -e 'PORT=8080' t my-container
```

You should be able to make requests to the container at `http://localhost:3001/`



## More Invoque Usage / Examples

Currently, invoque supports `http` and `build` commands. **The second argument is the directory or single ts module**. This allows you to organize code into groups of endpoints by either, exporting multipe functions from a single file, grouping functions into folders or both.

For example, this project structure
```
/src
  /users
     service.ts
  /accounts
     service.ts
```

Could be used to build two separate service containers with invoque:
```
invoque build users/ --tag user-service
invoque build accounts/ --tag account-service
```

#### Tip: Although you definitely could, we suggest you store common dependencies in a separate and publish them to NPM.

## Roadmap
 * Google Cloud Functions deploy tool
 * Google Cloud Function Event trigger handler tooling (dev server)
 * AWS Lambda/Azure/Hybrid Deploy (Terrraform?)
 * CI/CD Tooling
 * Advanced Routing


## What about REST?

No REST for the weary. 😂 The future of the mundane workload is serverless and event based.

## Credit

This idea for invoque was partically inspired by the [Google Functions Framework](https://github.com/GoogleCloudPlatform/functions-framework-nodejs)
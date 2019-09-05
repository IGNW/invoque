# Invoque

A pattern for function oriented service composition / decomposition.

### "All I want to do is write functions..."

Invoque is a tool that gives you the ability to maintain your application code as a monolith and supplies tooling that lets you deploy either containerized service or invididual serverless functions depending on workload requirements and costing.

#### You will never have to hand-code an http/express service in Node again! 🎉

### Conventions

Invoque opts for conventions over configuration:

1. TypeScript, because, TypeScript.
2. You keep application files organized in a `/src` folder
3. Service routes map `/route` to the name of your functions' export.
4. Functions all take `Invoquation` object as their only argument, with a `type` and `payload`.
5. Functions simply throw and the service will respond accordingly.
6. Functions return a `Response` which can be a plain object, or have `data`, `status`, and `headers` props for more control over HTTP responses.

### Using Invoque

To start using invoque, simply install via npm:
```sh
npm i -D invoque
```

Create your project structure with








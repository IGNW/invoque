#!/usr/bin/env ts-node
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import { createServer, RequestListener } from 'http';
import { relative, resolve } from 'path';
import { argv } from 'yargs';
import {
  functionsFromPath,
  serviceFromFunctions,
} from './invoque-service';

if (argv.h || argv.help) {
  // tslint:disable-next-line
  console.log('usage: invq [http|container] [source-directory|source-file] --port [3000] --tag [my-image-tag]');
  process.exit(0);
}

const [
  service,
  source = './',
] = argv._;

enum ServiceTarget {
  HttpDevServer = 'http',
  Container = 'build',
  Run = 'run',
}

if (service === ServiceTarget.HttpDevServer) {
  // check to ensure the target module exists
  const sourcePath = resolve(`${process.cwd()}/src`, source);
  if (!fs.existsSync(sourcePath)) {
    // tslint:disable-next-line
    console.error(`Module ${source} does not exist. Exiting.`);
    process.exit(1);
  }

  const functions = functionsFromPath(sourcePath);
  const port = process.env.PORT || argv.port || 3000;
  createServer(serviceFromFunctions(functions) as RequestListener)
    .listen(
      port,
      () => {
        // tslint:disable
        console.log(`Service running on port ${port}, available routes:`)
        Object.keys(functions).map(route =>
          console.log(`/${route}`)
        )
      }
    );
}

if (service === ServiceTarget.Container) {
  console.log(`Building service container from ${source}...`);
  console.log('Compliling TypeScript...');
  // use tsconfig from invoque if one is not already present
  const tsconfigPath = resolve(process.cwd(), './node_modules/invoque/tsconfig.invoque.json');
  const localConfig = resolve(process.cwd(), 'tsconfig.json');
  if (!fs.existsSync(localConfig)) {
    console.log('No local tsconfig found, creating one...');
    fs.copyFileSync(tsconfigPath, localConfig);
  }
  spawnSync('npm', ['i', '@types/node']);
  spawnSync('npm', ['i', '@types/micro']);
  const tsc = spawnSync('tsc');
  console.log(tsc.stdout.toString());

  // use dockerfile from invoque if one is not already present
  const dockerFilePath = resolve(process.cwd(), './node_modules/invoque/Dockerfile');
  const localDockerfile = resolve(process.cwd(), 'Dockerfile');
  if (!fs.existsSync(localDockerfile)) {
    console.log('No local Dockerfile found, creating one...');
    fs.copyFileSync(dockerFilePath, localDockerfile);
  }

  console.log('Copying service into dist...');
  const containerScript = resolve(process.cwd(), './node_modules/invoque/dist/invoque-container.js');
  const localContainerScript = resolve(process.cwd(), 'dist/invoque-container.js');
  const localSource = resolve(process.cwd(), `dist/${source}`);
  if (!fs.existsSync(localSource)) {
    console.error(`invoque error: dist/${source} does not exist, unable to map functions to service`);
    process.exit(1);
  }
  const writeToFile = fs.readFileSync(containerScript, 'utf-8')
    .replace('SOURCE_PATH_REPLACE_ON_BUILD', `dist/${source}`);
  fs.writeFileSync(localContainerScript, writeToFile, 'utf-8');
  fs.copyFileSync(
    resolve(process.cwd(), './node_modules/invoque/dist/invoque-service.js'),
    resolve(process.cwd(), 'dist/invoque-service.js')
  );

  console.log('Building docker container...');
  const imageTag = argv.tag as string || 'my-container';
  const build = spawn(`docker`, ['build', '.', '-t', imageTag]);
  build.stdout.on('data', data => console.log(data.toString()));
  build.stderr.on('data', data => console.log(data.toString()));
  build.on('close', () => console.log('Docker container build complete'));
}

if (service === ServiceTarget.Run) {
  require('./dist/container');
}
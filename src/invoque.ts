#!/usr/bin/env ts-node
import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import { createServer, RequestListener } from 'http';
import { relative, resolve } from 'path';
import { argv } from 'yargs';
import {
  serviceFromFunctions,
} from './invoque-service';
import {
  functionsFromPath,
} from './invoque-util';

if (argv.h || argv.help) {
  // tslint:disable-next-line
  console.log('usage: invq [http|container] [source-directory|source-file] --port [3000] --tag [my-image-tag]');
  process.exit(0);
}

enum ServiceTarget {
  HttpDevServer = 'http',
  EventDevServer = 'event',
  Container = 'build',
  Deploy = 'deploy',
}

enum environmentTargets {
  gcf = 'gcf',
}

enum TriggerTypes {
  http = 'http',
}

const [
  service,
  source = '',
  functionTarget = '',
  environmentTarget,
  triggerType = 'http',
] = argv._;

if (service === ServiceTarget.HttpDevServer || service === ServiceTarget.EventDevServer) {
  // check to ensure the target module exists
  const sourcePath = resolve(`${process.cwd()}/src`, source);
  if (!fs.existsSync(sourcePath)) {
    // tslint:disable-next-line
    console.error(`Module ${source} does not exist. Exiting.`);
    process.exit(1);
  }

  const functions = functionsFromPath(sourcePath);
  const port = process.env.PORT || argv.port || 3000;
  createServer(serviceFromFunctions(
    functions,
    service === ServiceTarget.EventDevServer,
  ) as RequestListener)
    .listen(
      port,
      () => {
        // tslint:disable
        console.log(`dev server running on port ${port}, available routes:`)
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
  spawnSync('rm', ['-rf', 'dist']);
  spawnSync('npm', ['i', '@types/node']);
  spawnSync('npm', ['i', '@types/micro']);
  const tsc = spawnSync('tsc');
  process.stdout.write(tsc.stdout.toString());

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
  fs.copyFileSync(
    resolve(process.cwd(), './node_modules/invoque/dist/invoque-util.js'),
    resolve(process.cwd(), 'dist/invoque-util.js')
  );

  console.log('Building docker container...');
  const imageTag = argv.tag as string || 'my-container';
  const build = spawn(`docker`, ['build', '.', '-t', imageTag]);
  build.stdout.on('data', data => process.stdout.write(data.toString()));
  build.stderr.on('data', data => process.stdout.write(data.toString()));
  build.on('close', () => console.log('Docker container build complete'));
}

if (service === ServiceTarget.Deploy) {
  if (!environmentTarget) {
    console.error('Please specify a functions deploy taget. Currently only "gcp" is supported');
    process.exit(1);
  }
  console.log(`Deploying ${source}.${functionTarget} to ${environmentTarget}...`);
  console.log('Compliling TypeScript...');
  // use tsconfig from invoque if one is not already present
  const tsconfigPath = resolve(process.cwd(), './node_modules/invoque/tsconfig.invoque.json');
  const localConfig = resolve(process.cwd(), 'tsconfig.json');
  if (!fs.existsSync(localConfig)) {
    console.log('No local tsconfig found, creating one...');
    fs.copyFileSync(tsconfigPath, localConfig);
  }
  spawnSync('rm', ['-rf', 'dist']);
  // FIXME: This makes linking a pain (undoes it).
  // Workaround is to check for presense of this dep in package.json?
  // This also seems to adversely affect CGF deploys, not sure why exactly
  spawnSync('npm', ['i', '-D', '@types/node']);
  const tsc = spawnSync('tsc');
  process.stdout.write(tsc.stdout.toString());

  const trigger = triggerType === TriggerTypes.http
    ? 'http'
    : 'event';

  const invoker = `invoque-${environmentTarget}-${trigger}.js`;
  console.log('Copying invoker into dist...');
  const handlerScript = resolve(process.cwd(), `./node_modules/invoque/dist/${invoker}`);
  const localhandlerScript = resolve(process.cwd(), 'dist/index.js');
  const localSource = resolve(process.cwd(), `dist/${source}`);
  if (!fs.existsSync(localSource)) {
    console.error(`invoque error: dist/${source} does not exist, unable to use function for deployment`);
    process.exit(1);
  }

  // write the index
  const writeToFile = fs.readFileSync(handlerScript, 'utf-8')
    .replace('SOURCE_PATH_REPLACE_ON_BUILD', source)
    .replace('HANDLER_TARGET_REPLACE_ON_DEPLOY', functionTarget);
  fs.writeFileSync(localhandlerScript, writeToFile, 'utf-8');

  // copy package json and util that maps functions from source dir
  fs.copyFileSync(
    resolve(process.cwd(), 'package.json'),
    resolve(process.cwd(), 'dist/package.json')
  );
  fs.copyFileSync(
    resolve(process.cwd(), './node_modules/invoque/dist/invoque-util.js'),
    resolve(process.cwd(), 'dist/invoque-util.js')
  );

  console.log('Deploying function...');
  const args = [
    'functions',
    'deploy',
    functionTarget,
    '--runtime',
    'nodejs10',
    '--entry-point',
    'googleCloudFnHandler',
    '--source',
    './dist/',
    '--trigger-http'
  ];

  const build = spawn(`gcloud`, args);
  build.stdout.on('data', data => process.stdout.write(data.toString()));
  build.stderr.on('data', data => process.stdout.write(data.toString()));
}

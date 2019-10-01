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

enum EnvironmentTargets {
  gcf = 'gcf',
  run = 'run',
}

enum TriggerTypes {
  http = 'http',
}

const [
  service,
  source = '',
  functionTargetOrServiceName = '',
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

const compileTypescript = () => {
  console.log('Compiling project...');
  // use tsconfig from invoque if one is not already present
  const tsconfigPath = resolve(process.cwd(), './node_modules/invoque/tsconfig.invoque.json');
  const localConfig = resolve(process.cwd(), 'tsconfig.json');
  if (!fs.existsSync(localConfig)) {
    console.log('No local tsconfig found, creating one...');
    fs.copyFileSync(tsconfigPath, localConfig);
  }
  // FIXME? This makes dev with npm link somewhat annoying to work with (destroys and replaces)
  spawnSync('rm', ['-rf', 'dist']);
  spawnSync('npm', ['i', '-D', '@types/node']);
  spawnSync('npm', ['i', 'micro']); // used for body parsing in invoque-service
  spawnSync('npm', ['i', '-D', '@types/micro']);
  const tsc = spawnSync('tsc');
  process.stdout.write(tsc.stdout.toString());
}

const createServiceDistribution = () => {
  // use dockerfile from invoque if one is not already present
  const dockerFilePath = resolve(process.cwd(), './node_modules/invoque/Dockerfile');
  const localDockerfile = resolve(process.cwd(), 'Dockerfile');
  if (!fs.existsSync(localDockerfile)) {
    console.log('No local Dockerfile found, creating one...');
    fs.copyFileSync(dockerFilePath, localDockerfile);
    // copy .docker ignore for cloud run
    fs.copyFileSync(
      resolve(process.cwd(), './node_modules/invoque/Dockerfile'),
      resolve(process.cwd(), 'Dockerfile')
    );
  }

  console.log('Creating service in /dist...');
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
}

const createFunctionDistribution = () => {
  const trigger = triggerType === TriggerTypes.http
    ? 'http'
    : 'event';

  const invoker = `invoque-${environmentTarget}-${trigger}.js`;
  console.log('Creating function in /dist...');
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
    .replace('HANDLER_TARGET_REPLACE_ON_DEPLOY', functionTargetOrServiceName);
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
}

const submitBuildImage = (projectId: string): Promise<void> => new Promise((resolve, reject) => {
  console.log('Submitting build to gcloud...');
  const submit = spawn('gcloud', ['builds', 'submit', '--tag', `gcr.io/${projectId}/${functionTargetOrServiceName}`]);
  submit.stdout.on('data', (data) => process.stdout.write(data.toString()));
  submit.stderr.on('data', (data) => process.stdout.write(data.toString()));
  submit.on('close', (code: number) => {
    console.log('CloudRun deploy complete');
    if (code === 0) {
      return resolve();
    }
    reject(code);
  });
});

const main = async (): Promise<void> => {
  if (service === ServiceTarget.Container) {
    console.log(`Building local service container from ${source}...`);
    compileTypescript();
    createServiceDistribution();

    console.log('Building docker container...');
    const imageTag = argv.tag as string || 'my-container';
    const build = spawn(`docker`, ['build', '.', '-t', imageTag]);
    build.stdout.on('data', data => process.stdout.write(data.toString()));
    build.stderr.on('data', data => process.stdout.write(data.toString()));
    build.on('close', () => console.log('Docker container build complete'));
  }


  if (service === ServiceTarget.Deploy) {
    if (!environmentTarget) {
      console.error('Please specify a deploy target. Current support: gcf, run');
      process.exit(1);
    }

    console.log(`Deploying ${source} ${functionTargetOrServiceName} to ${environmentTarget}...`);
    compileTypescript();
    const projectInfo = spawnSync('gcloud', ['config', 'get-value', 'project']);
    const projectId = projectInfo.stdout.toString().replace(/\n/, '');
    if (projectId <= '') {
      console.error('No gcp project id specified! Deploy will fail. Set the project id to use invoque deploy.');
      process.exit(1);
    }

    // deploy container to run
    if (environmentTarget === EnvironmentTargets.run) {
      createServiceDistribution();
      await submitBuildImage(projectId);
      console.log('Deploying image to cloud run:');
      const args: string[] = [
        'beta',
        'run',
        'deploy',
        functionTargetOrServiceName,
        '--image',
        `gcr.io/${projectId}/${functionTargetOrServiceName}`,
        '--platform',
        'managed',
        '--region',
        argv.region as string || 'us-central1',
        '--memory',
        argv.memory as string || '256MiB',
        '--allow-unauthenticated',
      ];
      if (argv['service-account']) {
        args.concat([
          '--service-account',
          argv['service-account'] as string
        ]);
      }

      console.info(`gcloud ${args.join(' ')}`);
      const deploy = spawn(`gcloud`, args);
      deploy.stdout.on('data', (data) => process.stdout.write(data.toString()));
      deploy.stderr.on('data', (data) => process.stdout.write(data.toString()));
      deploy.on('close', () => {
        console.log('invoque: CloudRun deploy complete.');
        console.log('For more advanced deploy options run the above command directly. Reference here https://cloud.google.com/sdk/gcloud/reference/beta/run/deploy');
        process.exit(0);
      });
    }

    if (environmentTarget === EnvironmentTargets.gcf) {
      // deploy to gcf
      createFunctionDistribution();
      console.log('Deploying function...');
      const args = [
        'functions',
        'deploy',
        functionTargetOrServiceName,
        '--runtime',
        'nodejs10',
        '--entry-point',
        'googleCloudFnHandler',
        '--source',
        './dist/',
        // TODO: specify trigger type for event handlers
        '--trigger-http'
      ];

      const deploy = spawn(`gcloud`, args);
      deploy.stdout.on('data', data => process.stdout.write(data.toString()));
      deploy.stderr.on('data', data => process.stdout.write(data.toString()));
      deploy.on('close', () => {
        console.log('Function deploy complete');
        process.exit(0);
      });
    }
  }
}

main()
  .catch(e => console.error('invoque: caught runtime error', e));

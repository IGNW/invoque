import * as fs from 'fs';
import { createServer, RequestListener } from 'http';
import { resolve } from 'path';
import { argv } from 'yargs';
import {
  serviceFromFunctions,
} from './service';
import {
  functionsFromPath,
} from './util';

if (argv.h || argv.help) {
  // tslint:disable-next-line
  console.log('usage: invq [source-directory|source-file] [express] --port [3000]');
  process.exit(0);
}

const [
  source = '',
  service,
] = argv._;

// check to ensure the target module exists
const sourcePath = resolve(process.cwd(), source);
if (!fs.existsSync(sourcePath)) {
  // tslint:disable-next-line
  console.error(`Module ${source} does not exist. Exiting.`);
  process.exit(1);
}

enum ServiceTarget {
  ExpressServer = 'express',
  // DevContainer
}

if (service === ServiceTarget.ExpressServer) {
  const functions = functionsFromPath(source);
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

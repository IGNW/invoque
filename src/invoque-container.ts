
import { createServer, RequestListener } from 'http';
import {
  serviceFromFunctions,
} from './invoque-service';
import {
  functionsFromPath,
} from './invoque-util';

const SOURCE_PATH = 'SOURCE_PATH_REPLACE_ON_BUILD';

const functions = functionsFromPath(SOURCE_PATH);
const port = process.env.PORT || 3000;
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

import * as fs from 'fs';
import {
  ServerResponse,
} from 'http';
import {
  json,
} from 'micro';
import { resolve } from 'path';
import * as qs from 'querystring';
import {
  parse,
} from 'url';
import {
  Functions,
  Request,
  Response,
} from './types';

export const functionsFromPath = (sourcePath: string): Functions =>
  !fs.lstatSync(sourcePath).isDirectory()
    ? require(sourcePath) // tslint:disable-line
    : fs.readdirSync(sourcePath).reduce((acc, file) => ({
      ...acc,
      ...require(resolve(process.cwd(), sourcePath, file)),
    }), { });

export const serviceFromFunctions = (functions: Functions) =>
  async (req: Request, res: ServerResponse) => {
    const invocationType = `HTTP_${req.method!.toUpperCase()}`;
    const handler = (parse(req.url!).pathname || '').replace(/\//g, '');

    // 404 if we dont have a method
    if (!functions[handler]) {
      res.writeHead(404);
      res.end();
      return;
    }

    try {
      // parse post json or query string
      const payload = req.method === 'GET'
        ? qs.parse(parse(req.url!).query || '')
        : req.body || await json(req);

      // log request
      console.log(invocationType, handler, payload); // tslint:disable-line

      const result: Response = functions[handler]({
        payload,
        type: invocationType,
      });

      const defaultHeaders = {
        'content-type': 'application/json',
      };
      res.writeHead(
        result.status || 200,
        { ...defaultHeaders, ...result.headers },
      );
      res.write(JSON.stringify(result.data || result));
      res.end();
      return;

    } catch (e) {
      // return errors as 500, log to stderr
      console.error(e); // tslint:disable-line
      res.writeHead(500);
      res.write(JSON.stringify(e));
      res.end();
      return;
    }
};

import { Request, Response } from 'express';
import {
  parse,
} from 'url';
import { functionsFromPath } from './invoque-util';
import { Payload } from './types';
const SOURCE_MODULE = 'SOURCE_PATH_REPLACE_ON_BUILD';
const HANDLER_TARGET = 'HANDLER_TARGET_REPLACE_ON_DEPLOY';

const moduleWithFn = functionsFromPath(SOURCE_MODULE); // tslint:disable-line

export const googleCloudFnHandler = (req: Request, res: Response) => {
  try {
    const [_, __, ...uriArgs] = (parse(req.url!).pathname || '').split('/');
    // allow function to throw vs care about crafting response
    const body: string = req.get('content-type') === 'application/octet-stream'
      ? req.body.toString()
      : req.body;

    // try parsing the body, otherwise just keep raw
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (e) {
      // tslint:disable-next-line
      console.warn('Unable to parse JSON body', body);
      parsedBody = body;
    }
    const payload: Payload = body && req.method !== 'GET'
      ? parsedBody
      : parse(req.url, true).query;

    const result = moduleWithFn[HANDLER_TARGET]({
      payload,
      type: `HTTP_${req.method!.toUpperCase()}`,
      uriArgs,
    });
    const defaultHeaders = {
      'content-type': 'application/json',
    };
    res.status(result.status || 200);
    res.set({ ...defaultHeaders, ...result.headers });
    res.send(result.data || result);
    res.end();
    return;
  } catch (e) {
    console.error(e); // tslint:disable-line
    res.status(e.code || e.statusCode || 500);
    res.end();
    return;
  }
};

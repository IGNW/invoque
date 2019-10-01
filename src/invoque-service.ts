
import {
  ServerResponse,
} from 'http';
import {
  buffer,
  json,
} from 'micro';
import {
  parse,
} from 'url';
import {
  Functions,
  Invoquation,
  Payload,
  Request,
  Response,
} from './types';

const PAYLOAD_LIMIT_MAX_SIZE = '20mb';

export const payloadFromRequest = async (
  req: Request,
  simulateEvent: boolean,
): Promise<Payload> => {
  // simulate event with a context
  if (simulateEvent) {
    return {
      ...(req.body || await json(req)),
      context: {
        id: 'simulated.context.id',
        name: 'simulated.event.or.fn.name',
        timestamp: new Date().toISOString(),
      },
    };
  }
  // http get
  if (req.method === 'GET') {
    return parse(req.url, true).query;
  }
  // http 'other' request, try parsing json, otherwise return buffer (raw)
  try {
    const parsedJson = await json(req, { limit: PAYLOAD_LIMIT_MAX_SIZE });
    return parsedJson;
  } catch {
    return { buffer: await buffer(req, { limit: PAYLOAD_LIMIT_MAX_SIZE }) };
  }
};

export const serviceFromFunctions = (
  functions: Functions,
  simulateEvent: boolean = false,
) =>
  async (req: Request, res: ServerResponse) => {
    // DEP-WARNING: May deprecaate functions in favor of containerized
    // simulate event for serverless functions.
    const invocationType = simulateEvent
      ? 'invoque.simulated.event'
      : `HTTP_${req.method!.toUpperCase()}`;

    // get handler and args from path
    const [_, handler, ...args] = (parse(req.url!).pathname || '').split('/');

    // 404 if no handler method defined on target path
    if (!functions[handler]) {
      res.writeHead(404);
      res.end();
      return;
    }

    try {
      // generate a payload, throws with bad json/no body for non-get
      const payload = await payloadFromRequest(
        req,
        simulateEvent,
      );

      // log request
      // TODO:
      //  use debug module?
      //  be more verbose depending on request type / size?
      //  provide a hook for debugging in the invocation? (console.log works fine...?)
      // tslint:disable-next-line
      console.log(new Date().toISOString(), invocationType, handler, args);

      // invoke the target function with payload
      const invoquation: Invoquation = {
        args,
        payload,
        type: invocationType,
      };
      const result: Response = invocationType === 'HTTP_OPTIONS'
        ? {
          data: null,
          headers: {},
          message: 'OK',
          status: 200,
        }
        : await functions[handler](invoquation);

      const defaultHeaders = {
        'Access-Control-Allow-Headers': 'Content-Type, Access-Control-Allow-Headers, X-Requested-With',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, PATCH, DELETE',
        'Access-Control-Allow-Origin': '*',
        'content-type': 'application/json',
      };
      res.writeHead(
        result.status || 200,
        { ...defaultHeaders, ...result.headers },
      );
      // TODO: support streaming responses
      res.write(
        result.buffer ||
        JSON.stringify(result.data || result),
      );
      // TODO: log response/result
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

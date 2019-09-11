import {
  IncomingMessage,
  OutgoingHttpHeaders,
} from 'http';

export interface Payload {
  // context is effecitvely one of
  // https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html (AWS)
  // https://cloud.google.com/functions/docs/writing/background (GCF)
  // TODO: It could be a more strongly typed interface representing those props
  context?: any;
  [key: string]: any;
}

export interface Invoquation {
  type: string;
  payload: Payload;
  args: string[];
}

export interface Response {
  status: number;
  message: string;
  data: any;
  headers: OutgoingHttpHeaders;
}

export interface Functions {
  [key: string]: (event: Invoquation) => Response;
}

export interface Request extends IncomingMessage {
  body?: any;
  url: string;
}

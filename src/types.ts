import {
  IncomingMessage,
  OutgoingHttpHeaders,
} from 'http';

export interface Invoquation {
  type: string;
  payload: any;
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

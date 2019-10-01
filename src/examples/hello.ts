import * as fs from 'fs';
import { resolve } from 'path';
import { Invoquation } from '../types';

export const hello = ({ type, payload, args: [id] }: Invoquation) => {
  return `Hello ${type}, here is your ${payload.hello}`;
};

export const fancy = ({ type, payload }: Invoquation) => {
  return {
    message: 'Unauthorized',
    status: 401,
  };
};

export const goodbye = ({ type, payload }: Invoquation) => {
  throw new Error('boom');
};

export const withArgs = ({ type, payload, args: [id] }: Invoquation) => id;

export const useAsync = async () => {
  await Promise.resolve();
  return 'it works';
};

export const upload = ({ payload }: Invoquation) => {
  return {
    buffer: payload.buffer,
    headers: {
      'content-type': 'image/jpeg',
    },
    status: 200,
  };
};

export const bytes = () => {
  return {
    buffer: fs.readFileSync(resolve(process.cwd(), 'test/test-image.png')),
    headers: {
      'content-type': 'image/jpeg',
    },
  };
};

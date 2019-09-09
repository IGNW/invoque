import { Invoquation } from '../types';

export const hello = ({ type, payload, uriArgs: [id] }: Invoquation) => {
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

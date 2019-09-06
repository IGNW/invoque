import { Invoquation } from '../types';

export const hello = ({ type, payload }: Invoquation) => {
  console.log(payload);
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

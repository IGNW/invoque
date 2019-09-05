import * as fs from 'fs';
import { resolve } from 'path';
import { Functions } from './types';

export const functionsFromPath = (sourcePath: string): Functions =>
  !fs.lstatSync(sourcePath).isDirectory()
    ? require(sourcePath) // tslint:disable-line
    : fs.readdirSync(sourcePath).reduce((acc, file) => ({
      ...acc,
      ...require(resolve(process.cwd(), sourcePath, file)),
    }), { });

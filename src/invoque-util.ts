import * as fs from 'fs';
import {
  resolve,
} from 'path';
import { Functions } from './types';

export const functionsFromPath = (sourcePath: string): Functions =>
  !fs.lstatSync(sourcePath).isDirectory()
    ? require(sourcePath) // tslint:disable-line
    : fs.readdirSync(sourcePath)
      // if project is flat, remove invoque files / deps from the service
      .filter(
        (file: string) => file.indexOf('invoque-') === -1 && file.indexOf('node_modules') === -1,
      )
      .reduce((acc, file) => ({
        ...acc,
        ...require(resolve(process.cwd(), sourcePath, file)),
      }), { });

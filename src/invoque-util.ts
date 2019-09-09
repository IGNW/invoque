import * as fs from 'fs';
import {
  resolve,
} from 'path';
import { Functions } from './types';

export const functionsFromPath = (sourcePath: string): Functions =>
  !fs.lstatSync(sourcePath).isDirectory()
    ? require(sourcePath) // tslint:disable-line
    : fs.readdirSync(sourcePath)
      // remove invoque files / deps from the service target / dist
      .filter(
        (file: string) => file.indexOf('invoque-') === -1 && file.indexOf('node_modules') === -1,
      )
      // also omit subdirectories(no recursion yet / ever ?).
      .filter(
        (file: string) => !fs.lstatSync(resolve(process.cwd(), sourcePath, file)).isDirectory(),
      )
      .reduce((acc, file) => ({
        ...acc,
        ...require(resolve(process.cwd(), sourcePath, file)),
      }), { });

import { RequestListener } from 'http';
import { resolve } from 'path';
import * as request from 'supertest';
import {
  serviceFromFunctions,
} from '../src/invoque-service';
import {
  functionsFromPath,
} from '../src/invoque-util';

describe('google function hanlders', () => {
  let simulatedEventHandler: any;
  const handlers = resolve(process.cwd(), 'src/examples/events/handler.ts');
  beforeAll(() => {
    simulatedEventHandler = serviceFromFunctions(
      functionsFromPath(handlers),
      true,
    );
  });

  test('contains context in payload', async () => {
    const { body } = await request(simulatedEventHandler)
      .post('/handler')
      .send({ foo: 'bar' })
      .expect(200);
    expect(body.id).toContain('simulated');
  });

  test('simulated get breaks', async () => {
    await request(simulatedEventHandler)
      .get('/handler')
      .expect(500);
  });
});

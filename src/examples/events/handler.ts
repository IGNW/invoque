
import { Invoquation } from '../../types';
export const handler = ({ payload: { context }}: Invoquation) => context;

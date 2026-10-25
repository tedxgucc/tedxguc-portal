import { DEMO } from '../env';
import { demoApi } from './demo-api';
import { supabaseApi } from './supabase-api';
import type { Api } from './types';

export const api: Api = DEMO ? demoApi : supabaseApi;
export { ApiError } from './types';
export type * from './types';

/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { Credential } from '../../api/types.js';
import { HttpError } from './http.js';
import type { DashboardClient } from './types.js';

/** 카카오 API에 쓸 인증 정보를 Arisa에서 받아 온다. */
export async function readCredential(client: DashboardClient): Promise<Credential> {
  let auth: Credential;
  try {
    auth = await client.getCredential();
  } catch {
    throw new HttpError(503, 'Arisa에서 인증 정보를 불러올 수 없습니다. 연결을 확인해 주세요.');
  }
  if (!auth.accessToken || !auth.deviceUuid) throw new HttpError(503, 'Arisa 인증 정보가 올바르지 않습니다.');
  return auth;
}

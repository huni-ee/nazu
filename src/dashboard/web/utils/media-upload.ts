/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

const uploadHeaders = { 'X-Arisa-Dashboard': '1' };

// 보낼 조각만 읽고 파일 전체를 Base64 문자열로 만들지 않는다.
type UploadResponse = { uploadId?: unknown; chunkSize?: unknown; queued?: unknown };
type UploadRequest = (path: string, options: RequestInit) => Promise<UploadResponse>;

export async function uploadMedia(
  request: UploadRequest,
  files: File[],
  mode: string,
  onProgress: (sent: number, total: number) => void = () => {}
) {
  let uploadId: string | undefined;
  let complete = false;
  try {
    const session = await request('/media-uploads', {
      method: 'POST',
      headers: { ...uploadHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode,
        files: files.map((file) => ({
          name: file.name,
          mimeType: file.type || 'application/octet-stream',
          size: file.size
        }))
      })
    });
    if (typeof session.uploadId !== 'string' || !session.uploadId) throw new Error('업로드를 시작할 수 없습니다.');
    uploadId = encodeURIComponent(session.uploadId);
    const chunkSize = session.chunkSize;
    if (typeof chunkSize !== 'number' || !Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > 1048576) {
      throw new Error('올바르지 않은 업로드 설정입니다.');
    }
    const total = files.reduce((sum, file) => sum + file.size, 0);
    let sent = 0;
    for (const [index, file] of files.entries()) {
      for (let offset = 0; offset < file.size; offset += chunkSize) {
        const chunk = file.slice(offset, offset + chunkSize);
        await request(`/media-uploads/${uploadId}/${index}`, {
          method: 'POST',
          headers: {
            ...uploadHeaders,
            'Content-Type': 'application/octet-stream',
            'X-Arisa-Upload-Offset': String(offset)
          },
          body: chunk
        });
        sent += chunk.size;
        onProgress(sent, total);
      }
    }
    try {
      const result = await request(`/media-uploads/${uploadId}/complete`, { method: 'POST', headers: uploadHeaders });
      if (result?.queued !== true) throw new Error('Invalid upload completion response');
    } catch (failure) {
      // 응답이 끊기기 전에 서버가 이미 보냈을 수 있다.
      const details = failure as { name?: string; status?: number } | null;
      if (details?.name !== 'AbortError' && (!details?.status || details.status >= 500)) {
        const error = new Error(
          '첨부파일 전송 결과를 확인하지 못했습니다. 카카오톡에서 확인한 후 다시 시도해 주세요.',
          {
            cause: failure
          }
        );
        throw error;
      }
      throw failure;
    }
    complete = true;
  } finally {
    if (uploadId && !complete) {
      try {
        await request(`/media-uploads/${uploadId}`, { method: 'DELETE', headers: uploadHeaders });
      } catch {
        // 끊긴 업로드는 서버가 만료 시간에 정리한다.
      }
    }
  }
}

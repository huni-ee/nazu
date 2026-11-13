/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

/*
 * 참고:
 * https://github.com/ye-seola/kakaolink-py
 * https://github.com/naijun0403/kakaolink
 */

import { randomUUID } from 'node:crypto';
import axios, { type AxiosInstance } from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { Mutex } from 'async-mutex';
import { CookieJar } from 'tough-cookie';

const KAKAOTALK_VERSION = '26.8.1';
const ANDROID_SDK_VER = 34;
const ANDROID_WEBVIEW_UA =
  'Mozilla/5.0 (Linux; Android 14; SM-S908N Build/UP1A.231005.007; wv) ' +
  'AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 ' +
  'Chrome/126.0.6478.134 Mobile Safari/537.36';

/** 카카오링크 오류의 공통 부모입니다. 모든 카카오링크 오류는 이 클래스를 상속합니다. */
export class KakaoLinkException extends Error {
  constructor(message = '') {
    super(message);
    this.name = new.target.name;
  }
}

/** 조건에 맞는 수신자를 찾지 못하면 발생합니다. */
export class KakaoLinkReceiverNotFoundException extends KakaoLinkException {}

/** 로그인에 실패했거나 `init()` 전에 보내면 발생합니다. */
export class KakaoLinkLoginException extends KakaoLinkException {}

/** 로그인 중 추가 인증을 처리하지 못하면 발생합니다. */
export class KakaoLink2FAException extends KakaoLinkException {}

/** 메세지 전송에 실패하면 발생합니다. */
export class KakaoLinkSendException extends KakaoLinkException {}

/** 수신자를 찾을 범위입니다. `ALL`은 친구와 채팅방 모두, `FRIENDS`는 친구만, `CHATROOMS`는 채팅방만 찾습니다. */
export type SearchFrom = 'ALL' | 'FRIENDS' | 'CHATROOMS';

/** 찾을 채팅방 종류입니다. `OpenMultiChat`은 그룹 오픈채팅, `MultiChat`은 일반 그룹 채팅, `DirectChat`은 1:1 채팅입니다. */
export type SearchRoomType = 'ALL' | 'OpenMultiChat' | 'MultiChat' | 'DirectChat';

/** {@link KakaoLink}를 만들 때 넘기는 설정입니다. */
export interface KakaoLinkOptions {
  /** Kakao Developers에서 발급받은 JavaScript 키입니다. */
  readonly appKey: string;

  /** Kakao Developers에 등록한 웹 플랫폼 도메인입니다. */
  readonly origin: string;
}

/** `send()`에 넘기는 전송 옵션입니다. */
export interface KakaoLinkSendOptions {
  /** 받을 채팅방이나 친구의 이름입니다. */
  receiverName: string;

  /** 메세지 템플릿 ID입니다. */
  templateId: number;

  /**
   * 메세지 템플릿에 넣을 인자입니다.
   * @defaultValue `{}`
   */
  templateArgs?: Record<string, unknown>;

  /**
   * `true`이면 이름이 정확히 같은 수신자만, `false`이면 이름이 포함된 수신자도 찾습니다.
   * @defaultValue `true`
   */
  searchExact?: boolean;

  /**
   * 수신자를 찾을 범위입니다.
   * @defaultValue `'ALL'`
   */
  searchFrom?: SearchFrom;

  /**
   * 찾을 채팅방 종류입니다. 채팅방 종류가 있는 수신자에만 적용합니다.
   * @defaultValue `'ALL'`
   */
  searchRoomType?: SearchRoomType;
}

type KakaoLinkReceiver = Record<string, unknown> & {
  title?: string;
  profile_nickname?: string;
  chat_room_type?: string;
};
type KakaoLinkPickerData = Record<string, unknown> & {
  checksum?: string;
  csrfToken?: string;
  shortKey?: string;
  chats?: KakaoLinkReceiver[];
  friends?: KakaoLinkReceiver[];
};

interface ArisaAuthorizationSource {
  getCredential(): Promise<{ accessToken: string; deviceUuid: string }>;
}

/**
 * 카카오링크 메세지 템플릿을 친구나 채팅방에 보냅니다.
 *
 * `client.kakaoLink()`로 만들고, `init()`이 끝난 뒤 `send()`로 보냅니다.
 *
 * @example
 * ```ts
 * const kakaoLink = client.kakaoLink({ appKey: 'JavaScript 키', origin: '등록한 웹 도메인' });
 * await kakaoLink.init();
 * await kakaoLink.send({ receiverName: '채팅방 이름', templateId: 12345 });
 * ```
 */
export class KakaoLink {
  private readonly appKey: string;
  private readonly origin: string;
  private readonly arisa: ArisaAuthorizationSource;
  private readonly cookies = new CookieJar();
  private readonly sendLock = new Mutex();
  private initialization: Promise<void> | null = null;

  /** @internal `client.kakaoLink()`로 만드세요. */
  constructor(arisa: ArisaAuthorizationSource, options: KakaoLinkOptions) {
    this.arisa = arisa;
    this.appKey = options.appKey;
    this.origin = options.origin;
  }

  /**
   * 메세지 템플릿을 보냅니다. 조건에 맞는 수신자가 여럿이면 처음 찾은 수신자에게 보냅니다.
   *
   * @param options 수신자, 템플릿, 검색 조건입니다.
   * @throws {@link KakaoLinkLoginException} `init()` 전에 호출하면 발생합니다.
   * @throws {@link KakaoLinkReceiverNotFoundException} 수신자를 찾지 못하면 발생합니다.
   * @throws {@link KakaoLinkSendException} 전송에 실패하면 발생합니다.
   */
  async send({
    receiverName,
    templateId,
    templateArgs = {},
    searchExact = true,
    searchFrom = 'ALL',
    searchRoomType = 'ALL'
  }: KakaoLinkSendOptions): Promise<void> {
    if (this.initialization === null) {
      throw new KakaoLinkLoginException('카카오링크를 먼저 초기화해야 합니다.');
    }

    const ka = this.getKa(this.origin);

    await this.sendLock.runExclusive(async () => {
      const client = wrapper(
        axios.create({
          jar: this.cookies,
          maxRedirects: 0,
          validateStatus: () => true
        })
      );
      const pickerData = await this.getPickerData(client, this.appKey, ka, templateId, templateArgs);

      const checksum = pickerData.checksum;
      const csrf = pickerData.csrfToken;
      const shortKey = pickerData.shortKey;
      if (checksum === undefined || csrf === undefined || shortKey === undefined) {
        console.error('카카오링크 전송: 전송 실패 (%s)', pickerData, new Error().stack);
        throw new KakaoLinkSendException();
      }

      const receiver = this.findReceiver(receiverName, pickerData, searchExact, searchFrom, searchRoomType);

      await this.sendPicker(client, this.appKey, shortKey, checksum, csrf, receiver);
    });
  }

  private async sendPicker(
    client: AxiosInstance,
    appKey: string,
    shortKey: string,
    checksum: string,
    csrf: string,
    receiver: KakaoLinkReceiver
  ): Promise<void> {
    const encodedReceiver = Buffer.from(JSON.stringify(receiver), 'utf8').toString('base64url');
    const res = await client.post(
      'https://sharer.kakao.com/picker/send',
      new URLSearchParams({
        app_key: appKey,
        short_key: shortKey,
        checksum,
        _csrf: csrf,
        receiver: encodedReceiver.padEnd(Math.ceil(encodedReceiver.length / 4) * 4, '=')
      })
    );

    if (res.status === 400) {
      console.error('카카오링크 전송: 전송 실패 (%s)', res.status, new Error().stack);
      throw new KakaoLinkSendException();
    }
  }

  private findReceiver(
    receiverName: string,
    pickerData: KakaoLinkPickerData,
    searchExact: boolean,
    searchFrom: SearchFrom,
    searchRoomType: SearchRoomType
  ): KakaoLinkReceiver {
    const receivers = [
      ...(searchFrom === 'ALL' || searchFrom === 'CHATROOMS' ? (pickerData.chats ?? []) : []),
      ...(searchFrom === 'ALL' || searchFrom === 'FRIENDS' ? (pickerData.friends ?? []) : [])
    ];

    for (const receiver of receivers) {
      const currentChatType = receiver.chat_room_type;
      const currentTitle = receiver.title ?? receiver.profile_nickname ?? '';

      if (currentChatType) {
        if (searchRoomType !== 'ALL' && searchRoomType !== currentChatType) {
          continue;
        }
      }

      if (searchExact) {
        if (currentTitle === receiverName) return receiver;
      } else if (currentTitle.includes(receiverName)) {
        return receiver;
      }
    }

    throw new KakaoLinkReceiverNotFoundException();
  }

  private async getPickerData(
    client: AxiosInstance,
    appKey: string,
    ka: string,
    templateId: number,
    templateArgs: Record<string, unknown>
  ): Promise<KakaoLinkPickerData> {
    let responseUrl = new URL('https://sharer.kakao.com/picker/link');
    const beforeRedirect = (options: Record<string, unknown>): void => {
      if (typeof options.href === 'string') {
        responseUrl = new URL(options.href);
      }
    };

    const validationParams: Record<string, unknown> = {
      link_ver: '4.0',
      template_id: templateId,
      template_args: templateArgs
    };

    const params: Record<string, string> = {
      app_key: appKey,
      ka,
      validation_action: 'custom',
      validation_params: JSON.stringify(validationParams)
    };

    let res = await client.post(responseUrl.toString(), new URLSearchParams(params), {
      headers: this.getWebHeaders(),
      maxRedirects: 20,
      beforeRedirect,
      responseType: 'text'
    });

    if (responseUrl.pathname.startsWith('/login')) {
      const continueUrl = responseUrl.searchParams.get('continue');

      await this.login(client);
      responseUrl = new URL(continueUrl!);
      res = await client.get(responseUrl.toString(), {
        headers: this.getWebHeaders(),
        maxRedirects: 20,
        beforeRedirect,
        responseType: 'text'
      });
    }

    if (responseUrl.pathname.startsWith('/talk_tms_auth/service')) {
      console.info('카카오링크 전송: 추가인증 해결 중');
      const continueUrl = await this.solveTwoFactorAuth(client, String(res.data));

      res = await client.get(continueUrl, {
        headers: this.getWebHeaders(),
        maxRedirects: 20,
        beforeRedirect,
        responseType: 'text'
      });
    }

    const encoded = (res.data as string).split('window.serverData = "')[1]!.split('"')[0]!.trim();

    return (JSON.parse(Buffer.from(`${encoded}====`, 'base64url').toString('utf8')) as { data: KakaoLinkPickerData })
      .data;
  }

  /**
   * Arisa의 인증 정보로 카카오링크에 로그인합니다. `send()` 전에 끝나 있어야 합니다.
   *
   * @throws {@link KakaoLinkLoginException} 로그인에 실패하면 발생합니다.
   * @throws {@link KakaoLink2FAException} 추가 인증을 처리하지 못하면 발생합니다.
   */
  async init(): Promise<void> {
    if (this.initialization !== null) return this.initialization;

    this.initialization = this.initialize();
    try {
      await this.initialization;
    } catch (error) {
      this.initialization = null;
      throw error;
    }
  }

  private async initialize(): Promise<void> {
    const client = wrapper(
      axios.create({
        jar: this.cookies,
        maxRedirects: 0,
        validateStatus: () => true
      })
    );
    await this.login(client);
  }

  private async login(client: AxiosInstance): Promise<void> {
    const credential = await this.arisa.getCredential();
    const authorization = `${credential.accessToken}-${credential.deviceUuid}`;
    this.cookies.removeAllCookiesSync();

    const tgtToken = await this.getTgtToken(client, authorization);
    await this.submitTgtToken(client, tgtToken);
  }

  private async solveTwoFactorAuth(client: AxiosInstance, tfaHtml: string): Promise<string> {
    let token: string;
    let continueUrl: string;
    let csrf: string;

    try {
      const props = JSON.parse(
        tfaHtml.split('<script id="__NEXT_DATA__" type="application/json">')[1]!.split('</script>')[0]!.trim()
      ) as {
        props: {
          pageProps: {
            pageContext: {
              context: { token: string; continueUrl: string };
              commonContext: { _csrf: string };
            };
          };
        };
      };

      const context = props.props.pageProps.pageContext.context;
      const commonContext = props.props.pageProps.pageContext.commonContext;
      token = context.token;
      continueUrl = context.continueUrl;
      csrf = commonContext._csrf;
    } catch (error) {
      console.error('카카오링크 추가인증: 추가인증 토큰 파싱 실패', error);
      throw new KakaoLink2FAException();
    }

    await this.confirmToken(client, token);

    const res = await client.post(
      'https://accounts.kakao.com/api/v2/talk_tms_auth/poll_from_service.json',
      {
        _csrf: csrf,
        token
      },
      { headers: this.getWebHeaders() }
    );
    const status = (res.data as { status?: number }).status;
    if (status !== 0) {
      console.error('카카오링크 추가인증: 알 수 없는 오류 (%s)', status, new Error().stack);
      throw new KakaoLink2FAException();
    }

    return continueUrl;
  }

  private async confirmToken(client: AxiosInstance, twoFactorToken: string): Promise<void> {
    const res = await client.get('https://auth.kakao.com/fa/main.html', {
      params: {
        os: 'android',
        country_iso: 'KR',
        lang: 'ko',
        v: KAKAOTALK_VERSION,
        os_version: ANDROID_SDK_VER,
        page: 'additional_auth_with_token',
        additional_auth_token: twoFactorToken,
        close_on_completion: 'true',
        talk_tms_auth_type: 'from_service'
      },
      responseType: 'text'
    });

    let csrf: string;
    let data: { client_id: string; additionalAuthToken: string };
    try {
      csrf = (res.data as string).split('<meta name="csrf-token" content="')[1]!.split('"')[0]!.trim();

      let options = (res.data as string).split('var options =')[1]!.split('new PageBuilder()')[0]!.trim();
      while (options.startsWith(';')) options = options.slice(1).trimStart();
      while (options.endsWith(';')) options = options.slice(0, -1).trimEnd();

      data = JSON.parse(options) as {
        client_id: string;
        additionalAuthToken: string;
      };
    } catch (error) {
      console.error('카카오 링크 추가인증: csrf, client_id 데이터 파싱 실패', error);
      throw new KakaoLink2FAException();
    }

    const confirmResponse = await client.post(
      'https://auth.kakao.com/talk_tms_auth/confirm_token.json',
      new URLSearchParams({
        client_id: data.client_id,
        lang: 'ko',
        os: 'android',
        v: KAKAOTALK_VERSION,
        webview_v: '2',
        token: data.additionalAuthToken,
        talk_tms_auth_type: 'from_service',
        authenticity_token: csrf
      })
    );
    const status = (confirmResponse.data as { status?: number }).status;
    if (status !== 0) {
      console.error('카카오링크 추가인증: 알 수 없는 오류 (%s)', status, new Error().stack);
      throw new KakaoLink2FAException();
    }
  }

  private async submitTgtToken(client: AxiosInstance, tgtToken: string): Promise<void> {
    await client.get('https://e.kakao.com', {
      headers: {
        ...this.getWebHeaders(),
        'ka-tgt': tgtToken
      },
      validateStatus: (status) => status >= 200 && status < 300
    });
  }

  private async getTgtToken(client: AxiosInstance, token: string): Promise<string> {
    const res = await client.post(
      'https://api-account.kakao.com/v1/auth/tgt',
      new URLSearchParams({
        key_type: 'talk_session_info',
        key: token,
        referer: 'talk'
      }),
      { headers: this.getAppHeaders(token) }
    );
    const responseJson = res.data as { code?: number; token?: string };
    if (responseJson.code !== 0) {
      console.error('카카오링크 로그인: tgt 토큰 발급 중 오류가 발생했습니다 (%s)', responseJson, new Error().stack);
      throw new KakaoLinkLoginException();
    }
    return responseJson.token!;
  }

  private getKa(origin: string): string {
    return `sdk/2.8.3 os/javascript sdk_type/javascript lang/ko-KR device/Linux_x86_64 origin/${quote(origin)}`;
  }

  private getAppHeaders(token: string): Record<string, string> {
    return {
      A: `android/${KAKAOTALK_VERSION}/ko`,
      C: randomUUID(),
      'User-Agent': `KT/${KAKAOTALK_VERSION} An/14 ko`,
      Authorization: token
    };
  }

  private getWebHeaders(): Record<string, string> {
    return {
      'User-Agent': `${ANDROID_WEBVIEW_UA} KAKAOTALK/${KAKAOTALK_VERSION} (INAPP)`,
      'X-Requested-With': 'com.kakao.talk'
    };
  }
}

function quote(value: string): string {
  return encodeURIComponent(value)
    .replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`)
    .replace(/%2F/g, '/');
}

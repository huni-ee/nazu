<h1 align="center">
  <img src="https://raw.githubusercontent.com/huni-ee/nazu/main/.github/assets/logo.png" alt="" width="100" height="100"><br>
  Nazu
</h1>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D24.11.0-339933?logo=node.js&logoColor=white" alt="Node.js 24.11.0 이상">
  <img src="https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript 타입 포함">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue" alt="License: Apache-2.0"></a>
  <a href="https://nazu.huniee.dev/docs"><img src="https://img.shields.io/badge/docs-nazu.huniee.dev-f5c542" alt="문서"></a>
</p>

<p align="center">
  <a href="https://github.com/ye-seola/arisa2">Arisa</a> 기반 카카오톡 봇 Node.js 라이브러리
</p>

## 시작하기

### 준비

- Node.js 24.11.0 이상
- 실행 중인 Arisa 서버 (설치 및 실행 방법은 [환경 준비 문서](https://nazu.huniee.dev/docs) 참고)

### 설치

```sh
npm install @huni_ee/nazu
```

예제는 [사용 예시](https://nazu.huniee.dev/docs/examples)에서 볼 수 있습니다.

> 메서드와 타입은 [레퍼런스](https://nazu.huniee.dev/docs/reference)에서 확인할 수 있습니다.

## 샘플 봇

[nazu_bot](https://github.com/huni-ee/nazu_bot)은 Arisa + Nazu 기반 샘플 봇입니다.

## 개발

| 명령                     | 설명                                           |
| ------------------------ | ---------------------------------------------- |
| `npm install`            | 의존성 설치                                    |
| `npm run build`          | 라이브러리와 대시보드 빌드                     |
| `npm run check`          | lint, 타입 검사, 포맷 검사                     |
| `npm run proto:generate` | `proto/arisa.proto`를 바꾼 뒤 gRPC 코드 재생성 |

## 주의

Nazu는 Kakao Corp.가 만들거나 인가하지 않았으며, 언제든지 이용이 제한될 수 있습니다. 라이브러리 사용으로 생기는 책임과 불이익은 모두 사용자에게 있습니다.

## 라이선스

Nazu는 Apache License 2.0을 따릅니다.

전문은 [`LICENSE`](LICENSE)를 참고하세요. 대시보드에 포함한 외부 자료의 라이선스 원문은 [`licenses`](src/dashboard/web/public/licenses) 폴더에 있고, 출처는 해당 코드에 주석으로 적었습니다.

## 참고한 프로젝트

- [kakaolink-py](https://github.com/ye-seola/kakaolink-py), [kakaolink](https://github.com/naijun0403/kakaolink): 카카오링크
- [KiwiTalk](https://github.com/KiwiTalk/KiwiTalk), [Fuwari](https://github.com/saicaca/fuwari): 대시보드 화면

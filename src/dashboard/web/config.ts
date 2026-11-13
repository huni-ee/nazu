/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

import type { IconConfig, NavBarConfig, SiteConfig } from './types/config.js';

export const siteConfig: SiteConfig = {
  title: 'Arisa Dashboard', // 브라우저 탭 제목
  themeColor: {
    hue: 165, // 테마 색상. 0~360 범위이며 기본값은 165입니다.
    fixed: false // true로 설정하면 테마 색상 선택기를 숨깁니다.
  },
  favicon: [
    {
      src: '/images/favicon.ico'
    }
  ]
};

export const navBarConfig: NavBarConfig = {
  // 사이드바 위쪽 메뉴. 배열 순서대로 표시됩니다.
  links: [
    {
      id: 'nav-home',
      name: '홈',
      icon: 'home',
      active: true // 초기 화면은 홈입니다.
    },
    {
      id: 'nav-friends', // 메뉴 동작을 연결하는 ID
      name: '친구', // 메뉴 버튼에 표시되는 이름
      icon: 'users', // 아래 iconConfig에 정의한 이름
      active: false
    },
    {
      id: 'nav-chat',
      name: '채팅방',
      icon: 'chat',
      active: false
    },
    {
      id: 'nav-openchat',
      name: '오픈채팅방',
      icon: 'openchat',
      active: false
    }
  ],
  // 사이드바 아래쪽 메뉴
  actions: [
    {
      id: 'nav-settings',
      name: '설정',
      icon: 'settings',
      active: false
    }
  ]
};

// 아이콘 라이선스: ri(Remix Icon, Apache-2.0), lucide(ISC), material-symbols(Apache-2.0), mage(Apache-2.0),
// tabler(MIT), fa6-solid(Font Awesome Free, CC BY 4.0). 원문은 public/licenses/에 있습니다.
export const iconConfig = {
  home: 'material-symbols:home-outline-rounded', // Fuwari의 홈 아이콘
  chat: 'ri:chat-3-line', // 아이콘 코드: https://icones.js.org/ (컬렉션:아이콘)
  // 새 컬렉션은 `npm install -D @iconify-json/<컬렉션>`으로 설치합니다.
  // 아이콘 변경 후 `npm run build`를 실행하면 화면에 반영됩니다.
  user: 'ri:user-line',
  users: 'ri:group-line',
  favorite: 'ri:star-fill',
  'favorite-outline': 'ri:star-line',
  settings: 'ri:settings-4-line',
  search: 'ri:search-line',
  'lookup-search': 'material-symbols:search', // Fuwari의 검색 입력 아이콘
  'channel-enter': 'lucide:log-in',
  'message-search': 'lucide:message-square-text',
  decrypt: 'lucide:key-round',
  database: 'lucide:database',
  'chevron-right': 'material-symbols:chevron-right-rounded', // Fuwari의 페이지 이동 화살표
  calendar: 'lucide:calendar-days',
  copy: 'lucide:copy',
  check: 'lucide:check',
  'id-card': 'lucide:id-card',
  info: 'lucide:info',
  music: 'lucide:music-4',
  phone: 'tabler:device-mobile',
  refresh: 'lucide:refresh-ccw',
  openchat: 'mage:message-conversation',
  'theme-system': 'material-symbols:radio-button-partial-outline',
  'theme-light': 'material-symbols:wb-sunny-outline-rounded',
  'theme-dark': 'material-symbols:dark-mode-outline-rounded',
  'theme-color': 'material-symbols:palette-outline', // Fuwari Navbar의 색상 아이콘
  'theme-reset': 'fa6-solid:arrow-rotate-left', // Fuwari DisplaySettings의 복원 아이콘
  send: 'lucide:send',
  paperclip: 'lucide:paperclip',
  'chevron-down': 'lucide:chevron-down',
  'chevron-left': 'lucide:chevron-left'
} as const satisfies IconConfig;

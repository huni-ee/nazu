/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

export type SiteConfig = {
  title: string;
  themeColor: {
    hue: number;
    fixed: boolean;
  };
  favicon: { src: string }[];
};

type DashboardIconName =
  | 'home'
  | 'chat'
  | 'user'
  | 'users'
  | 'favorite'
  | 'favorite-outline'
  | 'settings'
  | 'search'
  | 'lookup-search'
  | 'channel-enter'
  | 'message-search'
  | 'decrypt'
  | 'database'
  | 'chevron-right'
  | 'calendar'
  | 'copy'
  | 'check'
  | 'id-card'
  | 'info'
  | 'music'
  | 'phone'
  | 'refresh'
  | 'openchat'
  | 'theme-system'
  | 'theme-light'
  | 'theme-dark'
  | 'theme-color'
  | 'theme-reset'
  | 'send'
  | 'paperclip'
  | 'chevron-down'
  | 'chevron-left';

export type IconConfig = Record<DashboardIconName, `${string}:${string}`>;

type NavBarItem = {
  id: `nav-${string}`;
  name: string;
  icon: DashboardIconName;
  active: boolean;
};

export type NavBarConfig = {
  links: NavBarItem[];
  actions: NavBarItem[];
};

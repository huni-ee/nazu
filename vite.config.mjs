import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { getIconData, iconToHTML, iconToSVG } from '@iconify/utils';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import ts from 'typescript';
import { defineConfig } from 'vite';
import { iconConfig, siteConfig } from './src/dashboard/web/config.ts';

const root = fileURLToPath(new URL('./src/dashboard/web/', import.meta.url));
const require = createRequire(import.meta.url);

// iconConfig에 적힌 Iconify 아이콘을 빌드할 때 SVG 문자열로 만든다.
function dashboardIcons() {
  const virtualId = 'virtual:dashboard-icons';
  const resolvedId = `\0${virtualId}`;
  return {
    name: 'dashboard-icons',
    resolveId(id) {
      if (id === virtualId) return resolvedId;
    },
    load(id) {
      if (id !== resolvedId) return;
      const icons = {};
      for (const [name, identifier] of Object.entries(iconConfig)) {
        const [prefix, iconName] = identifier.split(':');
        const iconSet = require(`@iconify-json/${prefix}/icons.json`);
        const data = getIconData(iconSet, iconName);
        if (!data) throw new Error(`Missing dashboard icon: ${identifier}`);
        const result = iconToSVG(data);
        icons[name] = iconToHTML(result.body, {
          ...result.attributes,
          class: `icon icon-${name}`,
          'aria-hidden': 'true'
        });
      }
      return `export default ${JSON.stringify(icons)};`;
    }
  };
}

function dashboardHtml() {
  const escape = (value) =>
    String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  return {
    name: 'dashboard-html',
    transformIndexHtml(html) {
      return html
        .replace('%THEME_HUE%', escape(siteConfig.themeColor.hue))
        .replace('%THEME_FIXED%', String(siteConfig.themeColor.fixed))
        .replace('%TITLE%', escape(siteConfig.title))
        .replace(
          '%FAVICONS%',
          siteConfig.favicon.map(({ src }) => `<link rel="icon" href="${escape(src)}" />`).join('\n    ')
        );
    },
    async generateBundle() {
      // theme-init.js는 화면을 그리기 전에 실행해야 하므로 모듈이 아닌 일반 스크립트로 따로 만든다.
      this.emitFile({
        type: 'asset',
        fileName: 'assets/theme-init.js',
        source: ts.transpileModule(
          await readFile(new URL('./src/dashboard/web/utils/theme-init.ts', import.meta.url), 'utf8'),
          {
            compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
          }
        ).outputText
      });
    }
  };
}

// 번들 처리가 끝난 뒤 태그를 넣어야 Vite가 일반 스크립트를 묶으려 하지 않는다.
function themeInitScript() {
  return {
    name: 'dashboard-theme-init',
    transformIndexHtml: {
      order: 'post',
      handler() {
        return [{ tag: 'script', attrs: { src: '/assets/theme-init.js' }, injectTo: 'head' }];
      }
    }
  };
}

export default defineConfig({
  root,
  publicDir: 'public',
  plugins: [
    dashboardIcons(),
    dashboardHtml(),
    themeInitScript(),
    svelte({ configFile: fileURLToPath(new URL('./svelte.config.mjs', import.meta.url)) })
  ],
  build: {
    outDir: fileURLToPath(new URL('./dist/dashboard/web/', import.meta.url)),
    assetsDir: 'assets',
    assetsInlineLimit: 0,
    emptyOutDir: true
  }
});

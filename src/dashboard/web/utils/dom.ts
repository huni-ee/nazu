/*
 * Created on Fri Nov 13 2026
 *
 * Copyright (c) huni-ee. Licensed under the Apache-2.0 License.
 */

export const byId = (id: string) => document.getElementById(id);

export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, textValue?: string) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textValue !== undefined) node.textContent = textValue;
  return node;
}

export function icon(name: string): Element {
  const template = byId(`dashboard-icon-${name}`);
  if (!(template instanceof HTMLTemplateElement) || !template.content.firstElementChild) {
    throw new Error(`Dashboard icon not found: ${name}`);
  }
  return template.content.firstElementChild.cloneNode(true) as Element;
}

export function button(className: string, label: string, onClick: (event: MouseEvent) => void) {
  const node = element('button', className, label);
  node.type = 'button';
  node.addEventListener('click', onClick);
  return node;
}

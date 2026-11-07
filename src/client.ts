import { createElement, type ComponentType } from 'react';
import {
  conversationSlot, NovelConversation, ReaderPanel, type PanelSlots, type SessionServices,
} from './companion-panel.js';

const id = 'dsh-novel-readnest';

interface Slots {
  inject(name: string, mount: () => () => void): () => void;
  register<Props>(
    options: {
      name: string; id?: string; key?: string; label?: string; order?: number;
      children?: Record<string, { kind: 'single'; scope: 'session' }>;
    },
    component: ComponentType<Props>,
  ): () => void;
}

function BookIcon() {
  return createElement(
    'svg',
    { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': true },
    createElement('path', {
      d: 'M12 6v15M3 4.5C7 4 9.5 4.5 12 7c2.5-2.5 5-3 9-2.5v14c-4-.5-6.5 0-9 2.5-2.5-2.5-5-3-9-2.5z',
      stroke: 'currentColor',
      strokeWidth: 1.6,
      strokeLinejoin: 'round',
    }),
  );
}

export const name = id;
export const inject = ['slots', 'sessions', 'workspaces'];

export function apply(ctx: { slots: Slots } & SessionServices) {
  const { slots } = ctx;
  slots.inject('main', () => slots.register({
    name: 'main', key: id, children: { [conversationSlot]: { kind: 'single', scope: 'session' } },
  }, (props: PanelSlots) => createElement(ReaderPanel, { ...props, services: ctx })));
  slots.inject(conversationSlot, () => slots.register({ name: conversationSlot }, NovelConversation));
  slots.inject('sidebar.panellist', () =>
    slots.register({ name: 'sidebar.panellist', id, label: '小说阅读', order: 30 }, BookIcon),
  );
}

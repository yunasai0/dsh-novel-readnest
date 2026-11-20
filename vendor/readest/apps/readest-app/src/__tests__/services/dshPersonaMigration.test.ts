import { beforeEach, describe, expect, it } from 'vitest';
import currentPersona from '@dsh-reader/personas/da-fei-yu.json';
import previousPersona from '@dsh-reader/personas/da-fei-yu-v1.json';
import { assembleNovelPrompt, defaultPersonaId, personaStorageKey, readNovelPersonaSettings } from '@dsh-reader/persona';

beforeEach(() => localStorage.clear());

describe('built-in reading persona upgrade', () => {
  it('ships valid tool instructions and upgrades the exact previous default', () => {
    expect(assembleNovelPrompt(readNovelPersonaSettings().personas[0]?.prompt)).not.toContain('read_novel');
    expect(previousPersona.prompt).toContain('read_novel');
    localStorage.setItem(personaStorageKey, JSON.stringify({
      activeId: previousPersona.id, personas: [previousPersona], builtInPersonasVersion: 1,
    }));
    expect(readNovelPersonaSettings()).toEqual({ activeId: currentPersona.id, personas: [currentPersona] });
    expect(JSON.parse(localStorage.getItem(personaStorageKey)!)).toMatchObject({
      builtInPersonasVersion: 2, personas: [currentPersona],
    });
  });

  it.each([
    { ...previousPersona, name: '我的大肥鱼' },
    { ...previousPersona, prompt: previousPersona.prompt + '\n我的批注' },
  ])('preserves edits to the old built-in copy', edited => {
    localStorage.setItem(personaStorageKey, JSON.stringify({
      activeId: edited.id, personas: [edited], builtInPersonasVersion: 1,
    }));
    expect(readNovelPersonaSettings()).toEqual({ activeId: edited.id, personas: [edited] });
    expect(readNovelPersonaSettings().personas).toEqual([edited]);
  });

  it('honors a deletion on upgrade and on subsequent loads', () => {
    localStorage.setItem(personaStorageKey, JSON.stringify({
      activeId: defaultPersonaId, personas: [], builtInPersonasVersion: 1,
    }));
    expect(readNovelPersonaSettings().personas).toEqual([]);
    expect(readNovelPersonaSettings().personas).toEqual([]);
  });
});

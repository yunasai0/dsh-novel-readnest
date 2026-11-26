// Only identifiers cross the browser/host boundary. The host resolves the actual content and tool.
export interface SkillChoice { name: string; key: string; tool: string }
export interface SkillCatalog { skills: { name: string; key: string; description: string }[]; tools: { name: string; id: string }[] }
export const skillCatalogEndpoint = '/novel-reader/companion-skills';
export const skillStoragePrefix = 'dsh.novel-reader.persona-skill.v1:';
export function isSkillChoice(value: unknown): value is SkillChoice {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<SkillChoice>;
  return typeof v.name === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(v.name) && v.name.length <= 128 &&
    typeof v.key === 'string' && /^[0-9a-f]{64}$/.test(v.key) &&
    typeof v.tool === 'string' && v.tool.length <= 128 && /^[a-zA-Z0-9_.-]*$/.test(v.tool);
}
export function savedSkill(personaId: string): SkillChoice | undefined {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(skillStoragePrefix + personaId) ?? 'null');
    return isSkillChoice(value) ? value : undefined;
  } catch { return undefined; }
}
export function saveSkill(personaId: string, choice: SkillChoice | null) {
  const key = skillStoragePrefix + personaId;
  if (choice) localStorage.setItem(key, JSON.stringify(choice));
  else localStorage.removeItem(key);
}

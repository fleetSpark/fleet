import { BUILTIN_TEMPLATES } from './templates.js';
export type { MissionTemplate } from './templates.js';

export function listTemplates() {
  return [...BUILTIN_TEMPLATES];
}

export function getTemplate(name: string) {
  return BUILTIN_TEMPLATES.find((t) => t.name === name);
}

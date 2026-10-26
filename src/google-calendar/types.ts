export type CalendarState = { configured: boolean; connected: boolean; authorizing: boolean; error?: string;
  permissions?: { calendar: 'read-only' | 'read-write'; tasks: 'read-only' | 'read-write' };
  access?: 'unverified' | 'ready' | 'blocked'; checkedAt?: string; setupUrl?: string;
  apiSetup?: { calendar: string; tasks: string };
  tasks?: { access: 'unverified' | 'ready' | 'blocked' | 'permission-needed'; checkedAt?: string; error?: string; setupUrl?: string } };

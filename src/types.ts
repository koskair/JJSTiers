export type TierId = 'S+' | 'S' | 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D';
export type Region = 'OCE' | 'NA' | 'SA' | 'AS' | 'EU';

export interface Player {
  id: string;
  name: string;
  region: Region;
  avatarUrl?: string;
  robloxUsername?: string;
}

export interface Tier {
  id: TierId;
  label: string;
  color: string;
  playerIds: string[];
}

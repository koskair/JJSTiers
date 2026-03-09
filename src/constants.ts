import { Player, Tier } from './types';

export const INITIAL_PLAYERS: Player[] = [];

export const INITIAL_TIERS: Tier[] = [
  { id: 'S+', label: 'S+', color: '#ff4444', playerIds: [] },
  { id: 'S', label: 'S', color: '#ff7f7f', playerIds: [] },
  { id: 'A+', label: 'A+', color: '#ffbf7f', playerIds: [] },
  { id: 'A', label: 'A', color: '#ffff7f', playerIds: [] },
  { id: 'B+', label: 'B+', color: '#7fff7f', playerIds: [] },
  { id: 'B', label: 'B', color: '#7fbfff', playerIds: [] },
  { id: 'C', label: 'C', color: '#7f7fff', playerIds: [] },
  { id: 'D', label: 'D', color: '#bf7fff', playerIds: [] },
];

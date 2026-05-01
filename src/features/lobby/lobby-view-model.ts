import type { LobbyListItem, LobbyStatus } from '@/api/realtime/dtos';

export type HostMode = 'new_game' | 'load_save';
export type LobbyStatusSeverity = 'success' | 'warning' | 'danger';

export function sortLobbiesByName(lobbies: LobbyListItem[]): LobbyListItem[] {
  return [...lobbies].sort((a, b) => a.name.localeCompare(b.name));
}

export function lobbyStatusSeverity(status: LobbyStatus): LobbyStatusSeverity {
  switch (status) {
    case 'waiting':
      return 'warning';
    case 'in_game':
      return 'success';
    default:
      return 'danger';
  }
}

export function canCreateLobby(name: string, mode: HostMode, selectedSaveId: string | null): boolean {
  return name.trim().length > 0 && (mode === 'new_game' || Boolean(selectedSaveId));
}

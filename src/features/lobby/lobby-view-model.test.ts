import { describe, expect, it } from 'vitest';
import { canCreateLobby, lobbyStatusSeverity, sortLobbiesByName } from './lobby-view-model';

describe('lobby view model', () => {
  it('sorts lobby rows by display name without mutating source state', () => {
    const lobbies = [
      { lobbyId: 'b', name: 'Bravo', hostLabel: 'Host', playerCount: 1, status: 'waiting' as const, origin: 'new_game' as const },
      { lobbyId: 'a', name: 'Alpha', hostLabel: 'Host', playerCount: 1, status: 'waiting' as const, origin: 'new_game' as const },
    ];

    expect(sortLobbiesByName(lobbies).map((lobby) => lobby.name)).toEqual(['Alpha', 'Bravo']);
    expect(lobbies.map((lobby) => lobby.name)).toEqual(['Bravo', 'Alpha']);
  });

  it('keeps create-lobby availability aligned with host mode requirements', () => {
    expect(canCreateLobby('Frontier Hall', 'new_game', null)).toBe(true);
    expect(canCreateLobby('Frontier Hall', 'load_save', null)).toBe(false);
    expect(canCreateLobby('Frontier Hall', 'load_save', 'save-1')).toBe(true);
    expect(canCreateLobby('   ', 'new_game', null)).toBe(false);
  });

  it('maps backend lobby statuses to PrimeReact tag severities', () => {
    expect(lobbyStatusSeverity('waiting')).toBe('warning');
    expect(lobbyStatusSeverity('in_game')).toBe('success');
    expect(lobbyStatusSeverity('closed')).toBe('danger');
  });
});

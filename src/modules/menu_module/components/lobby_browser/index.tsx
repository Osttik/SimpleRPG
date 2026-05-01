import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { ProgressSpinner } from 'primereact/progressspinner';
import { SelectButton } from 'primereact/selectbutton';
import { Tag } from 'primereact/tag';
import { lobbyClient } from '@/api/realtime/lobby-client';
import { createFrontendLogger } from '@/services/logger';
import { selectLobbyState } from '@/store/slices/lobby.slice';
import { SaveSlotPicker } from '../save_slot_picker';

const _logger = createFrontendLogger('lobby');

const hostModeOptions = [
  { label: 'New Game', value: 'new_game' as const },
  { label: 'Load Save', value: 'load_save' as const },
];

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function statusSeverity(status: 'waiting' | 'in_game' | 'closed') {
  switch (status) {
    case 'waiting':
      return 'warning';
    case 'in_game':
      return 'success';
    default:
      return 'danger';
  }
}

export function LobbyBrowserScreen() {
  const navigate = useNavigate();
  const lobbyState = selectLobbyState();
  const [hostDialogVisible, setHostDialogVisible] = useState(false);
  const [lobbyName, setLobbyName] = useState('Frontier Hall');
  const [hostMode, setHostMode] = useState<'new_game' | 'load_save'>('new_game');
  const [selectedSaveId, setSelectedSaveId] = useState<string | null>(null);

  useEffect(() => {
    lobbyClient.refreshLobbies();
    lobbyClient.refreshSaves();
  }, []);

  const canCreateLobby = lobbyName.trim().length > 0 && (hostMode === 'new_game' || Boolean(selectedSaveId));

  const sortedLobbies = useMemo(
    () => [...lobbyState.lobbies].sort((a, b) => a.name.localeCompare(b.name)),
    [lobbyState.lobbies],
  );

  const createLobby = () => {
    if (!canCreateLobby) return;

    lobbyClient.createLobby({
      name: lobbyName.trim(),
      mode: hostMode,
      saveId: hostMode === 'load_save' ? selectedSaveId ?? undefined : undefined,
    });
    setHostDialogVisible(false);
  };

  const currentLobby = lobbyState.currentLobby;

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(180,83,9,0.26),_rgba(12,10,9,0.96)_58%),linear-gradient(160deg,_rgba(8,7,6,1),_rgba(23,17,10,1))] px-6 py-8 text-amber-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="rounded-[2rem] border border-amber-200/15 bg-black/30 p-6 shadow-[0_32px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.4em] text-amber-200/45">Play</div>
              <h1 className="medieval-font mt-3 text-4xl uppercase tracking-[0.14em] text-amber-50 sm:text-5xl">
                {currentLobby ? 'War Table' : 'Lobby Browser'}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-100/70 sm:text-base">
                {currentLobby
                  ? 'Stage the party, inspect the session source, and start the run when the host is ready.'
                  : 'Browse waiting worlds, inspect loaded saves, or host a new session without touching the gameplay renderer.'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                label="Main Menu"
                icon="pi pi-angle-left"
                className="border-none bg-black/40 text-amber-50"
                onClick={() => navigate('/')}
              />
              {!currentLobby ? (
                <>
                  <Button
                    label="Refresh"
                    icon="pi pi-refresh"
                    className="border-none bg-amber-500/20 text-amber-50"
                    onClick={() => {
                      lobbyClient.refreshLobbies();
                      lobbyClient.refreshSaves();
                    }}
                  />
                  <Button
                    label="Host Lobby"
                    icon="pi pi-plus"
                    className="border-none bg-amber-400 text-stone-950"
                    onClick={() => setHostDialogVisible(true)}
                  />
                </>
              ) : null}
            </div>
          </div>
        </div>

        {lobbyState.errorMessage ? <Message severity="error" text={lobbyState.errorMessage} /> : null}
        {lobbyState.infoMessage ? <Message severity="success" text={lobbyState.infoMessage} /> : null}

        {currentLobby ? (
          <section className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-[2rem] border border-amber-200/15 bg-black/25 p-6 backdrop-blur-xl">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Session</div>
                  <h2 className="medieval-font mt-2 text-3xl uppercase tracking-[0.1em] text-amber-50">
                    {currentLobby.name}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-amber-100/70">
                    <Tag value={currentLobby.status.replace('_', ' ')} severity={statusSeverity(currentLobby.status)} />
                    <span>{currentLobby.playerCount} member{currentLobby.playerCount === 1 ? '' : 's'}</span>
                    <span>{currentLobby.origin === 'loaded_save' ? 'Loaded Save' : 'New Game'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    label="Leave Lobby"
                    icon="pi pi-sign-out"
                    className="border-none bg-black/45 text-amber-50"
                    onClick={() => lobbyClient.leaveLobby()}
                  />
                  {currentLobby.canStart ? (
                    <Button
                      label="Start Game"
                      icon="pi pi-play"
                      className="border-none bg-amber-400 text-stone-950"
                      onClick={() => {
                        _logger.log('host clicked start game', {
                          lobbyId: currentLobby.lobbyId,
                          playerCount: currentLobby.playerCount,
                          status: currentLobby.status,
                        });
                        lobbyClient.startLobby();
                      }}
                    />
                  ) : null}
                </div>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {currentLobby.members.map((member) => (
                  <div
                    key={member.memberToken}
                    className={`rounded-2xl border px-4 py-4 ${
                      member.isLocal
                        ? 'border-amber-300/50 bg-amber-300/10'
                        : 'border-amber-300/15 bg-black/30'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-semibold text-amber-50">{member.label}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.25em] text-amber-200/45">
                          {member.isHost ? 'Host' : member.isLocal ? 'You' : 'Member'}
                        </div>
                      </div>
                      <Tag
                        value={member.connectedToGame ? 'In World' : 'Waiting'}
                        severity={member.connectedToGame ? 'success' : 'warning'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-amber-200/15 bg-black/25 p-6 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">Session Source</div>
              <div className="mt-3 text-2xl font-semibold text-amber-50">
                {currentLobby.origin === 'loaded_save' ? 'Loaded Save' : 'Fresh World'}
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-100/70">
                Waiting lobbies are joinable in v1. Once the host starts the session, gameplay sockets attach to this world and new joins are blocked.
              </p>

              {currentLobby.loadedSave ? (
                <div className="mt-5 rounded-2xl border border-amber-300/15 bg-black/25 p-4">
                  <div className="text-sm font-semibold text-amber-50">{currentLobby.loadedSave.displayName}</div>
                  <div className="mt-2 text-xs text-amber-100/55">
                    Updated {timeFormatter.format(new Date(currentLobby.loadedSave.updatedAt))}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-amber-300/15 bg-black/25 p-4 text-sm text-amber-100/65">
                  This lobby was created from a fresh authoritative world instance.
                </div>
              )}

              {currentLobby.activeSaveId ? (
                <div className="mt-4 text-xs uppercase tracking-[0.26em] text-amber-200/45">
                  Active save slot bound for in-session saves
                </div>
              ) : null}
            </aside>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-amber-200/15 bg-black/25 p-6 backdrop-blur-xl">
            {lobbyState.connectionStatus === 'connecting' ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-4">
                <ProgressSpinner style={{ width: '64px', height: '64px' }} strokeWidth="4" />
                <div className="text-sm uppercase tracking-[0.3em] text-amber-100/60">Contacting lobby registry</div>
              </div>
            ) : sortedLobbies.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
                <div className="medieval-font text-3xl uppercase tracking-[0.16em] text-amber-50">No Lobbies Available</div>
                <p className="max-w-xl text-sm leading-6 text-amber-100/65">
                  Host the first room or refresh after another player creates one. Only waiting lobbies are open for joining in this first pass.
                </p>
                <Button
                  label="Host the First Lobby"
                  icon="pi pi-plus"
                  className="border-none bg-amber-400 text-stone-950"
                  onClick={() => setHostDialogVisible(true)}
                />
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {sortedLobbies.map((lobby) => (
                  <article
                    key={lobby.lobbyId}
                    className="rounded-[1.75rem] border border-amber-300/15 bg-[linear-gradient(155deg,rgba(18,14,11,0.92),rgba(44,24,10,0.48))] p-5 shadow-[0_22px_48px_rgba(0,0,0,0.22)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="medieval-font text-2xl uppercase tracking-[0.08em] text-amber-50">
                          {lobby.name}
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-[0.3em] text-amber-200/45">
                          Host: {lobby.hostLabel}
                        </div>
                      </div>
                      <Tag value={lobby.status.replace('_', ' ')} severity={statusSeverity(lobby.status)} />
                    </div>

                    <div className="mt-5 grid gap-3 text-sm text-amber-100/72 sm:grid-cols-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-amber-200/45">Players</div>
                        <div className="mt-1 text-lg text-amber-50">{lobby.playerCount}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-amber-200/45">Origin</div>
                        <div className="mt-1 text-lg text-amber-50">
                          {lobby.origin === 'loaded_save' ? 'Save' : 'New'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-amber-200/45">Join Rule</div>
                        <div className="mt-1 text-lg text-amber-50">
                          {lobby.status === 'waiting' ? 'Open' : 'Locked'}
                        </div>
                      </div>
                    </div>

                    {lobby.loadedSave ? (
                      <div className="mt-4 rounded-2xl border border-amber-300/10 bg-black/25 px-4 py-3 text-sm text-amber-100/70">
                        Loaded from <span className="font-semibold text-amber-50">{lobby.loadedSave.displayName}</span>
                      </div>
                    ) : null}

                    <div className="mt-5 flex justify-end">
                      <Button
                        label={lobby.status === 'waiting' ? 'Join Lobby' : 'In Game'}
                        icon={lobby.status === 'waiting' ? 'pi pi-sign-in' : 'pi pi-lock'}
                        className={`border-none ${
                          lobby.status === 'waiting'
                            ? 'bg-amber-400 text-stone-950'
                            : 'bg-black/40 text-amber-100/50'
                        }`}
                        disabled={lobby.status !== 'waiting'}
                        onClick={() => lobbyClient.joinLobby(lobby.lobbyId)}
                      />
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <Dialog
        header="Host A Lobby"
        visible={hostDialogVisible}
        style={{ width: 'min(920px, 94vw)' }}
        className="overflow-hidden"
        onHide={() => setHostDialogVisible(false)}
      >
        <div className="space-y-6 bg-[linear-gradient(180deg,rgba(15,12,10,0.98),rgba(31,22,14,0.98))] px-1 py-2 text-amber-50">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.32em] text-amber-200/45">Lobby Name</label>
            <InputText
              value={lobbyName}
              onChange={(event) => setLobbyName(event.target.value)}
              className="w-full border-amber-200/20 bg-black/30 text-amber-50"
              placeholder="Enter a hall name"
            />
          </div>

          <div>
            <label className="mb-3 block text-xs uppercase tracking-[0.32em] text-amber-200/45">Session Source</label>
            <SelectButton
              value={hostMode}
              options={hostModeOptions}
              onChange={(event) => setHostMode(event.value)}
              optionLabel="label"
              optionValue="value"
              className="host-mode-toggle"
            />
          </div>

          {hostMode === 'load_save' ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-xs uppercase tracking-[0.32em] text-amber-200/45">Save Slot</label>
                <Button
                  label="Refresh Saves"
                  icon="pi pi-refresh"
                  text
                  className="text-amber-200"
                  onClick={() => lobbyClient.refreshSaves()}
                />
              </div>
              <SaveSlotPicker
                saves={lobbyState.saves}
                selectedSaveId={selectedSaveId}
                onSelect={setSelectedSaveId}
              />
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <Button label="Cancel" className="border-none bg-black/35 text-amber-50" onClick={() => setHostDialogVisible(false)} />
            <Button
              label="Create Lobby"
              icon="pi pi-check"
              disabled={!canCreateLobby}
              className="border-none bg-amber-400 text-stone-950"
              onClick={createLobby}
            />
          </div>
        </div>
      </Dialog>
    </div>
  );
}

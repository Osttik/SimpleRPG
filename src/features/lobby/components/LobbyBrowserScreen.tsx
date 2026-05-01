import { useMemo } from 'react';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { InputText } from 'primereact/inputtext';
import { Message } from 'primereact/message';
import { ProgressSpinner } from 'primereact/progressspinner';
import { SelectButton } from 'primereact/selectbutton';
import { Tag } from 'primereact/tag';
import { formatDateTime } from '@/i18n/formatters';
import { useAppTranslation } from '@/i18n';
import { lobbyStatusSeverity, type HostMode } from '../lobby-view-model';
import { useLobbyController } from '../controllers/useLobbyController';
import { SaveSlotPicker } from './SaveSlotPicker';

const SAVE_SUMMARY_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
};

export function LobbyBrowserScreen() {
  const { t } = useAppTranslation();
  const controller = useLobbyController();
  const {
    lobbyState,
    currentLobby,
    sortedLobbies,
    hostDialogVisible,
    lobbyName,
    hostMode,
    selectedSaveId,
    canCreateLobby,
    setLobbyName,
    setHostMode,
    setSelectedSaveId,
    openHostDialog,
    closeHostDialog,
    goToMainMenu,
    refresh,
    refreshSaves,
    createLobby,
    joinLobby,
    leaveLobby,
    startLobby,
  } = controller;

  const hostModeOptions = useMemo(() => [
    { label: t('lobby.hostModes.newGame'), value: 'new_game' as const },
    { label: t('lobby.hostModes.loadSave'), value: 'load_save' as const },
  ], [t]);

  return (
    <div className="min-h-screen w-full overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(180,83,9,0.26),_rgba(12,10,9,0.96)_58%),linear-gradient(160deg,_rgba(8,7,6,1),_rgba(23,17,10,1))] px-6 py-8 text-amber-50">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <div className="rounded-[2rem] border border-amber-200/15 bg-black/30 p-6 shadow-[0_32px_90px_rgba(0,0,0,0.45)] backdrop-blur-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.4em] text-amber-200/45">{t('lobby.playEyebrow')}</div>
              <h1 className="medieval-font mt-3 text-4xl uppercase tracking-[0.14em] text-amber-50 sm:text-5xl">
                {currentLobby ? t('lobby.title.warTable') : t('lobby.title.browser')}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-amber-100/70 sm:text-base">
                {currentLobby ? t('lobby.description.warTable') : t('lobby.description.browser')}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                label={t('lobby.actions.mainMenu')}
                icon="pi pi-angle-left"
                className="border-none bg-black/40 text-amber-50"
                onClick={goToMainMenu}
              />
              {!currentLobby ? (
                <>
                  <Button
                    label={t('lobby.actions.refresh')}
                    icon="pi pi-refresh"
                    className="border-none bg-amber-500/20 text-amber-50"
                    onClick={refresh}
                  />
                  <Button
                    label={t('lobby.actions.hostLobby')}
                    icon="pi pi-plus"
                    className="border-none bg-amber-400 text-stone-950"
                    onClick={openHostDialog}
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
                  <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('lobby.sections.session')}</div>
                  <h2 className="medieval-font mt-2 text-3xl uppercase tracking-[0.1em] text-amber-50">
                    {currentLobby.name}
                  </h2>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-amber-100/70">
                    <Tag value={t(`lobby.status.${currentLobby.status}`)} severity={lobbyStatusSeverity(currentLobby.status)} />
                    <span>{t('lobby.memberCount', { count: currentLobby.playerCount })}</span>
                    <span>{currentLobby.origin === 'loaded_save' ? t('lobby.origin.loadedSave') : t('lobby.origin.newGame')}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    label={t('lobby.actions.leaveLobby')}
                    icon="pi pi-sign-out"
                    className="border-none bg-black/45 text-amber-50"
                    onClick={leaveLobby}
                  />
                  {currentLobby.canStart ? (
                    <Button
                      label={t('lobby.actions.startGame')}
                      icon="pi pi-play"
                      className="border-none bg-amber-400 text-stone-950"
                      onClick={startLobby}
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
                          {member.isHost ? t('lobby.roles.host') : member.isLocal ? t('lobby.roles.you') : t('lobby.roles.member')}
                        </div>
                      </div>
                      <Tag
                        value={member.connectedToGame ? t('lobby.presence.inWorld') : t('lobby.presence.waiting')}
                        severity={member.connectedToGame ? 'success' : 'warning'}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <aside className="rounded-[2rem] border border-amber-200/15 bg-black/25 p-6 backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('lobby.sections.sessionSource')}</div>
              <div className="mt-3 text-2xl font-semibold text-amber-50">
                {currentLobby.origin === 'loaded_save' ? t('lobby.source.loadedSave') : t('lobby.source.freshWorld')}
              </div>
              <p className="mt-3 text-sm leading-6 text-amber-100/70">
                {t('lobby.source.description')}
              </p>

              {currentLobby.loadedSave ? (
                <div className="mt-5 rounded-2xl border border-amber-300/15 bg-black/25 p-4">
                  <div className="text-sm font-semibold text-amber-50">{currentLobby.loadedSave.displayName}</div>
                  <div className="mt-2 text-xs text-amber-100/55">
                    {t('lobby.saves.updated', { date: formatDateTime(currentLobby.loadedSave.updatedAt, SAVE_SUMMARY_DATE_FORMAT) })}
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-amber-300/15 bg-black/25 p-4 text-sm text-amber-100/65">
                  {t('lobby.source.freshWorldDescription')}
                </div>
              )}

              {currentLobby.activeSaveId ? (
                <div className="mt-4 text-xs uppercase tracking-[0.26em] text-amber-200/45">
                  {t('lobby.source.activeSaveBound')}
                </div>
              ) : null}
            </aside>
          </section>
        ) : (
          <section className="rounded-[2rem] border border-amber-200/15 bg-black/25 p-6 backdrop-blur-xl">
            {lobbyState.connectionStatus === 'connecting' ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-4">
                <ProgressSpinner style={{ width: '64px', height: '64px' }} strokeWidth="4" />
                <div className="text-sm uppercase tracking-[0.3em] text-amber-100/60">{t('lobby.messages.contactingRegistry')}</div>
              </div>
            ) : sortedLobbies.length === 0 ? (
              <div className="flex min-h-72 flex-col items-center justify-center gap-4 text-center">
                <div className="medieval-font text-3xl uppercase tracking-[0.16em] text-amber-50">{t('lobby.empty.title')}</div>
                <p className="max-w-xl text-sm leading-6 text-amber-100/65">
                  {t('lobby.empty.description')}
                </p>
                <Button
                  label={t('lobby.actions.hostFirstLobby')}
                  icon="pi pi-plus"
                  className="border-none bg-amber-400 text-stone-950"
                  onClick={openHostDialog}
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
                          {t('lobby.hostLabel', { label: lobby.hostLabel })}
                        </div>
                      </div>
                      <Tag value={t(`lobby.status.${lobby.status}`)} severity={lobbyStatusSeverity(lobby.status)} />
                    </div>

                    <div className="mt-5 grid gap-3 text-sm text-amber-100/72 sm:grid-cols-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-amber-200/45">{t('lobby.fields.players')}</div>
                        <div className="mt-1 text-lg text-amber-50">{lobby.playerCount}</div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-amber-200/45">{t('lobby.fields.origin')}</div>
                        <div className="mt-1 text-lg text-amber-50">
                          {lobby.origin === 'loaded_save' ? t('lobby.origin.saveShort') : t('lobby.origin.newShort')}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-amber-200/45">{t('lobby.fields.joinRule')}</div>
                        <div className="mt-1 text-lg text-amber-50">
                          {lobby.status === 'waiting' ? t('lobby.joinRule.open') : t('lobby.joinRule.locked')}
                        </div>
                      </div>
                    </div>

                    {lobby.loadedSave ? (
                      <div className="mt-4 rounded-2xl border border-amber-300/10 bg-black/25 px-4 py-3 text-sm text-amber-100/70">
                        {t('lobby.loadedFrom', { name: lobby.loadedSave.displayName })}
                      </div>
                    ) : null}

                    <div className="mt-5 flex justify-end">
                      <Button
                        label={lobby.status === 'waiting' ? t('lobby.actions.joinLobby') : t('lobby.actions.inGame')}
                        icon={lobby.status === 'waiting' ? 'pi pi-sign-in' : 'pi pi-lock'}
                        className={`border-none ${
                          lobby.status === 'waiting'
                            ? 'bg-amber-400 text-stone-950'
                            : 'bg-black/40 text-amber-100/50'
                        }`}
                        disabled={lobby.status !== 'waiting'}
                        onClick={() => joinLobby(lobby.lobbyId)}
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
        header={t('lobby.dialog.title')}
        visible={hostDialogVisible}
        modal
        draggable={false}
        resizable={false}
        closeOnEscape
        aria-label={t('lobby.dialog.title')}
        ariaCloseIconLabel={t('common.close')}
        style={{ width: 'min(920px, 94vw)' }}
        className="overflow-hidden"
        onHide={closeHostDialog}
      >
        <div className="space-y-6 bg-[linear-gradient(180deg,rgba(15,12,10,0.98),rgba(31,22,14,0.98))] px-1 py-2 text-amber-50">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('lobby.dialog.lobbyName')}</label>
            <InputText
              value={lobbyName}
              onChange={(event) => setLobbyName(event.target.value)}
              className="w-full border-amber-200/20 bg-black/30 text-amber-50"
              placeholder={t('lobby.dialog.lobbyNamePlaceholder')}
            />
          </div>

          <div>
            <label className="mb-3 block text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('lobby.dialog.sessionSource')}</label>
            <SelectButton
              value={hostMode}
              options={hostModeOptions}
              onChange={(event) => event.value && setHostMode(event.value as HostMode)}
              optionLabel="label"
              optionValue="value"
              className="host-mode-toggle"
            />
          </div>

          {hostMode === 'load_save' ? (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="block text-xs uppercase tracking-[0.32em] text-amber-200/45">{t('lobby.dialog.saveSlot')}</label>
                <Button
                  label={t('lobby.actions.refreshSaves')}
                  icon="pi pi-refresh"
                  text
                  className="text-amber-200"
                  onClick={refreshSaves}
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
            <Button label={t('common.cancel')} className="border-none bg-black/35 text-amber-50" onClick={closeHostDialog} />
            <Button
              label={t('lobby.actions.createLobby')}
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

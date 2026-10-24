'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { personInitials, type AccountView, type CryptoExperience, type HouseholdPersonView, type HouseholdProfile } from '@yield2pay/shared';
import { createHouseholdApi } from '../_lib/householdApi';
import { readLiberdade, writeLiberdade } from '../_lib/liberdadePref';
import './conta.css';

type GetToken = () => Promise<string | null>;
type Level = 'zero' | 'fundo';
type Confirm = 'leave' | 'logout' | 'delete';
type Tab = 'perfil' | 'aulas' | 'grupo' | 'conta';

const TABS: { id: Tab; label: string }[] = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'aulas', label: 'Aulas' },
  { id: 'grupo', label: 'Grupo' },
  { id: 'conta', label: 'Conta e dados' },
];

const ROLE_LABEL = { owner: 'Admin', member: 'Membro', invited: 'Convite enviado' } as const;

function validEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function statusOf(error: unknown): number {
  return typeof error === 'object' && error && 'status' in error ? Number((error as { status: number }).status) : 0;
}

export function ContaModal({
  open,
  onClose,
  getToken,
  onLogout,
  onAccount,
  onProfile,
  onLeft,
  onExpensesCleared,
}: {
  open: boolean;
  onClose: () => void;
  getToken: GetToken;
  onLogout?: () => void;
  onAccount?: (account: AccountView) => void;
  onProfile?: (profile: HouseholdProfile) => void;
  onLeft?: () => void;
  onExpensesCleared?: () => void;
}) {
  const router = useRouter();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const confirmRef = useRef<Confirm | null>(null);
  const api = () => createHouseholdApi(() => getTokenRef.current());

  const [account, setAccount] = useState<AccountView | null>(null);
  const [profile, setProfile] = useState<HouseholdProfile | null>(null);
  const accountRef = useRef(account);
  accountRef.current = account;
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const onAccountRef = useRef(onAccount);
  onAccountRef.current = onAccount;
  const onProfileRef = useRef(onProfile);
  onProfileRef.current = onProfile;
  const [people, setPeople] = useState<HouseholdPersonView[]>([]);
  const [nameDraft, setNameDraft] = useState('');
  const [groupDraft, setGroupDraft] = useState('');
  const [invite, setInvite] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  confirmRef.current = confirm;
  const [delTxt, setDelTxt] = useState('');
  const [toast, setToast] = useState('');
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [tab, setTab] = useState<Tab>('perfil');
  const [liberdade, setLiberdade] = useState(true);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      if (confirmRef.current) setConfirm(null);
      else onCloseRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const client = api();
    let cancelled = false;
    setPhase('loading');
    setConfirm(null);
    setTab('perfil');
    setLiberdade(readLiberdade());
    (async () => {
      try {
        const accountView = await client.getAccount();
        if (cancelled) return;
        if (!accountView.household) {
          onCloseRef.current();
          return;
        }
        const [profileView, peopleView] = await Promise.all([
          client.getProfile(),
          client.getPeople(),
        ]);
        if (cancelled) return;
        setAccount(accountView);
        setProfile(profileView);
        setPeople(peopleView);
        setNameDraft(accountView.displayName?.trim() || accountView.fullName?.trim() || '');
        setGroupDraft(accountView.household.name);
        setLiberdade(profileView.showFreedom !== false);
        setPhase('ready');
      } catch {
        if (!cancelled) setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(''), 2200);
    return () => window.clearTimeout(id);
  }, [toast]);

  if (!open) return null;

  const isOwner = account?.household?.role === 'owner';
  const savedName = account?.displayName?.trim() || account?.fullName?.trim() || 'Conta família';
  const groupName = account?.household?.name || 'Grupo';
  const email = account?.email || '—';
  const criptoOn = profile?.cryptoExperience !== 'declined';
  const level: Level = profile?.cryptoExperience === 'fund' ? 'fundo' : 'zero';
  const nameDirty = nameDraft.trim() !== '' && nameDraft.trim() !== savedName;
  const groupDirty = groupDraft.trim() !== '' && groupDraft.trim() !== groupName;

  function publishAccount(next: AccountView) {
    accountRef.current = next;
    setAccount(next);
    onAccountRef.current?.(next);
  }

  function publishProfile(patch: Partial<HouseholdProfile>) {
    const prev = profileRef.current;
    if (!prev) return;
    const updated = { ...prev, ...patch };
    profileRef.current = updated;
    setProfile(updated);
    onProfileRef.current?.(updated);
  }

  async function saveName() {
    try {
      publishAccount(await api().patchAccount(nameDraft.trim()));
      setNameDraft(nameDraft.trim());
      setToast('Nome atualizado');
    } catch {
      setToast('Não foi possível salvar o nome');
    }
  }

  async function saveGroup() {
    const name = groupDraft.trim();
    try {
      await api().renameHousehold(name);
      const prev = accountRef.current;
      if (prev?.household) publishAccount({ ...prev, household: { ...prev.household, name } });
      setToast('Nome do grupo atualizado');
    } catch (error) {
      setToast(statusOf(error) === 403 ? 'Só o admin muda o nome do grupo' : 'Não foi possível salvar o grupo');
    }
  }

  async function setFreedom(next: boolean) {
    setLiberdade(next);
    writeLiberdade(next);
    try {
      await api().patchProfile({ showFreedom: next });
      publishProfile({ showFreedom: next });
      setToast(next ? 'Liberdade financeira ativada' : 'Liberdade financeira desativada');
    } catch {
      setLiberdade(!next);
      writeLiberdade(!next);
      setToast('Não foi possível atualizar a liberdade financeira');
    }
  }

  async function setFamily(next: boolean) {
    try {
      await api().patchProfile({ showFamily: next });
      publishProfile({ showFamily: next });
      setToast(next ? 'Convite do painel ligado' : 'Convite do painel desligado');
    } catch {
      setToast('Não foi possível atualizar o convite');
    }
  }

  async function setCrypto(next: CryptoExperience, message: string) {
    try {
      await api().patchProfile({ cryptoExperience: next });
      publishProfile({ cryptoExperience: next });
      setToast(message);
    } catch {
      setToast('Não foi possível atualizar a trilha');
    }
  }

  async function sendInvite() {
    const value = invite.trim().toLowerCase();
    if (!validEmail(value)) {
      setInviteError('Digite um e-mail válido.');
      return;
    }
    if (people.some((person) => person.email.toLowerCase() === value)) {
      setInviteError('Esse e-mail já está no grupo.');
      return;
    }
    try {
      await api().inviteMember(value);
      setInvite('');
      setInviteError('');
      setPeople(await api().getPeople());
      setToast(`Convite enviado para ${value}`);
    } catch {
      setInviteError('Não foi possível enviar o convite.');
    }
  }

  async function removePerson(person: HouseholdPersonView) {
    try {
      if (person.role === 'invited') await api().revokeInvite(person.id);
      else await api().removeMember(person.id);
      setPeople((prev) => prev.filter((row) => row.id !== person.id));
      setToast(`${person.email} removido do grupo`);
    } catch {
      setToast('Não foi possível remover');
    }
  }

  async function confirmLeave() {
    try {
      await api().leaveHousehold();
      setConfirm(null);
      onLeft?.();
      onClose();
    } catch (error) {
      setConfirm(null);
      setToast(statusOf(error) === 403
        ? 'O admin não sai enquanto houver outras pessoas no grupo'
        : 'Não foi possível sair do grupo');
    }
  }

  async function confirmDelete() {
    try {
      await api().clearMyData('expenses');
      setConfirm(null);
      setDelTxt('');
      onExpensesCleared?.();
      setToast('Gastos importados apagados');
    } catch {
      setToast('Não foi possível apagar os gastos');
    }
  }

  function confirmLogout() {
    setConfirm(null);
    onClose();
    if (onLogout) onLogout();
    else router.push('/login');
  }

  const roleLabel = isOwner ? 'Admin' : 'Membro';

  return (
    <div
      className="conta-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget && !confirm) onClose();
      }}
    >
      <div className="conta is-modal" role="dialog" aria-modal="true" aria-labelledby="conta-title">
        <header className="conta-sheet-head">
          <div>
            <div className="conta-kicker">Sua conta</div>
            <h1 id="conta-title">Configurações</h1>
          </div>
          <button type="button" className="conta-xclose" aria-label="Fechar" onClick={onClose}>×</button>
        </header>
        <div className="conta-sheet-body">
          <nav className="conta-tabs" aria-label="Seções">
            {TABS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-current={tab === item.id ? 'true' : undefined}
                onClick={() => setTab(item.id)}
              >
                <span className="conta-dot" />
                {item.label}
              </button>
            ))}
          </nav>
          <div className="conta-pane" key={tab}>
            {phase === 'loading' && <p className="conta-wait">Carregando…</p>}
            {phase === 'error' && <p className="conta-err">Não foi possível carregar a conta.</p>}
            {phase === 'ready' && account && tab === 'perfil' && (
              <div data-screen-label="Perfil">
                <div className="conta-who">
                  <span className="conta-avatar">{personInitials(savedName)}</span>
                  <div>
                    <strong>{savedName}</strong>
                    <em>{groupName} · {roleLabel}</em>
                  </div>
                </div>
                <div className="conta-stack">
                  <div className="conta-copy">
                    <h2>Nome na plataforma</h2>
                    <p>É como você aparece para o grupo e no painel.</p>
                  </div>
                  <div className="conta-field">
                    <input
                      type="text"
                      aria-label="Nome na plataforma"
                      maxLength={32}
                      value={nameDraft}
                      onChange={(event) => setNameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && nameDirty) void saveName();
                      }}
                    />
                    {nameDirty && <button type="button" className="conta-save" onClick={() => void saveName()}>Salvar</button>}
                  </div>
                  {nameDraft.trim() === '' && <p className="conta-err">Informe um nome.</p>}
                </div>
                <div className="conta-row">
                  <div className="conta-copy">
                    <h2>E-mail de acesso</h2>
                    <p>Usado para entrar e receber avisos.</p>
                  </div>
                  <span className="conta-email">{email}</span>
                </div>
              </div>
            )}
            {phase === 'ready' && account && tab === 'aulas' && (
              <div data-screen-label="Aulas">
                <Toggle
                  title="Liberdade financeira"
                  desc="Mostra quantos meses a reserva sustenta a casa e o caminho até a meta."
                  on={liberdade}
                  onClick={() => void setFreedom(!liberdade)}
                />
                <Toggle
                  title="Trilha de investimento"
                  desc="As aulas que liberam o acesso ao investimento em cripto."
                  on={criptoOn}
                  onClick={() => void setCrypto(criptoOn ? 'declined' : level === 'fundo' ? 'fund' : 'beginner', criptoOn ? 'Trilha desligada' : 'Trilha ligada')}
                >
                  {criptoOn && (
                    <div className="conta-levels">
                      <span>Nível da trilha</span>
                      <button type="button" className="conta-level" aria-pressed={level === 'zero'} onClick={() => void setCrypto('beginner', 'Trilha do zero')}>Do zero</button>
                      <button type="button" className="conta-level" aria-pressed={level === 'fundo'} onClick={() => void setCrypto('fund', 'Trilha para quem já conhece')}>Já conheço</button>
                    </div>
                  )}
                </Toggle>
              </div>
            )}
            {phase === 'ready' && account && tab === 'grupo' && (
              <div data-screen-label="Grupo">
                <Toggle
                  title="Convite no painel"
                  desc="Mostra o convite por e-mail no painel de gastos."
                  on={profile?.showFamily !== false}
                  onClick={() => void setFamily(profile?.showFamily === false)}
                />
                <div className="conta-stack">
                  <div className="conta-copy">
                    <h2>Nome do grupo</h2>
                    <p>{isOwner ? 'Você é admin. Só admins podem mudar o nome.' : 'Só admins do grupo podem mudar o nome.'}</p>
                  </div>
                  {isOwner ? (
                    <div className="conta-field">
                      <input type="text" aria-label="Nome do grupo" maxLength={40} value={groupDraft} onChange={(event) => setGroupDraft(event.target.value)} />
                      {groupDirty && <button type="button" className="conta-save" onClick={() => void saveGroup()}>Salvar</button>}
                    </div>
                  ) : <span className="conta-static">{groupName}</span>}
                </div>
                <div className="conta-subhead">
                  <strong>E-mails conectados</strong>
                  <span className="conta-count">{people.length === 1 ? '1 pessoa' : `${people.length} pessoas`}</span>
                </div>
                {people.map((person) => (
                  <div className="conta-person" key={person.id}>
                    <span className="conta-badge">{person.displayName ? personInitials(person.displayName) : '@'}</span>
                    <span>
                      <strong>{person.you ? `${savedName} (você)` : person.displayName || 'Aguardando aceite'}</strong>
                      <em>{person.email || 'sem e-mail'}</em>
                    </span>
                    <span className="conta-role">{ROLE_LABEL[person.role]}</span>
                    {isOwner && !person.you && (
                      <button type="button" className="conta-x" aria-label={`Remover ${person.email}`} onClick={() => void removePerson(person)}>×</button>
                    )}
                  </div>
                ))}
                {isOwner && (
                  <div className="conta-invite">
                    <input type="email" aria-label="E-mail para convidar" placeholder="email@exemplo.com" value={invite} onChange={(event) => { setInvite(event.target.value); setInviteError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') void sendInvite(); }} />
                    <button type="button" className="conta-ghost" onClick={() => void sendInvite()}>Convidar</button>
                    {inviteError && <div className="conta-err">{inviteError}</div>}
                  </div>
                )}
                <div className="conta-row">
                  <div className="conta-copy">
                    <h2>Sair do grupo</h2>
                    <p>
                      {isOwner && people.filter((person) => person.role !== 'invited').length <= 1
                        ? 'Você é a única pessoa do grupo. Sair deixaria o grupo sem admin, então a saída fica bloqueada.'
                        : isOwner
                          ? 'O admin não sai enquanto houver outras pessoas no grupo.'
                          : 'Seus gastos deixam de aparecer para os outros membros.'}
                    </p>
                  </div>
                  {!isOwner && (
                    <button type="button" className="conta-ghost" onClick={() => setConfirm('leave')}>Sair do grupo</button>
                  )}
                </div>
              </div>
            )}
            {phase === 'ready' && account && tab === 'conta' && (
              <div data-screen-label="Conta">
                <div className="conta-row">
                  <div className="conta-copy">
                    <h2>Sair da conta</h2>
                    <p>Encerra a sessão neste dispositivo.</p>
                  </div>
                  <button type="button" className="conta-ghost" onClick={() => setConfirm('logout')}>Sair</button>
                </div>
                <div className="conta-row">
                  <div className="conta-copy">
                    <h2 style={{ color: 'var(--danger)' }}>Apagar gastos importados</h2>
                    <p>Remove os gastos que você trouxe de extrato. A conta e o grupo continuam.</p>
                  </div>
                  <button type="button" className="conta-danger" onClick={() => { setDelTxt(''); setConfirm('delete'); }}>Apagar gastos</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {confirm && (
          <div className="conta-modal" role="dialog" aria-modal="true" aria-label="Confirmação" onClick={(event) => { if (event.target === event.currentTarget) setConfirm(null); }}>
            <div className="conta-dialog">
              {confirm === 'leave' && (
                <>
                  <div>
                    <h2>Sair de {groupName}?</h2>
                    <p>Você continua com sua conta e seus dados. Para voltar, alguém do grupo precisa te convidar de novo.</p>
                  </div>
                  <div className="conta-actions">
                    <button type="button" className="conta-ghost" onClick={() => setConfirm(null)}>Cancelar</button>
                    <button type="button" className="conta-primary" onClick={() => void confirmLeave()}>Sair do grupo</button>
                  </div>
                </>
              )}
              {confirm === 'logout' && (
                <>
                  <div>
                    <h2>Sair da conta?</h2>
                    <p>Seus dados ficam guardados. É só entrar de novo com {email}.</p>
                  </div>
                  <div className="conta-actions">
                    <button type="button" className="conta-ghost" onClick={() => setConfirm(null)}>Cancelar</button>
                    <button type="button" className="conta-primary" onClick={confirmLogout}>Sair</button>
                  </div>
                </>
              )}
              {confirm === 'delete' && (
                <>
                  <div>
                    <div className="conta-warn">Não dá para desfazer</div>
                    <h2>Apagar gastos importados</h2>
                  </div>
                  <label>
                    Para confirmar, digite APAGAR
                    <input type="text" aria-label="Digite APAGAR" value={delTxt} autoComplete="off" onChange={(event) => setDelTxt(event.target.value)} />
                  </label>
                  <div className="conta-actions">
                    <button type="button" className="conta-ghost" onClick={() => setConfirm(null)}>Cancelar</button>
                    <button type="button" className="conta-primary is-danger" disabled={delTxt !== 'APAGAR'} onClick={() => void confirmDelete()}>Apagar para sempre</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {toast && <div className="conta-toast" role="status"><span className="conta-dot" />{toast}</div>}
      </div>
    </div>
  );
}

function Toggle({
  title,
  desc,
  on,
  onClick,
  children,
}: {
  title: string;
  desc: string;
  on: boolean;
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="conta-row">
        <div className="conta-copy">
          <h2>{title}</h2>
          <p>{desc}</p>
        </div>
        <button type="button" className={on ? 'conta-switch is-on' : 'conta-switch is-off'} role="switch" aria-checked={on} aria-label={title} onClick={onClick}>
          <i />
        </button>
      </div>
      {children}
    </div>
  );
}

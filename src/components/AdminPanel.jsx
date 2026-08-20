import { useEffect, useState } from 'react';
import { Crown, Search, ShieldCheck, UserRoundX, Users } from 'lucide-react';
import { findAdminUser, getAdminSummary, grantAdminPro, revokeAdminPro } from '../services/admin';

const durations = [
  { value: '30', label: '30 dias' },
  { value: '365', label: '1 ano' },
  { value: 'unlimited', label: 'Sem prazo' },
];

function formatExpiration(value, planType) {
  if (planType === 'manual_unlimited') return 'Sem prazo';
  if (!value) return 'Não definido';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não definido';
  return date.toLocaleDateString('pt-BR');
}

export default function AdminPanel({ showAlert, showConfirm }) {
  const [summary, setSummary] = useState(null);
  const [email, setEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [duration, setDuration] = useState('30');
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const refreshSummary = async () => {
    const nextSummary = await getAdminSummary();
    setSummary(nextSummary);
  };

  useEffect(() => {
    let isMounted = true;

    getAdminSummary()
      .then((nextSummary) => {
        if (isMounted) setSummary(nextSummary);
      })
      .catch(() => {
        // Usuários comuns não recebem detalhes administrativos nem veem esta seção.
        if (isMounted) setSummary(null);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = async (event) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      showAlert('Informe um e-mail', 'Digite o e-mail da pessoa cadastrada no NaMão.');
      return;
    }

    setIsSearching(true);
    try {
      const result = await findAdminUser(normalizedEmail);
      setSelectedUser(result.user);
    } catch (error) {
      setSelectedUser(null);
      showAlert('Usuário não encontrado', error.message);
    } finally {
      setIsSearching(false);
    }
  };

  const handleGrant = async () => {
    if (!selectedUser) return;
    const period = durations.find((item) => item.value === duration)?.label || 'o período escolhido';
    const confirmed = await showConfirm(
      'Liberar NaMão PRO',
      `Liberar acesso PRO para ${selectedUser.email} por ${period}?`
    );
    if (!confirmed) return;

    setIsUpdating(true);
    try {
      const result = await grantAdminPro(selectedUser.email, duration);
      setSelectedUser(result.user);
      await refreshSummary();
      showAlert('Acesso liberado', `${result.user.email} agora possui NaMão PRO.`);
    } catch (error) {
      showAlert('Não foi possível liberar', error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRevoke = async () => {
    if (!selectedUser) return;
    const confirmed = await showConfirm(
      'Remover NaMão PRO',
      `Remover agora o acesso PRO de ${selectedUser.email}?`
    );
    if (!confirmed) return;

    setIsUpdating(true);
    try {
      const result = await revokeAdminPro(selectedUser.email);
      setSelectedUser(result.user);
      await refreshSummary();
      showAlert('Acesso removido', `${result.user.email} voltou para o plano gratuito.`);
    } catch (error) {
      showAlert('Não foi possível remover', error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!summary) return null;

  return (
    <section className="glass-card" style={{ marginBottom: '24px', border: '1px solid rgba(16, 185, 129, 0.35)' }}>
      <h3 style={{ marginBottom: '8px', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={20} color="var(--color-emerald-primary)" /> Administração
      </h3>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Gerencie acessos PRO sem precisar abrir o console do Firebase.
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '14px', marginBottom: '16px' }}>
        <Users size={24} color="var(--color-emerald-primary)" />
        <div>
          <div style={{ color: 'var(--text-primary)', fontWeight: '700', fontSize: '1.1rem' }}>{summary.registeredUsers}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>usuários cadastrados</div>
        </div>
      </div>

      <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="E-mail do usuário"
          style={{ flex: 1, minWidth: 0, padding: '12px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        />
        <button type="submit" className="btn-primary" disabled={isSearching} style={{ padding: '0 14px', display: 'flex', alignItems: 'center' }} aria-label="Buscar usuário">
          <Search size={19} />
        </button>
      </form>

      {selectedUser && (
        <div style={{ padding: '14px', borderRadius: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--glass-border)' }}>
          <div style={{ color: 'var(--text-primary)', fontWeight: '700', overflowWrap: 'anywhere' }}>{selectedUser.name || selectedUser.email}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', overflowWrap: 'anywhere', marginTop: '2px' }}>{selectedUser.email}</div>
          <div style={{ color: selectedUser.isPro ? '#b8860b' : 'var(--text-secondary)', fontSize: '0.82rem', margin: '10px 0 14px' }}>
            {selectedUser.isPro
              ? `PRO ${selectedUser.planType === 'manual_unlimited' ? 'sem prazo' : `até ${formatExpiration(selectedUser.proExpiresAt, selectedUser.planType)}`}`
              : 'Plano gratuito'}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <select
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              disabled={isUpdating}
              style={{ flex: 1, padding: '11px', borderRadius: '10px', border: '1px solid var(--glass-border)', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
            >
              {durations.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <button type="button" onClick={handleGrant} disabled={isUpdating} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <Crown size={17} /> Liberar PRO
            </button>
          </div>

          {selectedUser.isPro && (
            <button
              type="button"
              onClick={handleRevoke}
              disabled={isUpdating}
              style={{ width: '100%', padding: '11px', borderRadius: '10px', background: 'transparent', color: 'var(--color-crimson-dark)', border: '1px solid rgba(244, 63, 94, 0.35)', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <UserRoundX size={17} /> Remover PRO
            </button>
          )}
        </div>
      )}
    </section>
  );
}

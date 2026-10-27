import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, BellRing, ChartNoAxesCombined, ChevronRight, CircleHelp, Cloud, CloudDownload, CloudUpload, Database, Fingerprint, Goal, LogOut, Moon, ShieldCheck, Smartphone, Sparkles, User } from 'lucide-react';
import { useGoBack } from '../contexts/NavigationContext';
import '../pages/AccountScreens.css';

function ProfileRow({ Icon, label, helper, onClick, badge, checked, disabled = false }) {
  const isSwitch = typeof checked === 'boolean';
  return <button type="button" className="profile-row" onClick={onClick} disabled={disabled} role={isSwitch ? 'switch' : undefined} aria-checked={isSwitch ? checked : undefined} aria-label={label}>
    <Icon size={19} aria-hidden="true" /><span className="profile-row-text"><strong>{label}</strong>{helper && <small>{helper}</small>}</span>
    {isSwitch ? <span className="profile-switch" aria-hidden="true" /> : badge ? <span className="account-plan-badge">{badge}</span> : <ChevronRight size={16} aria-hidden="true" />}
  </button>;
}

export default function ProfileView({ account, backup, settings, actions, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const goBack = useGoBack('/profile');
  const requested = new URLSearchParams(location.search).get('section');
  const section = ['backup', 'local'].includes(requested) ? requested : null;
  const open = section => navigate(`/profile?section=${section}`);
  const backupStatus = backup.conflict ? 'Confira os dados mais recentes na nuvem' : backup.protected ? 'Sincronização automática pausada' : backup.lastTime ? `Último backup: ${backup.lastTime}` : 'Nenhum backup realizado';

  return <div className="profile-page">
    {section ? <>
      <header className="account-subpage-header"><button type="button" className="account-icon-button" aria-label="Voltar" onClick={goBack} disabled={backup.busy}><ArrowLeft size={24} aria-hidden="true" /></button><h1>{section === 'backup' ? 'Backup e sincronização' : 'Dados deste dispositivo'}</h1></header>
      {section === 'backup' ? <section className="account-detail-card" aria-label="Backup e sincronização">
        <div className="account-detail-icon"><Cloud size={27} aria-hidden="true" /></div><h2>Seus dados em nuvem.</h2>
        <p className="account-helper">Backup de lançamentos, orçamentos, metas e conversas. Disponível no NaMão PRO para contas Google.</p>
        <p className="profile-backup-time">Último backup: {backup.lastTime || 'Nunca'}</p>
        {backup.localTest && <p className="account-notice">Modo de teste local: as operações em nuvem estão desativadas para proteger seus dados reais.</p>}
        {backup.protected && <p className="account-notice">A sincronização automática está pausada para preservar sua cópia em nuvem. Faça um backup manual quando quiser substituí-la.</p>}
        {backup.conflict && <p className="account-notice">Há dados mais recentes na nuvem. Restaure a cópia ou faça um backup manual para decidir se deseja substituí-la.</p>}
        {account.isGoogle ? <div className="account-detail-actions">
          <button type="button" className="account-primary" onClick={actions.cloudBackup} disabled={backup.busy}><CloudUpload size={19} aria-hidden="true" />{backup.busy ? 'Sincronizando...' : 'Fazer Backup na Nuvem'}</button>
          <button type="button" className="account-secondary" onClick={actions.cloudRestore} disabled={backup.busy}><CloudDownload size={19} aria-hidden="true" />Restaurar da Nuvem</button>
          <button type="button" className="account-danger-link" onClick={actions.cloudDelete} disabled={backup.busy}>Excluir Backup da Nuvem</button>
        </div> : <p className="account-notice">Entre com Google para usar o backup em nuvem.</p>}
      </section> : <section className="account-detail-card" aria-label="Gerenciar dados locais">
        <div className="account-detail-icon"><Database size={27} aria-hidden="true" /></div><h2>Gerenciar dados locais</h2>
        <p className="account-helper">Limpar os dados remove rendas, despesas, orçamentos, metas e conversas deste dispositivo. Essa ação não pode ser desfeita.</p>
        {account.isGoogle && <p className="account-notice">Seu backup em nuvem será preservado e a sincronização automática ficará pausada até você restaurar ou fazer um novo backup manual.</p>}
        {backup.legacyAvailable && <div className="profile-legacy"><h3>Dados de versão anterior</h3><p className="account-helper">Encontramos dados antigos sem uma conta identificada. Importe somente se forem seus.</p><button type="button" className="account-secondary" onClick={actions.recoverLegacy}>Recuperar meus dados antigos</button></div>}
        <button type="button" className="account-danger-link" onClick={actions.resetLocal}>Apagar dados locais</button>
      </section>}
    </> : <>
      <header className="account-brand-header"><div className="app-title"><img src="/logo.png?v=20260901" alt="" className="logo-icon" />NaMão</div></header>
      <h1 className="profile-title">Perfil</h1>
      <section className="profile-identity" aria-label="Sua conta"><div className="profile-avatar">{account.isGoogle && account.photo ? <img src={account.photo} alt="" referrerPolicy="no-referrer" /> : <User size={27} aria-hidden="true" />}</div><div className="profile-identity-text"><h2>{account.isGoogle ? account.name : 'Conta local'}</h2><p>{account.isGoogle ? 'Conectado com Google' : 'Dados neste dispositivo'}</p></div><span className="account-plan-badge">{account.isPro ? 'PRO' : 'Gratuito'}</span></section>
      <button type="button" className="profile-plan" onClick={actions.showPro}><Sparkles size={19} aria-hidden="true" /><span><strong>{account.isPro ? 'Seu NaMão PRO' : 'Conheça o NaMão PRO'}</strong><small>{account.isPro ? 'IA sem cota mensal e backup na nuvem' : 'Mais IA e backup na nuvem'}</small></span><ChevronRight size={16} aria-hidden="true" /></button>
      <section className="profile-group"><h2>Planejamento</h2><div className="profile-list"><ProfileRow Icon={ChartNoAxesCombined} label="Limites de Orçamento" onClick={() => navigate('/budgets')} /><ProfileRow Icon={Goal} label="Metas Financeiras" onClick={() => navigate('/goals')} /></div></section>
      <section className="profile-group"><h2>Preferências</h2><div className="profile-list"><ProfileRow Icon={Moon} label="Modo Escuro" checked={settings.theme === 'dark'} onClick={actions.toggleTheme} /><ProfileRow Icon={Fingerprint} label="Bloqueio do app" helper="Biometria ao abrir" checked={settings.biometric} onClick={actions.toggleBiometric} /><ProfileRow Icon={BellRing} label="Alertas financeiros PRO" helper={settings.notifications ? 'Ativos para vencimentos e orçamento' : 'Vencimentos e orçamentos'} onClick={actions.toggleNotifications} badge={settings.notifications ? 'ATIVOS' : account.isPro ? 'ATIVAR' : 'PRO'} /></div></section>
      <section className="profile-group"><h2>Dados e dispositivo</h2><div className="profile-list"><ProfileRow Icon={Cloud} label="Backup e sincronização" helper={account.isGoogle ? backupStatus : 'Disponível para contas Google PRO'} onClick={() => open('backup')} /><ProfileRow Icon={Smartphone} label="Adicionar à Tela Inicial" onClick={actions.installApp} /><ProfileRow Icon={Database} label="Gerenciar dados locais" helper={backup.legacyAvailable ? 'Dados de versão anterior encontrados' : undefined} onClick={() => open('local')} /></div></section>
      {children}
      <section className="profile-group"><h2>Ajuda e privacidade</h2><div className="profile-list"><ProfileRow Icon={CircleHelp} label="Central de Ajuda" onClick={() => navigate('/help')} /><ProfileRow Icon={ShieldCheck} label="Política de Privacidade" onClick={() => navigate('/privacy')} /></div></section>
      <button type="button" className="profile-signout" onClick={actions.logout}><LogOut size={17} aria-hidden="true" />Sair da conta</button>
    </>}
  </div>;
}

import BackButton from './BackButton';

export default function PageHeader({ title, onBack, actions }) {
  return <header className="modern-page-header"><BackButton onClick={onBack} /><h1>{title}</h1>{actions && <div className="modern-header-actions">{actions}</div>}</header>;
}

import { ArrowLeft } from 'lucide-react';

export default function BackButton({ onClick }) {
  return (
    <button type="button" aria-label="Voltar" title="Voltar" className="back-button" onClick={onClick}>
      <ArrowLeft size={24} strokeWidth={2.5} aria-hidden="true" />
    </button>
  );
}

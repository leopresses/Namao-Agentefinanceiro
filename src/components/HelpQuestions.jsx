import { ChevronDown } from 'lucide-react';
import { HELP_TOPICS } from '../utils/helpTopics';

export default function HelpQuestions({ expanded, onChange, compact = false, group = 'help' }) {
  return <div className="help-question-list">{(compact ? HELP_TOPICS.slice(0, 6) : HELP_TOPICS).map(({ id, Icon, title, paragraphs, example }) => <details key={id} name={group} className="help-question" open={expanded === id} onToggle={event => {
    const open = event.currentTarget.open;
    onChange(current => open ? id : current === id ? null : current);
  }}><summary><Icon size={18} aria-hidden="true" /><span>{title}</span><ChevronDown size={17} aria-hidden="true" /></summary><div className="help-answer">{paragraphs.map(text => <p key={text}>{text}</p>)}{example && <div className="help-example"><span>Exemplo: R$ 2.499 − R$ 2.675</span><strong>− R$ 176,00</strong></div>}</div></details>)}</div>;
}

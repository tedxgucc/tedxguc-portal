// Turns web addresses inside plain text into clickable links.
const URL_RE = /(https?:\/\/[^\s)]+[^\s).,;:!?])/g;

export function Linkify({ text }: { text: string }) {
  return <>{text.split(URL_RE).map((part, i) => i % 2 === 1
    ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="tx-link break-words">{part.replace(/^https?:\/\/(www\.)?/, '')}</a>
    : part)}</>;
}

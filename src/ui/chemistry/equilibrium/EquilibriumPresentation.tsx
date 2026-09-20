import type {
  EquilibriumPresentationView,
  ReactionDeveloperDiagnostics,
  ReversiblePairPresentationView,
} from '../../types';
import { formatProviderNumber, scientificStatusLabel } from './presentation';
import './equilibrium.css';

function directionSymbol(direction: EquilibriumPresentationView['direction']): string {
  if (direction === 'FORWARD') return '→';
  if (direction === 'REVERSE') return '←';
  if (direction === 'NEAR_EQUILIBRIUM') return '⇌';
  return '?';
}

export function EquilibriumInlineStatus({ value }: { value?: EquilibriumPresentationView }) {
  if (!value) return null;
  return (
    <span className="equilibrium-inline" aria-label={`평형 상태: ${value.directionLabel}, ${scientificStatusLabel(value.scientificStatus)}`}>
      <strong aria-hidden="true">{directionSymbol(value.direction)}</strong>
      <span>{value.directionLabel}</span>
      <small>{value.scientificStatus}</small>
    </span>
  );
}

function EvidenceRow({ label, value, status }: { label: string; value?: number; status: EquilibriumPresentationView['scientificStatus'] }) {
  return (
    <div className="equilibrium-evidence-row">
      <dt>{label}</dt>
      <dd>{value === undefined ? '제공되지 않음' : formatProviderNumber(value, status)}</dd>
    </div>
  );
}

export function EquilibriumDetails({ pairs }: { pairs: ReversiblePairPresentationView[] }) {
  return (
    <section className="equilibrium-details" aria-labelledby="equilibrium-details-heading">
      <div className="equilibrium-details-heading">
        <h3 id="equilibrium-details-heading">가역 반응 / 평형</h3>
        <p>provider가 제공한 현재 상태만 표시합니다.</p>
      </div>
      {pairs.length === 0 ? <p className="equilibrium-empty">표시할 가역 반응 상태가 없습니다.</p> : pairs.map((pair) => (
        <article className="equilibrium-pair" key={pair.label} aria-label={pair.label}>
          <header>
            <strong>{pair.label}</strong>
            <EquilibriumInlineStatus value={pair}/>
          </header>
          <dl>
            <EvidenceRow label="Q" value={pair.reactionQuotientQ} status={pair.scientificStatus}/>
            <EvidenceRow label="K" value={pair.equilibriumConstantK} status={pair.scientificStatus}/>
            <EvidenceRow label="ln(Q/K)" value={pair.lnQOverK} status={pair.scientificStatus}/>
            <EvidenceRow label="진행 구동 계수" value={pair.drivingStrength} status={pair.scientificStatus}/>
          </dl>
          {pair.scientificStatus === 'OPEN' && <p className="equilibrium-open">수치 평형 근거 미확정</p>}
        </article>
      ))}
    </section>
  );
}

function diagnosticNumber(label: string, value: number | undefined) {
  return <span>{label}: {value === undefined ? 'undefined' : String(value)}</span>;
}

export function DeveloperEquilibriumDiagnostics({ diagnostics }: { diagnostics?: ReactionDeveloperDiagnostics }) {
  if (!diagnostics?.reversiblePairs?.length) return null;
  return (
    <details className="equilibrium-dev" aria-label="Developer equilibrium diagnostics">
      <summary>DEV equilibrium diagnostics</summary>
      {diagnostics.reversiblePairs.map((pair) => (
        <div key={pair.reversiblePairId}>
          <code>{pair.reversiblePairId}</code>
          <span>{pair.equilibriumDirection} · {pair.equilibriumScientificStatus}</span>
          {diagnosticNumber('Q', pair.reactionQuotientQ)}
          {diagnosticNumber('K', pair.equilibriumConstantK)}
          {diagnosticNumber('lnQOverK', pair.lnQOverK)}
          {diagnosticNumber('drivingStrength', pair.drivingStrength)}
          <small>{pair.reasonCodes.join(', ') || 'no reason codes'}</small>
        </div>
      ))}
    </details>
  );
}

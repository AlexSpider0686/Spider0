import type { MetricSpotlight } from "../data/siteContent";

const ASSET_BASE = import.meta.env.BASE_URL || "/";

type MetricSpotlightModalProps = {
  metric: MetricSpotlight | null;
  onClose: () => void;
};

function assetUrl(path: string) {
  const normalized = path.startsWith("/") ? path.slice(1) : path;
  return `${ASSET_BASE}${normalized}`;
}

export function MetricSpotlightModal({ metric, onClose }: MetricSpotlightModalProps) {
  if (!metric) return null;

  return (
    <div className="metric-spotlight" role="dialog" aria-modal="true" aria-label={metric.modalTitle}>
      <div className="metric-spotlight__backdrop" onClick={onClose} />
      <div className="metric-spotlight__window">
        <button className="metric-spotlight__close" type="button" onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <div className="metric-spotlight__hero" style={{ backgroundImage: `url("${assetUrl(metric.modalImage)}")` }}>
          <div className="metric-spotlight__hero-overlay" />
          <div className="metric-spotlight__hero-content">
            <div className="metric-spotlight__eyebrow">{metric.modalBadge}</div>
            <div className="metric-spotlight__value">{metric.value}</div>
            <h3>{metric.modalTitle}</h3>
            <p>{metric.modalDescription}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

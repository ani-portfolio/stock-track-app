import './PeriodSelector.css'

const PERIODS = ['1d', '5d', 'ytd', '1mo', '3mo', '6mo', '1y', '5y']

export default function PeriodSelector({ selectedPeriod, onChange }) {
  return (
    <div className="period-selector">
      {PERIODS.map(p => (
        <button
          key={p}
          className={`pill-btn period-btn ${p === selectedPeriod ? 'active' : ''}`}
          onClick={() => onChange(p)}
        >
          {p}
        </button>
      ))}
    </div>
  )
}

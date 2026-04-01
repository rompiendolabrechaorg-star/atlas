const PHASES = [
  { id: 1, label: '① Captura', icon: '📷' },
  { id: 2, label: '② Síntesis', icon: '🗂' },
  { id: 3, label: '③ Votación', icon: '🗳' },
  { id: 4, label: '④ Evaluación', icon: '🎯' },
]

export default function PhaseNav({ currentPhase, onPhaseChange, isAdmin }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      padding: '0 16px',
    }}>
      <div className="phase-nav">
        {PHASES.map(p => (
          <button
            key={p.id}
            className={`phase-btn ${currentPhase === p.id ? 'active' : ''}`}
            onClick={() => isAdmin && onPhaseChange(p.id)}
            style={{
              cursor: isAdmin ? 'pointer' : 'default',
              opacity: p.id > currentPhase && !isAdmin ? 0.5 : 1,
            }}
            title={!isAdmin ? 'Solo el administrador puede cambiar la fase' : ''}
          >
            <span style={{ marginRight: '6px' }}>{p.icon}</span>
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

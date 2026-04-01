import { useState, useEffect, useRef } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend
} from 'chart.js'
import { getIdeas, getVoteCounts, updateVoteLimit } from '../lib/api'
import { supabase } from '../lib/supabase'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

export default function Phase3Voting({ sessionId, session, isAdmin }) {
  const [ideas, setIdeas] = useState([])
  const [voteCounts, setVoteCounts] = useState({})
  const [voteLimit, setVoteLimit] = useState(session?.vote_limit || 3)
  const [loading, setLoading] = useState(true)

  const votingUrl = `${window.location.origin}/vote/${sessionId}`

  const loadData = async () => {
    const [i, v] = await Promise.all([getIdeas(sessionId), getVoteCounts(sessionId)])
    setIdeas(i)
    setVoteCounts(v)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const sub = supabase
      .channel(`votes-admin-${sessionId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'votes',
        filter: `session_id=eq.${sessionId}`,
      }, loadData)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [sessionId])

  const handleVoteLimitChange = async (val) => {
    setVoteLimit(val)
    await updateVoteLimit(sessionId, val)
  }

  const totalVotes = Object.values(voteCounts).reduce((a, b) => a + b, 0)
  const sortedIdeas = [...ideas].sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0))
  const top10 = sortedIdeas.slice(0, 10)

  const chartData = {
    labels: top10.map(i => i.text?.substring(0, 30) + (i.text?.length > 30 ? '…' : '') || i.drawing_description?.substring(0, 30) || 'Sin texto'),
    datasets: [{
      label: 'Votos',
      data: top10.map(i => voteCounts[i.id] || 0),
      backgroundColor: top10.map((_, idx) => idx === 0 ? '#FFD700' : idx <= 2 ? 'rgba(255,215,0,0.5)' : 'rgba(168,162,158,0.3)'),
      borderRadius: 10,
      borderWidth: 0,
    }],
  }

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display: false },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { font: { family: 'Inter', size: 11 } },
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, font: { family: 'Inter', size: 11 } },
        grid: { color: 'rgba(0,0,0,0.05)' },
      },
    },
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-muted)' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '6px' }}>🗳 Fase 3: Priorización</h2>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
          Los participantes votan sus ideas favoritas. Resultados en tiempo real.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', marginBottom: '28px' }}>
        {/* Share card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>📱 Enlace de votación</h3>
          <div style={{
            background: 'var(--paper)',
            border: '1.5px solid var(--stone-light)',
            borderRadius: '12px',
            padding: '12px',
            fontSize: '0.75rem',
            color: 'var(--ink-muted)',
            wordBreak: 'break-all',
            marginBottom: '12px',
            fontFamily: 'monospace',
          }}>
            {votingUrl}
          </div>
          <button
            className="btn-yellow"
            style={{ width: '100%' }}
            onClick={() => navigator.clipboard.writeText(votingUrl)}
          >
            📋 Copiar enlace
          </button>
        </div>

        {/* Stats card */}
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>📊 Estadísticas</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { label: 'Ideas', val: ideas.length },
              { label: 'Votos totales', val: totalVotes },
              { label: 'Idea líder', val: sortedIdeas[0] ? (voteCounts[sortedIdeas[0].id] || 0) + ' votos' : '–' },
              { label: 'Límite / usuario', val: voteLimit },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--paper)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--ink)' }}>{s.val}</div>
                <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Vote limit control (admin only) */}
        {isAdmin && (
          <div className="card" style={{ padding: '24px' }}>
            <h3 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '16px' }}>⚙️ Configuración</h3>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink-muted)', marginBottom: '8px' }}>
              VOTOS POR PARTICIPANTE
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[3, 4, 5].map(n => (
                <button
                  key={n}
                  onClick={() => handleVoteLimitChange(n)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px', border: '2px solid',
                    borderColor: voteLimit === n ? 'var(--postit)' : 'var(--stone-light)',
                    background: voteLimit === n ? 'rgba(255,215,0,0.15)' : 'var(--white)',
                    fontWeight: 700, fontSize: '1rem', cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Chart */}
      {ideas.length > 0 && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontWeight: 700, fontSize: '1rem', marginBottom: '20px' }}>
            Top ideas por votos
            {sortedIdeas[0] && (
              <span style={{ marginLeft: '12px' }} className="badge badge-yellow">
                🏆 Líder: {sortedIdeas[0].text?.substring(0, 25) || 'Sin texto'}
              </span>
            )}
          </h3>
          <Bar data={chartData} options={chartOptions} />
        </div>
      )}

      {ideas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--stone)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</div>
          <p>No hay ideas para votar. Vuelve a la Fase 1 primero.</p>
        </div>
      )}
    </div>
  )
}

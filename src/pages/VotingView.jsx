import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { getSessionByCode, getSession, getIdeas, getVoteCounts, getMyVotes, castVote, removeVote } from '../lib/api'
import { getOrCreateUserToken } from '../lib/supabase'
import { supabase } from '../lib/supabase'

function IdeaVoteCard({ idea, voted, votesLeft, voteCount, onVote, onUnvote }) {
  const [animating, setAnimating] = useState(false)

  const handleVote = async () => {
    if (voted) {
      await onUnvote(idea.id)
    } else if (votesLeft > 0) {
      setAnimating(true)
      setTimeout(() => setAnimating(false), 400)
      await onVote(idea.id)
    }
  }

  return (
    <div className="vote-card" style={{
      transform: animating ? 'scale(0.98)' : 'scale(1)',
      transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
      border: voted ? '2px solid var(--postit)' : '2px solid transparent',
    }}>
      {/* Idea text */}
      {idea.text && (
        <p style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.6, marginBottom: idea.drawing_description ? '8px' : '20px' }}>
          {idea.text}
        </p>
      )}
      {idea.drawing_description && (
        <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', fontStyle: 'italic', marginBottom: '20px', lineHeight: 1.5 }}>
          ✏️ {idea.drawing_description}
        </p>
      )}

      {/* Vote action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink-muted)' }}>
            {voteCount} {voteCount === 1 ? 'voto' : 'votos'}
          </span>
          {voted && <span className="badge badge-yellow">✓ Votado</span>}
        </div>

        <button
          className={`vote-btn ${voted ? 'voted' : ''}`}
          onClick={handleVote}
          disabled={!voted && votesLeft === 0}
          style={{ opacity: !voted && votesLeft === 0 ? 0.4 : 1 }}
          aria-label={voted ? 'Quitar voto' : 'Votar'}
        >
          {voted ? '⭐' : '☆'}
        </button>
      </div>
    </div>
  )
}

export default function VotingView() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [ideas, setIdeas] = useState([])
  const [voteCounts, setVoteCounts] = useState({})
  const [myVotes, setMyVotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const userToken = getOrCreateUserToken()

  const loadData = async () => {
    try {
      const [s, i, v, mv] = await Promise.all([
        getSession(sessionId),
        getIdeas(sessionId),
        getVoteCounts(sessionId),
        getMyVotes(sessionId, userToken),
      ])
      setSession(s)
      setIdeas(i)
      setVoteCounts(v)
      setMyVotes(mv)
    } catch (e) {
      setError('No se pudo cargar la sesión.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const sub = supabase
      .channel(`votes-participant-${sessionId}-${userToken}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'votes',
        filter: `session_id=eq.${sessionId}`,
      }, loadData)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, payload => setSession(prev => ({ ...prev, ...payload.new })))
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [sessionId])

  const handleVote = async (ideaId) => {
    try {
      await castVote(sessionId, ideaId, userToken)
      setMyVotes(prev => [...prev, ideaId])
      setVoteCounts(prev => ({ ...prev, [ideaId]: (prev[ideaId] || 0) + 1 }))
    } catch (e) {
      // silently ignore (limit reached, etc.)
    }
  }

  const handleUnvote = async (ideaId) => {
    try {
      await removeVote(sessionId, ideaId, userToken)
      setMyVotes(prev => prev.filter(id => id !== ideaId))
      setVoteCounts(prev => ({ ...prev, [ideaId]: Math.max(0, (prev[ideaId] || 1) - 1) }))
    } catch (e) {}
  }

  const voteLimit = session?.vote_limit || 3
  const votesLeft = voteLimit - myVotes.length

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', padding: '24px',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
      <p style={{ color: 'var(--ink-muted)' }}>Cargando ideas...</p>
    </div>
  )

  if (error) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', padding: '24px',
    }}>
      <div style={{ fontSize: '2rem', marginBottom: '12px' }}>❌</div>
      <p style={{ color: 'var(--ink-muted)' }}>{error}</p>
    </div>
  )

  if (session?.phase !== 3) return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', background: 'var(--paper)', padding: '24px', textAlign: 'center',
    }}>
      <div style={{ fontSize: '3rem', marginBottom: '16px' }}>
        {session?.phase < 3 ? '⏳' : '✅'}
      </div>
      <h2 style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '8px' }}>
        {session?.phase < 3 ? 'La votación aún no ha comenzado' : 'La votación ha terminado'}
      </h2>
      <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem' }}>
        {session?.phase < 3 ? 'El administrador abrirá la votación pronto.' : '¡Gracias por participar!'}
      </p>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'var(--white)',
        borderBottom: '1px solid var(--stone-light)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <h1 style={{ fontSize: '1rem', fontWeight: 700 }}>🗳 Votación</h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
            Código: <strong>{session?.code}</strong>
          </p>
        </div>

        {/* Vote counter pill */}
        <div style={{
          background: votesLeft === 0 ? 'var(--stone-light)' : 'var(--postit)',
          padding: '8px 16px',
          borderRadius: '100px',
          fontWeight: 700,
          fontSize: '0.875rem',
          boxShadow: votesLeft > 0 ? '0 2px 8px var(--postit-shadow)' : 'none',
          transition: 'all 0.3s ease',
        }}>
          {votesLeft === 0 ? '✓ Votos usados' : `${votesLeft} voto${votesLeft === 1 ? '' : 's'} restante${votesLeft === 1 ? '' : 's'}`}
        </div>
      </header>

      {/* Progress bar */}
      <div style={{ height: '4px', background: 'var(--stone-light)' }}>
        <div style={{
          height: '100%',
          width: `${(myVotes.length / voteLimit) * 100}%`,
          background: 'var(--postit)',
          borderRadius: '0 4px 4px 0',
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* Ideas feed */}
      <main style={{
        flex: 1,
        maxWidth: '520px',
        margin: '0 auto',
        padding: '20px 16px 40px',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
      }}>
        {ideas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--stone)' }}>
            <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📭</div>
            <p>No hay ideas para votar</p>
          </div>
        ) : (
          ideas.map((idea, i) => (
            <div key={idea.id} className="animate-fade-up" style={{ animationDelay: `${i * 0.04}s` }}>
              <IdeaVoteCard
                idea={idea}
                voted={myVotes.includes(idea.id)}
                votesLeft={votesLeft}
                voteCount={voteCounts[idea.id] || 0}
                onVote={handleVote}
                onUnvote={handleUnvote}
              />
            </div>
          ))
        )}
      </main>
    </div>
  )
}

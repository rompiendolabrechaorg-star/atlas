import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getSession, updatePhase, getGroups } from '../lib/api'
import { getOrCreateUserToken } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import PhaseNav from '../components/PhaseNav'
import Phase1Capture from '../components/Phase1Capture'
import Phase2Synthesis from '../components/Phase2Synthesis'
import Phase3Voting from '../components/Phase3Voting'
import Phase4Matrix from '../components/Phase4Matrix'

export default function AdminView() {
  const { sessionId } = useParams()
  const [session, setSession] = useState(null)
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const isAdmin = localStorage.getItem(`atlas_admin_${sessionId}`) === 'true'

  useEffect(() => {
    const load = async () => {
      try {
        const [s, g] = await Promise.all([getSession(sessionId), getGroups(sessionId)])
        setSession(s)
        setGroups(g)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()

    // Real-time phase sync
    const sub = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, payload => setSession(prev => ({ ...prev, ...payload.new })))
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [sessionId])

  const handlePhaseChange = async (phase) => {
    if (!isAdmin) return
    setSession(prev => ({ ...prev, phase }))
    await updatePhase(sessionId, phase)
  }

  if (loading) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
        <p style={{ color: 'var(--ink-muted)' }}>Cargando sesión...</p>
      </div>
    </div>
  )

  if (!session) return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--paper)',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>❌</div>
        <p style={{ color: 'var(--ink-muted)' }}>Sesión no encontrada.</p>
      </div>
    </div>
  )

  const votingUrl = `${window.location.origin}/vote/${sessionId}`

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{
        background: 'var(--white)',
        borderBottom: '1px solid var(--stone-light)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '36px', height: '36px',
            background: 'var(--postit)',
            borderRadius: '10px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.2rem',
            transform: 'rotate(-4deg)',
          }}>💡</div>
          <div>
            <h1 style={{ fontSize: '1rem', fontWeight: 700, lineHeight: 1 }}>Atlas de Ideas</h1>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: '2px' }}>
              {isAdmin ? 'Vista Administrador' : 'Vista Participante'}
            </p>
          </div>
        </div>

        {/* Session code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.7rem', color: 'var(--ink-muted)', marginBottom: '4px', fontWeight: 600, letterSpacing: '0.05em' }}>
              CÓDIGO DE SESIÓN
            </div>
            <div style={{
              fontFamily: 'monospace',
              fontSize: '1.4rem',
              fontWeight: 800,
              letterSpacing: '0.25em',
              background: 'var(--postit)',
              padding: '6px 16px',
              borderRadius: '10px',
              boxShadow: '0 2px 8px var(--postit-shadow)',
            }}>
              {session.code}
            </div>
          </div>
          {isAdmin && (
            <button
              className="btn-ghost"
              style={{ fontSize: '0.75rem', padding: '6px 12px' }}
              onClick={() => navigator.clipboard.writeText(votingUrl)}
              title={votingUrl}
            >
              📋 Copiar enlace votación
            </button>
          )}
        </div>
      </header>

      {/* Phase nav */}
      <div style={{ padding: '20px 24px 0' }}>
        <PhaseNav
          currentPhase={session.phase}
          onPhaseChange={handlePhaseChange}
          isAdmin={isAdmin}
        />
      </div>

      {/* Phase content */}
      <main style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        {session.phase === 1 && (
          <Phase1Capture sessionId={sessionId} groups={groups} isAdmin={isAdmin} />
        )}
        {session.phase === 2 && (
          <Phase2Synthesis sessionId={sessionId} isAdmin={isAdmin} />
        )}
        {session.phase === 3 && (
          <Phase3Voting sessionId={sessionId} session={session} isAdmin={isAdmin} />
        )}
        {session.phase === 4 && (
          <Phase4Matrix sessionId={sessionId} isAdmin={isAdmin} />
        )}
      </main>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { getSession, updatePhase, getGroups } from '../lib/api'
import { getOrCreateUserToken } from '../lib/supabase'
import { supabase } from '../lib/supabase'
import { getGeminiKey, setGeminiKey, testGeminiConnection } from '../lib/atlasEngine'
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

  // Master Key Logic
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [hasKey, setHasKey] = useState(!!getGeminiKey())
  const [testStatus, setTestStatus] = useState(null) // null, 'testing', 'ok', 'error'
  const [testErr, setTestErr] = useState('')

  const handleTestKey = async () => {
    setTestStatus('testing')
    const res = await testGeminiConnection()
    if (res.ok) {
      setTestStatus('ok')
    } else {
      setTestStatus('error')
      setTestErr(res.error)
    }
  }

  const handleSaveKey = (e) => {
    e.preventDefault()
    const cleanKey = apiKeyInput.trim()
    if (!cleanKey) return
    
    if (cleanKey.includes('*')) {
      alert("❌ Error: Estás pegando asteriscos. Debes pegar la LLAVE REAL de AI Studio.")
      return
    }
    
    setGeminiKey(cleanKey)
    setKeySaved(true)
    setHasKey(true)
    setApiKeyInput('')
    
    console.log(`[Atlas] Llave guardada. Longitud: ${cleanKey.length}`)
    alert("✅ LLAVE ACTUALIZADA")
    
    setTimeout(() => {
      setKeySaved(false)
      setShowSettings(false)
    }, 1000)
  }

  const handleDeleteKey = () => {
    if (window.confirm("¿Seguro que quieres BORRAR la llave guardada?")) {
      localStorage.removeItem('atlas_gemini_key')
      setHasKey(false)
      setApiKeyInput('')
      alert("🗑️ Llave eliminada.")
    }
  }

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
    <div style={{ minHeight: '100vh', background: 'var(--paper)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Settings Modal */}
      {showSettings && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '24px'
        }}>
          <div className="card animate-pop" style={{ maxWidth: '400px', width: '100%', padding: '32px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '8px' }}>Configuración IA</h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', marginBottom: '24px' }}>
              Actualiza tu API Key de Gemini para esta sesión.
            </p>
            
            <form onSubmit={handleSaveKey}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--stone)' }}>
                    Gemini API Key
                  </label>
                  {hasKey && (
                    <span style={{ fontSize: '0.65rem', color: '#059669', background: '#ECFDF5', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                      ✅ CONFIGURADA
                    </span>
                  )}
                </div>
                <input 
                  type="password"
                  className="input"
                  placeholder={hasKey ? "••••••••••••••••" : "Pega tu nueva API Key aquí..."}
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  style={{ fontSize: '0.9rem', padding: '14px' }}
                />
              </div>

              {testStatus === 'ok' && (
                <div style={{ color: '#059669', fontSize: '0.8rem', background: '#ECFDF5', padding: '8px', borderRadius: '4px', marginBottom: '16px' }}>
                  ✅ ¡Conexión con Google exitosa!
                </div>
              )}
              {testStatus === 'error' && (
                <div style={{ color: '#DC2626', fontSize: '0.8rem', background: '#FEF2F2', padding: '8px', borderRadius: '4px', marginBottom: '16px' }}>
                  ❌ Error: {testErr}
                </div>
              )}

              {keySaved && (
                <div style={{ color: '#059669', fontSize: '0.875rem', background: '#ECFDF5', padding: '12px', borderRadius: '10px', marginBottom: '16px', textAlign: 'center' }}>
                  ✅ ¡Llave guardada!
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <button type="submit" className="btn-yellow" style={{ flex: 1, padding: '14px' }} disabled={!apiKeyInput.trim()}>
                  {hasKey ? 'Actualizar' : 'Guardar'}
                </button>
                <button 
                  type="button" 
                  className="btn-ghost" 
                  onClick={handleTestKey} 
                  disabled={!hasKey && !apiKeyInput.trim()}
                  style={{ flex: 1, background: 'var(--paper)' }}
                >
                  {testStatus === 'testing' ? '⌛ Probando...' : '🔍 Probar'}
                </button>
                <button type="button" className="btn-ghost" onClick={() => setShowSettings(false)} style={{ flex: '1 1 100%' }}>
                  Cerrar
                </button>
              </div>

              {hasKey && (
                <button 
                  type="button"
                  onClick={handleDeleteKey}
                  style={{ 
                    marginTop: '24px', width: '100%', background: 'none', border: 'none', 
                    color: '#EF4444', fontSize: '0.75rem', textDecoration: 'underline', 
                    cursor: 'pointer', fontWeight: 600 
                  }}
                >
                  BORRAR LLAVE GUARDADA
                </button>
              )}
            </form>
          </div>
        </div>
      )}

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

        {/* Session code & settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                onClick={() => setShowSettings(true)}
                style={{
                  background: 'white',
                  border: '1.5px solid var(--stone-light)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.1rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                }}
                title="Configuración IA"
              >
                ⚙️
              </button>
            )}
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

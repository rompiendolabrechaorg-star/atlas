import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { createSession, getSessionByCode } from '../lib/api'
import { getOrCreateUserToken } from '../lib/supabase'
import { getGeminiKey, setGeminiKey, testGeminiConnection } from '../lib/atlasEngine'

export default function LandingPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState(null) // 'create' | 'join'
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [context, setContext] = useState('')
  const [createStep, setCreateStep] = useState(1) // 1: Info, 2: Context input

  // Master Key Logic
  const [showSettings, setShowSettings] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [keySaved, setKeySaved] = useState(false)
  const [hasKey, setHasKey] = useState(!!getGeminiKey())
  const [isEnvKey, setIsEnvKey] = useState(!!import.meta.env.VITE_GEMINI_API_KEY && !localStorage.getItem('atlas_gemini_key'))
  const [testStatus, setTestStatus] = useState(null) // null, 'testing', 'ok', 'error'
  const [testErr, setTestErr] = useState('')

  const handleTestKey = async () => {
    setTestStatus('testing')
    const res = await testGeminiConnection(apiKeyInput.trim())
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
    setIsEnvKey(false) // Local key overrides env key
    setApiKeyInput('')
    
    console.log(`[Atlas] Llave guardada. Longitud: ${cleanKey.length}`)
    alert("✅ LLAVE GUARDADA CON ÉXITO")
    
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

  const handleCreate = async () => {
    if (!getGeminiKey()) {
      setError('⚠️ Necesitas configurar tu API Key de Gemini en el panel de Ajustes (icono ⚙️) para usar las funciones de IA.')
      setShowSettings(true)
      return
    }

    if (createStep === 1) {
      setCreateStep(2)
      return
    }
    if (!context.trim()) {
      setError('Por favor, aporta algo de contexto sobre el proyecto.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const token = getOrCreateUserToken()
      const session = await createSession(token, context, 3)
      localStorage.setItem(`atlas_admin_${session.session_id}`, 'true')
      navigate(`/admin/${session.session_id}`)
    } catch (e) {
      setError('No se pudo crear la sesión. ¿Está el backend corriendo?')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    if (code.length < 4) return
    setLoading(true)
    setError('')
    try {
      const session = await getSessionByCode(code.trim())
      navigate(`/vote/${session.id}`)
    } catch (e) {
      setError('Código no válido o sesión no encontrada.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--paper)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative'
    }}>
      {/* Cache Buster Indicator */}
      <div style={{ 
        position: 'fixed', bottom: 10, right: 10, fontSize: '10px', color: 'var(--ink-muted)', opacity: 0.5, zIndex: 1000,
        background: 'white', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--stone-light)'
      }}>
        ATLAS v6.3.1 - 2026 STABLE AI
      </div>

      {/* Settings Button */}
      <button 
        onClick={() => setShowSettings(true)}
        style={{
          position: 'absolute',
          top: '24px',
          right: '24px',
          background: 'white',
          border: '1.5px solid var(--stone-light)',
          borderRadius: '50%',
          width: '44px',
          height: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.2rem',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          zIndex: 100
        }}
      >
        ⚙️
      </button>

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
              {isEnvKey 
                ? "El sistema está usando una API Key configurada globalmente por el administrador."
                : "Introduce tu API Key de Gemini. Se guardará de forma segura en tu navegador."
              }
            </p>
            
            <form onSubmit={handleSaveKey}>
              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--stone)' }}>
                    Gemini API Key
                  </label>
                  {hasKey && (
                    <span style={{ 
                      fontSize: '0.65rem', 
                      color: isEnvKey ? '#2563EB' : '#059669', 
                      background: isEnvKey ? '#EFF6FF' : '#ECFDF5', 
                      padding: '2px 8px', 
                      borderRadius: '4px', 
                      fontWeight: 600 
                    }}>
                      {isEnvKey ? '🌐 ENV CONFIG' : '🔒 LOCAL CONFIG'}
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

            <p style={{ marginTop: '24px', fontSize: '0.75rem', color: 'var(--stone)', textAlign: 'center' }}>
              ¿No tienes una? Consíguela en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--ink)', fontWeight: 600 }}>Google AI Studio</a>
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '56px' }} className="animate-fade-up">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          justifyContent: 'center',
          marginBottom: '16px',
        }}>
          <div style={{
            width: '48px', height: '48px',
            background: 'var(--postit)',
            borderRadius: '12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.5rem',
            boxShadow: '2px 4px 12px var(--postit-shadow)',
            transform: 'rotate(-6deg)',
          }}>💡</div>
          <h1 style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--ink)' }}>
            Atlas de Ideas
          </h1>
        </div>
        <p style={{ color: 'var(--ink-muted)', fontSize: '1rem', lineHeight: 1.6, maxWidth: '380px' }}>
          Plataforma de ideación colaborativa basada en la metodología{' '}
          <strong style={{ color: 'var(--ink)' }}>Manual Thinking</strong>
        </p>
      </div>

      {/* Main card */}
      <div className="card animate-fade-up" style={{
        width: '100%', maxWidth: '440px',
        padding: '40px 36px',
        animationDelay: '0.1s',
      }}>
        {!mode ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '8px', color: 'var(--ink)' }}>
              ¿Cómo quieres participar?
            </h2>

            <button
              className="btn-yellow"
              style={{ width: '100%', padding: '18px', fontSize: '1rem', borderRadius: '16px' }}
              onClick={() => setMode('create')}
            >
              🚀 Crear nueva sesión
            </button>

            <button
              className="btn-ghost"
              style={{ width: '100%', padding: '18px', fontSize: '1rem', borderRadius: '16px' }}
              onClick={() => setMode('join')}
            >
              🎯 Unirme con código
            </button>
          </div>
        ) : mode === 'create' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }} className="animate-pop">
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>
                {createStep === 1 ? 'Crear sesión' : 'Contexto del Proyecto'}
              </h2>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
                {createStep === 1 
                  ? 'Serás el administrador de la sesión y controlarás el flujo entre fases.'
                  : 'Dame información sobre qué producto o servicio vamos a idear/diseñar (Recuerda aportar los máximos datos posibles):'
                }
              </p>
            </div>

            {createStep === 1 ? (
              <div style={{
                background: 'rgba(255,215,0,0.08)',
                border: '1.5px solid rgba(255,215,0,0.3)',
                borderRadius: '14px',
                padding: '16px',
              }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <span style={{ fontSize: '1.5rem' }}>📋</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Tu sesión incluirá:</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', marginTop: '4px' }}>
                      4 subgrupos · Fase 1 (Captura) · OCR por lotes · Votación · Boceto IA
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <textarea
                className="input"
                placeholder="Ej: Vamos a diseñar una nueva app de movilidad urbana sostenible para Madrid, enfocada en micro-alquiler de patinetes eléctricos..."
                value={context}
                onChange={e => setContext(e.target.value)}
                style={{
                  minHeight: '120px',
                  padding: '16px',
                  fontSize: '0.9rem',
                  lineHeight: '1.5',
                  borderRadius: '14px',
                  resize: 'none',
                }}
                autoFocus
              />
            )}

            {error && (
              <div style={{ color: '#DC2626', fontSize: '0.875rem', background: '#FEF2F2', padding: '12px', borderRadius: '10px' }}>
                {error}
              </div>
            )}

            <button
              className="btn-yellow"
              style={{ width: '100%', padding: '16px', fontSize: '1rem', borderRadius: '14px' }}
              onClick={handleCreate}
              disabled={loading}
            >
              {loading ? '⏳ Creando...' : createStep === 1 ? 'Continuar →' : '✨ Crear sesión'}
            </button>
            <button className="btn-ghost" onClick={() => { 
                if (createStep === 2) { setCreateStep(1); setError(''); }
                else { setMode(null); setError(''); }
              }}>
              ← Volver
            </button>
          </div>
        ) : (
          <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="animate-pop">
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '8px' }}>
                Unirse a sesión
              </h2>
              <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
                Introduce el código de 6 caracteres que te ha facilitado el administrador.
              </p>
            </div>

            <input
              className="input"
              placeholder="Ej: AB3X9K"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              maxLength={8}
              style={{
                fontSize: '1.8rem',
                fontWeight: 800,
                letterSpacing: '0.3em',
                textAlign: 'center',
                padding: '20px',
                borderRadius: '16px',
              }}
              autoFocus
            />

            {error && (
              <div style={{ color: '#DC2626', fontSize: '0.875rem', background: '#FEF2F2', padding: '12px', borderRadius: '10px' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              style={{ width: '100%', padding: '16px', fontSize: '1rem', borderRadius: '14px' }}
              disabled={loading || code.length < 4}
            >
              {loading ? '⏳ Buscando...' : '🎯 Entrar'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => { setMode(null); setError(''); setCode('') }}>
              ← Volver
            </button>
          </form>
        )}
      </div>

      {/* Footer */}
      <p style={{ marginTop: '40px', color: 'var(--stone)', fontSize: '0.75rem' }}>
        Atlas de Ideas · Metodología Manual Thinking
      </p>
    </div>
  )
}

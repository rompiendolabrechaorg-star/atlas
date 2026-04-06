import { useState, useEffect, useCallback } from 'react'
import { analyzeImages, getIdeas } from '../lib/api'
import { supabase } from '../lib/supabase'
import PostitCard from './PostitCard'

function GroupCard({ group, sessionId, ideas, isAdmin }) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')

  const groupIdeas = ideas.filter(i => i.group_id === group.id)

  const processFiles = async (files) => {
    if (!files || files.length === 0) return
    
    // Ensure we are dealing with an array or FileList
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'))
    if (fileArray.length === 0) return

    setUploading(true)
    setError('')
    
    // Preview first image only for simplicity
    const url = URL.createObjectURL(fileArray[0])
    setPreview(url)
    
    try {
      await analyzeImages(sessionId, group.id, fileArray)
    } catch (e) {
      setError(`Error: ${e.message}`)
    } finally {
      setUploading(false)
    }
  }

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    processFiles(e.dataTransfer.files)
  }, [group.id, sessionId])

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Group header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--ink)' }}>
          {group.name}
        </h3>
        <span className="badge badge-gray">{groupIdeas.length} ideas</span>
      </div>

      {/* Upload zone */}
      {isAdmin && (
        <label
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          style={{ cursor: uploading ? 'wait' : 'pointer', position: 'relative' }}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            capture="environment"
            style={{ display: 'none' }}
            onChange={e => processFiles(e.target.files)}
            disabled={uploading}
          />
          {uploading ? (
            <div>
              <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🔍</div>
              <p style={{ fontWeight: 600, color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
                Analizando con IA...
              </p>
              <div style={{
                marginTop: '12px',
                height: '4px',
                borderRadius: '4px',
                background: 'var(--stone-light)',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: '60%',
                  background: 'var(--postit)',
                  borderRadius: '4px',
                  animation: 'shimmer 1.5s infinite',
                }} />
              </div>
            </div>
          ) : preview ? (
            <div style={{ position: 'relative' }}>
              <img src={preview} alt="preview" style={{
                width: '100%', maxHeight: '120px', objectFit: 'cover',
                borderRadius: '12px', opacity: 0.7,
              }} />
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', borderRadius: '12px',
                background: 'rgba(255,255,255,0.5)',
              }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--ink)' }}>
                  📷 Cambiar imagen
                </span>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>📷</div>
              <p style={{ fontWeight: 600, color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
                Subir foto de etiquetas
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--stone)', marginTop: '4px' }}>
                Arrastra o haz clic · JPG, PNG, HEIC
              </p>
            </div>
          )}
        </label>
      )}

      {error && (
        <div style={{ 
          fontSize: '0.85rem', color: '#B91C1C', background: '#FEF2F2', 
          padding: '12px', borderRadius: '12px', border: '1.5px solid #FCA5A5',
          animation: 'shake 0.4s ease-in-out'
        }}>
          <div style={{ fontWeight: 800, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span>⚠️ ERROR EN CAPTURA</span>
          </div>
          <p style={{ margin: 0, lineHeight: 1.4 }}>{error}</p>
          <button 
            onClick={() => { setError(''); setUploading(false); }}
            style={{ 
              marginTop: '10px', background: 'white', border: '1px solid #FCA5A5', 
              borderRadius: '6px', padding: '4px 10px', fontSize: '0.7rem', fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reintentar / Limpiar
          </button>
        </div>
      )}

      {/* Ideas grid */}
      {groupIdeas.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
          {groupIdeas.map((idea, i) => (
            <PostitCard key={idea.id} idea={idea} canEdit={isAdmin} style={{ animationDelay: `${i * 0.05}s` }} />
          ))}
        </div>
      )}

      {groupIdeas.length === 0 && !isAdmin && (
        <p style={{ fontSize: '0.8rem', color: 'var(--stone)', textAlign: 'center', padding: '20px 0' }}>
          Sin ideas aún
        </p>
      )}
    </div>
  )
}

export default function Phase1Capture({ sessionId, groups, isAdmin }) {
  const [ideas, setIdeas] = useState([])

  useEffect(() => {
    getIdeas(sessionId).then(setIdeas).catch(console.error)

    // Real-time: listen for new ideas
    const sub = supabase
      .channel(`ideas-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'ideas',
        filter: `session_id=eq.${sessionId}`,
      }, payload => setIdeas(prev => [...prev, payload.new]))
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'ideas',
        filter: `session_id=eq.${sessionId}`,
      }, payload => setIdeas(prev => prev.map(i => i.id === payload.new.id ? payload.new : i)))
      .subscribe()

    return () => supabase.removeChannel(sub)
  }, [sessionId])

  const totalIdeas = ideas.length

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--ink)', marginBottom: '6px' }}>
            📷 Fase 1: Captura de Ideas
          </h2>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
            Fotografía las etiquetas de cada subgrupo. Gemini extraerá el texto automáticamente.
          </p>
        </div>
        {totalIdeas > 0 && (
          <div style={{
            background: 'var(--postit)',
            padding: '8px 16px',
            borderRadius: '12px',
            fontWeight: 700,
            fontSize: '1rem',
            boxShadow: '0 2px 8px var(--postit-shadow)',
          }}>
            {totalIdeas} ideas capturadas
          </div>
        )}
      </div>

      {/* Groups grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: '20px',
      }}>
        {groups.map(group => (
          <GroupCard
            key={group.id}
            group={group}
            sessionId={sessionId}
            ideas={ideas}
            isAdmin={isAdmin}
          />
        ))}
      </div>

      {groups.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--stone)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '12px' }}>⏳</div>
          <p>Cargando grupos...</p>
        </div>
      )}
    </div>
  )
}

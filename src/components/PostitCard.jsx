import { useState } from 'react'
import { updateIdea } from '../lib/api'

export default function PostitCard({ idea, draggable = false, compact = false, style = {}, canEdit = false }) {
  const text = idea.content || idea.text || idea.idea || ''
  const drawing = idea.drawing_description || ''

  const [isEditing, setIsEditing] = useState(false)
  const [editedText, setEditedText] = useState(idea.content || idea.text || '')
  const [editedDrawing, setEditedDrawing] = useState(idea.drawing_description || '')
  const [saving, setSaving] = useState(false)

  const handleSave = async (e) => {
    e.stopPropagation()
    setSaving(true)
    try {
      await updateIdea(idea.id, editedText, editedDrawing)
      setIsEditing(false)
    } catch (err) {
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="postit animate-pop group"
      style={{
        background: 'var(--postit)',
        borderRadius: compact ? '10px' : '14px',
        padding: compact ? '10px 12px' : '16px',
        minHeight: compact ? '60px' : '90px',
        position: 'relative',
        cursor: draggable ? 'grab' : (isEditing ? 'default' : 'default'),
        userSelect: 'none',
        ...style,
      }}
    >
      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <textarea
            value={editedText}
            onChange={e => setEditedText(e.target.value)}
            style={{ fontSize: '0.8rem', width: '100%', border: '1px solid #ddd', borderRadius: '4px', padding: '4px' }}
            placeholder="Texto..."
          />
          <input
            value={editedDrawing}
            onChange={e => setEditedDrawing(e.target.value)}
            style={{ fontSize: '0.7rem', width: '100%', border: '1px solid #ddd', borderRadius: '4px', padding: '4px' }}
            placeholder="Descripción dibujo..."
          />
          <div style={{ display: 'flex', gap: '4px' }}>
            <button className="btn-primary" style={{ flex: 1, padding: '4px', fontSize: '0.7rem' }} onClick={handleSave} disabled={saving}>
              {saving ? '...' : '💾'}
            </button>
            <button className="btn-ghost" style={{ flex: 1, padding: '4px', fontSize: '0.7rem' }} onClick={() => setIsEditing(false)}>
              ✖
            </button>
          </div>
        </div>
      ) : (
        <>
          {text && (
            <p style={{
              fontSize: compact ? '0.75rem' : '0.875rem',
              fontWeight: 500,
              color: '#1C1917',
              lineHeight: 1.5,
              margin: 0,
              wordBreak: 'break-word',
            }}>
              {text}
            </p>
          )}
          {drawing && (
            <p style={{
              fontSize: compact ? '0.65rem' : '0.75rem',
              color: '#78716C',
              marginTop: text ? '6px' : 0,
              fontStyle: 'italic',
              lineHeight: 1.4,
              margin: text ? '6px 0 0 0' : 0,
            }}>
              ✏️ {drawing}
            </p>
          )}
          {canEdit && !compact && (
            <button
               className="opacity-0 group-hover:opacity-100 transition-opacity"
               style={{
                 position: 'absolute', top: '4px', right: '4px',
                 background: 'white', borderRadius: '50%', width: '24px', height: '24px',
                 display: 'flex', alignItems: 'center', justifyContent: 'center',
                 boxShadow: '0 2px 4px rgba(0,0,0,0.1)', cursor: 'pointer',
                 fontSize: '0.7rem',
                 border: 'none',
               }}
               onClick={(e) => { e.stopPropagation(); setIsEditing(true); }}
            >
              ✏️
            </button>
          )}
        </>
      )}
      {/* Subtle paper fold effect */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: compact ? '14px' : '18px',
        height: compact ? '14px' : '18px',
        background: 'rgba(0,0,0,0.07)',
        borderRadius: '6px 0 12px 0',
      }} />
    </div>
  )
}

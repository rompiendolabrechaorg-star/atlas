import { useState, useEffect } from 'react'
import {
  DndContext, DragOverlay, closestCenter, PointerSensor, useSensor, useSensors
} from '@dnd-kit/core'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import {
  getIdeas, getCategories, createCategory, updateCategoryTitle,
  assignIdeaToCategory, deleteCategory, autoClassifyIdeas
} from '../lib/api'
import { supabase } from '../lib/supabase'
import PostitCard from './PostitCard'

// ─── Draggable Postit ────────────────────────────────────
function DraggableIdea({ idea }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: idea.id })
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        opacity: isDragging ? 0.4 : 1,
        zIndex: isDragging ? 100 : 'auto',
      }}
      {...listeners}
      {...attributes}
    >
      <PostitCard idea={idea} draggable compact />
    </div>
  )
}

// ─── Droppable Category ───────────────────────────────────
function CategoryBox({ cat, ideas, isAdmin, onRename, onDelete }) {
  const { setNodeRef, isOver } = useDroppable({ id: cat.id })
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(cat.title)
  const assignedIds = (cat.idea_categories || []).map(ic => ic.idea_id)
  const assignedIdeas = ideas.filter(i => assignedIds.includes(i.id))

  const handleRename = async () => {
    setEditing(false)
    if (title.trim() !== cat.title) await onRename(cat.id, title.trim())
  }

  return (
    <div
      ref={setNodeRef}
      className={`category-container ${isOver ? 'drag-over' : ''}`}
      style={{ flex: '1 1 260px', minWidth: '240px', position: 'relative' }}
    >
      {/* Category title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {editing ? (
          <input
            className="input"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => e.key === 'Enter' && handleRename()}
            autoFocus
            style={{ padding: '6px 10px', fontSize: '0.875rem' }}
          />
        ) : (
          <h4
            style={{ fontWeight: 700, fontSize: '0.95rem', flex: 1, cursor: isAdmin ? 'text' : 'default' }}
            onClick={() => isAdmin && setEditing(true)}
            title={isAdmin ? 'Haz clic para editar' : ''}
          >
            {cat.title}
          </h4>
        )}
        <span className="badge badge-gray">{assignedIdeas.length}</span>
        {isAdmin && (
          <button
            onClick={() => onDelete(cat.id)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--stone)', fontSize: '1rem', padding: '0 4px' }}
            title="Eliminar categoría"
          >
            ×
          </button>
        )}
      </div>

      {/* Ideas in this category */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '80px' }}>
        {assignedIdeas.map(idea => (
          <DraggableIdea key={idea.id} idea={idea} />
        ))}
        {assignedIdeas.length === 0 && (
          <p style={{ fontSize: '0.78rem', color: 'var(--stone)', textAlign: 'center', paddingTop: '20px' }}>
            {isOver ? '📩 Suelta aquí' : 'Arrastra ideas aquí'}
          </p>
        )}
      </div>
    </div>
  )
}

export default function Phase2Synthesis({ sessionId, isAdmin }) {
  const [ideas, setIdeas] = useState([])
  const [categories, setCategories] = useState([])
  const [activeIdea, setActiveIdea] = useState(null)
  const [newCatTitle, setNewCatTitle] = useState('')
  const [loading, setLoading] = useState(true)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const load = async () => {
    const [i, c] = await Promise.all([getIdeas(sessionId), getCategories(sessionId)])
    setIdeas(i)
    setCategories(c)
    setLoading(false)
  }

  useEffect(() => {
    load()
    const channelId = `synthesis-${sessionId}`
    const sub = supabase
      .channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'idea_categories' }, load)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'categories', 
        filter: `session_id=eq.${sessionId}` 
      }, load)
      .subscribe()
    return () => {
      supabase.removeChannel(sub)
    }
  }, [sessionId])

  const handleDelete = async (catId) => {
    console.log('🗑 Deleting category:', catId)
    try {
      await deleteCategory(catId)
      await load()
    } catch (err) {
      console.error('Error deleting category:', err)
    }
  }

  // Unassigned ideas (not in any category)
  const assignedIds = categories.flatMap(c => (c.idea_categories || []).map(ic => ic.idea_id))
  const unassigned = ideas.filter(i => !assignedIds.includes(i.id))

  const handleDragStart = (e) => {
    setActiveIdea(ideas.find(i => i.id === e.active.id))
  }

  const handleDragEnd = async (e) => {
    setActiveIdea(null)
    const { active, over } = e
    if (!over || !active) return
    const catId = over.id
    const ideaId = active.id
    if (categories.find(c => c.id === catId)) {
      await assignIdeaToCategory(catId, ideaId)
      await load()
    }
  }

  const handleCreateCategory = async (e) => {
    e.preventDefault()
    if (!newCatTitle.trim()) return
    await createCategory(sessionId, newCatTitle.trim())
    setNewCatTitle('')
    await load()
  }

  const handleRename = async (catId, title) => {
    await updateCategoryTitle(catId, title)
    setCategories(prev => prev.map(c => c.id === catId ? { ...c, title } : c))
  }

  const handleAutoClassify = async () => {
    setLoading(true)
    try {
      await autoClassifyIdeas(sessionId)
      await load()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-muted)' }}>Cargando...</div>

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '6px' }}>🗂 Fase 2: Síntesis</h2>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
            Agrupa las ideas por temas. Arrastra los post-its a las categorías.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          {/* Unassigned sidebar */}
          <div style={{ width: '220px', flexShrink: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: '12px', color: 'var(--ink-muted)', letterSpacing: '0.05em' }}>
              IDEAS SIN CATEGORÍA ({unassigned.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unassigned.map(idea => (
                <DraggableIdea key={idea.id} idea={idea} />
              ))}
              {unassigned.length === 0 && (
                <p style={{ fontSize: '0.8rem', color: 'var(--stone)', textAlign: 'center', padding: '20px 0' }}>
                  ✅ Todas asignadas
                </p>
              )}
            </div>
          </div>

          {/* Categories canvas */}
          <div style={{ flex: 1 }}>
            {isAdmin && (
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                <form onSubmit={handleCreateCategory} style={{ display: 'flex', gap: '8px', flex: 1 }}>
                    <input
                      className="input"
                      placeholder="Nueva categoría..."
                      value={newCatTitle}
                      onChange={e => setNewCatTitle(e.target.value)}
                      style={{ maxWidth: '260px' }}
                    />
                    <button type="submit" className="btn-yellow" style={{ whiteSpace: 'nowrap' }}>
                      + Añadir
                    </button>
                </form>
                
                <div style={{ height: '24px', width: '1.5px', background: '#ddd' }} />

                <button 
                  onClick={handleAutoClassify} 
                  className="btn-ghost"
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--ink)', border: '1.5px dashed var(--postit)' }}
                  title="Agrupar ideas automáticamente según el contexto del proyecto"
                >
                  ✨ Auto-clasificar con IA
                </button>
              </div>
            )}

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
              {categories.map(cat => (
                <CategoryBox
                  key={cat.id}
                  cat={cat}
                  ideas={ideas}
                  isAdmin={isAdmin}
                  onRename={handleRename}
                  onDelete={handleDelete}
                />
              ))}
              {categories.length === 0 && isAdmin && (
                <div style={{ color: 'var(--stone)', fontSize: '0.875rem', padding: '40px', textAlign: 'center', width: '100%' }}>
                  Crea una categoría para empezar a agrupar ideas
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <DragOverlay>
        {activeIdea && <PostitCard idea={activeIdea} compact style={{ opacity: 0.9, boxShadow: '0 12px 32px rgba(0,0,0,0.2)' }} />}
      </DragOverlay>
    </DndContext>
  )
}

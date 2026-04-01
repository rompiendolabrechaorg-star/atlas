import { useState, useEffect } from 'react'
import { getIdeas, getVoteCounts, generateSketch, getResults, getSession } from '../lib/api'
import { supabase } from '../lib/supabase'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

const MATRIX_W = 560
const MATRIX_H = 420

function positionIdeas(ideas, voteCounts) {
  if (!ideas.length) return []

  const maxVotes = Math.max(...ideas.map(i => voteCounts[i.id] || 0), 1)

  return ideas.map((idea, idx) => {
    const votes = voteCounts[idea.id] || 0
    const rank = votes / maxVotes // 0–1, higher = better

    // Distribute across quadrants based on rank, with some variation
    const angle = (idx / ideas.length) * Math.PI * 0.5 + Math.PI * 0.1
    const originality = rank * 0.5 + Math.sin(idx * 2.1) * 0.15 + 0.15   // Y: 0–1
    const feasibility = rank * 0.45 + Math.cos(idx * 1.7) * 0.12 + 0.1   // X: 0–1

    return {
      ...idea,
      votes,
      x: Math.min(0.9, Math.max(0.05, feasibility)),
      y: Math.min(0.9, Math.max(0.05, originality)),
      rank,
    }
  })
}

export default function Phase4Matrix({ sessionId, isAdmin }) {
  const [ideas, setIdeas] = useState([])
  const [voteCounts, setVoteCounts] = useState({})
  const [positioned, setPositioned] = useState([])
  const [winnerIdea, setWinnerIdea] = useState(null)
  const [sketch, setSketch] = useState(null)
  const [generating, setGenerating] = useState(false)
  const [sketchError, setSketchError] = useState('')
  const [hovered, setHovered] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sessionContext, setSessionContext] = useState('')

  const load = async () => {
    const [i, v, r, s] = await Promise.all([
      getIdeas(sessionId), 
      getVoteCounts(sessionId), 
      getResults(sessionId),
      getSession(sessionId)
    ])
    const topIdeas = [...i].sort((a, b) => (v[b.id] || 0) - (v[a.id] || 0)).slice(0, 8)
    setIdeas(topIdeas)
    setVoteCounts(v)
    const pos = positionIdeas(topIdeas, v)
    setPositioned(pos)
    if (pos.length > 0) setWinnerIdea(pos.reduce((best, cur) => cur.x + cur.y > best.x + best.y ? cur : best))
    if (r?.sketch_b64) setSketch(r.sketch_b64)
    if (s?.context) setSessionContext(s.context)
    setLoading(false)
  }

  useEffect(() => { load() }, [sessionId])

  const handleGenerateSketch = async () => {
    if (!winnerIdea) return
    setGenerating(true)
    setSketchError('')
    try {
      const res = await generateSketch(sessionId, winnerIdea.text || winnerIdea.drawing_description, sessionContext)
      setSketch(res.sketch_b64)
    } catch (e) {
      setSketchError(`Error: ${e.message}`)
    } finally {
      setGenerating(false)
    }
  }

  const handleDownloadPDF = async () => {
    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 20

    // Header
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.text('Atlas de Ideas - Resumen de Sesión', 20, y)
    y += 10
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, y)
    y += 15

    // Context
    if (sessionContext) {
      doc.setFont('helvetica', 'bold')
      doc.text('Contexto del Proyecto:', 20, y)
      y += 6
      doc.setFont('helvetica', 'normal')
      const ctxLines = doc.splitTextToSize(sessionContext, pageWidth - 40)
      doc.text(ctxLines, 20, y)
      y += ctxLines.length * 5 + 10
    }

    // Top Ideas
    doc.setFont('helvetica', 'bold')
    doc.text('Ideas más votadas:', 20, y)
    y += 8
    doc.setFont('helvetica', 'normal')
    ideas.slice(0, 5).forEach((idea, idx) => {
        doc.text(`${idx + 1}. ${idea.text || idea.drawing_description} (${voteCounts[idea.id] || 0} votos)`, 25, y)
        y += 7
    })
    y += 10

    // Matrix Screenshot
    const matrixEl = document.querySelector('.matrix-container')
    if (matrixEl) {
        const canvas = await html2canvas(matrixEl)
        const imgData = canvas.toDataURL('image/png')
        const imgW = pageWidth - 40
        const imgH = (canvas.height * imgW) / canvas.width
        doc.addImage(imgData, 'PNG', 20, y, imgW, imgH)
        y += imgH + 20
    }

    // Winner & Sketch
    if (winnerIdea && sketch) {
        if (y > doc.internal.pageSize.getHeight() - 100) {
            doc.addPage()
            y = 20
        }
        doc.setFont('helvetica', 'bold')
        doc.text('Idea Ganadora:', 20, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        doc.text(winnerIdea.text || winnerIdea.drawing_description, 20, y)
        y += 10
        
        const sketchData = `data:image/png;base64,${sketch}`
        doc.addImage(sketchData, 'PNG', 40, y, 120, 120)
    }

    doc.save(`Atlas_Ideas_Reporte_${sessionId.substring(0, 5)}.pdf`)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--ink-muted)' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
           <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '6px' }}>🎯 Fase 4: Evaluación</h2>
           <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem' }}>
             Las ideas más votadas posicionadas según originalidad y facilidad de implementación.
           </p>
        </div>
        
        {isAdmin && (
            <button className="btn-ghost" onClick={handleDownloadPDF} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid #ddd' }}>
                📄 Descargar Informe PDF
            </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
        {/* 2D Matrix */}
        <div className="matrix-container card" style={{ padding: '24px' }}>
          <div style={{ position: 'relative', width: '100%', paddingBottom: `${(MATRIX_H / MATRIX_W) * 100}%` }}>
            <svg
              viewBox={`0 0 ${MATRIX_W} ${MATRIX_H}`}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
              {/* Axis lines */}
              <line x1="60" y1="20" x2="60" y2={MATRIX_H - 40} stroke="#E8E5E1" strokeWidth="2" />
              <line x1="60" y1={MATRIX_H - 40} x2={MATRIX_W - 20} y2={MATRIX_H - 40} stroke="#E8E5E1" strokeWidth="2" />

              {/* Quadrant shading */}
              <rect x="60" y="20" width={(MATRIX_W - 80) / 2} height={(MATRIX_H - 60) / 2} fill="rgba(168,162,158,0.04)" />
              <rect x={60 + (MATRIX_W - 80) / 2} y="20" width={(MATRIX_W - 80) / 2} height={(MATRIX_H - 60) / 2} fill="rgba(255,215,0,0.06)" />
              <rect x={60 + (MATRIX_W - 80) / 2} y={20 + (MATRIX_H - 60) / 2} width={(MATRIX_W - 80) / 2} height={(MATRIX_H - 60) / 2} fill="rgba(168,162,158,0.04)" />

              {/* Axis labels */}
              <text x="35" y={(MATRIX_H - 40) / 2 + 10} fontSize="11" fill="#A8A29E" textAnchor="middle" transform={`rotate(-90, 35, ${(MATRIX_H - 40) / 2 + 10})`} fontFamily="Inter">
                Originalidad / Valor
              </text>
              <text x={(MATRIX_W + 60) / 2} y={MATRIX_H - 10} fontSize="11" fill="#A8A29E" textAnchor="middle" fontFamily="Inter">
                Facilidad de Implementación
              </text>

              {/* "Zona Prometedora" label */}
              <text x={MATRIX_W - 80} y="38" fontSize="9" fill="#F59E0B" textAnchor="middle" fontWeight="600" fontFamily="Inter">
                ⭐ ZONA PROMETEDORA
              </text>

              {/* Grid lines (subtle) */}
              {[0.25, 0.5, 0.75].map(f => (
                <g key={f}>
                  <line
                    x1={60 + f * (MATRIX_W - 80)} y1="20" x2={60 + f * (MATRIX_W - 80)} y2={MATRIX_H - 40}
                    stroke="#E8E5E1" strokeWidth="1" strokeDasharray="4,4"
                  />
                  <line
                    x1="60" y1={20 + f * (MATRIX_H - 60)} x2={MATRIX_W - 20} y2={20 + f * (MATRIX_H - 60)}
                    stroke="#E8E5E1" strokeWidth="1" strokeDasharray="4,4"
                  />
                </g>
              ))}

              {/* Ideas */}
              {positioned.map((idea, idx) => {
                const cx = 60 + idea.x * (MATRIX_W - 80)
                const cy = MATRIX_H - 40 - idea.y * (MATRIX_H - 60)
                const isWinner = winnerIdea?.id === idea.id
                const isHovered = hovered === idea.id
                const r = isWinner ? 18 : 12

                return (
                  <g key={idea.id} style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHovered(idea.id)}
                    onMouseLeave={() => setHovered(null)}
                  >
                    {isWinner && (
                      <circle cx={cx} cy={cy} r={r + 6} fill="rgba(255,215,0,0.2)" />
                    )}
                    <circle
                      cx={cx} cy={cy} r={r}
                      fill={isWinner ? '#FFD700' : 'rgba(255,215,0,0.5)'}
                      stroke={isWinner ? '#F59E0B' : '#E8E5E1'}
                      strokeWidth={isWinner ? 2 : 1}
                    />
                    <text cx={cx} cy={cy} textAnchor="middle" dominantBaseline="central" fontSize={isWinner ? "10" : "8"} fontWeight="700" fill="#1C1917" fontFamily="Inter">
                      {idx + 1}
                    </text>
                    {(isHovered || isWinner) && (
                      <g>
                        <rect
                          x={cx + r + 4} y={cy - 14}
                          width={Math.min(180, (idea.text || idea.drawing_description || '').length * 5.5 + 12)}
                          height={28} rx={6}
                          fill="white" stroke="#E8E5E1" strokeWidth="1"
                        />
                        <text x={cx + r + 10} y={cy + 5} fontSize="9" fill="#1C1917" fontFamily="Inter">
                          {(idea.text || idea.drawing_description || 'Sin texto').substring(0, 28)}
                          {idea.votes ? ` (${idea.votes}v)` : ''}
                        </text>
                      </g>
                    )}
                  </g>
                )
              })}
            </svg>
          </div>

          {/* Legend */}
          <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {positioned.map((idea, idx) => (
              <div key={idea.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem',
                padding: '6px 8px', borderRadius: '8px',
                background: winnerIdea?.id === idea.id ? 'rgba(255,215,0,0.12)' : 'transparent',
                border: winnerIdea?.id === idea.id ? '1px solid rgba(255,215,0,0.4)' : '1px solid transparent',
              }}>
                <span style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: winnerIdea?.id === idea.id ? 'var(--postit)' : 'rgba(255,215,0,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '0.7rem', flexShrink: 0,
                }}>{idx + 1}</span>
                <span style={{ flex: 1, color: 'var(--ink)' }}>
                  {(idea.text || idea.drawing_description || 'Sin texto').substring(0, 40)}
                </span>
                <span className="badge badge-yellow">{idea.votes || 0}v</span>
                {winnerIdea?.id === idea.id && <span style={{ fontSize: '0.9rem' }}>⭐</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Winner + Sketch */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {winnerIdea && (
            <div className="card winner-glow" style={{ padding: '24px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', marginBottom: '8px' }}>
                ⭐ IDEA PROMETEDORA
              </div>
              <p style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--ink)', lineHeight: 1.5, marginBottom: '16px' }}>
                {winnerIdea.text || winnerIdea.drawing_description || 'Sin texto'}
              </p>
              {winnerIdea.drawing_description && winnerIdea.text && (
                <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)', fontStyle: 'italic', marginBottom: '16px' }}>
                  ✏️ {winnerIdea.drawing_description}
                </p>
              )}
              {isAdmin && !sketch && (
                <button
                  className="btn-yellow"
                  style={{ width: '100%' }}
                  onClick={handleGenerateSketch}
                  disabled={generating}
                >
                  {generating ? '🎨 Generando boceto con IA...' : '✨ Generar boceto visual (Nano Banana)'}
                </button>
              )}
              {sketchError && (
                <p style={{ fontSize: '0.8rem', color: '#DC2626', marginTop: '8px' }}>{sketchError}</p>
              )}
            </div>
          )}

          {/* Generated sketch */}
          {sketch && (
            <div className="card animate-pop" style={{ padding: '20px' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.06em', marginBottom: '12px' }}>
                🎨 BOCETO GENERADO CON IA
              </div>
              <img
                src={`data:image/png;base64,${sketch}`}
                alt="Boceto de la idea ganadora"
                style={{ width: '100%', borderRadius: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}
              />
              <button
                className="btn-ghost"
                style={{ width: '100%', marginTop: '12px', fontSize: '0.8rem' }}
                onClick={() => {
                  const a = document.createElement('a')
                  a.href = `data:image/png;base64,${sketch}`
                  a.download = 'boceto-idea-ganadora.png'
                  a.click()
                }}
              >
                ⬇️ Descargar boceto
              </button>
            </div>
          )}

          {generating && (
            <div className="card" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '2rem', marginBottom: '12px' }}>🎨</div>
              <p style={{ fontWeight: 600, color: 'var(--ink)', marginBottom: '8px' }}>Generando boceto visual...</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--ink-muted)' }}>Nano Banana está trabajando en ello</p>
              <div style={{ marginTop: '16px', height: '4px', borderRadius: '4px', background: 'var(--stone-light)', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--postit)', borderRadius: '4px', animation: 'shimmer 1.5s infinite' }} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

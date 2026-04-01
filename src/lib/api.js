import { supabase } from './supabase'
import { atlasEngine } from './atlasEngine'

// ── Sessions ──────────────────────────────────────────────
export async function createSession(adminId, context, voteLimit) {
  try {
    return await atlasEngine.createSession(adminId, context, voteLimit)
  } catch (e) {
    console.error("🔥 Atlas Engine error:", e)
    throw e
  }
}

export async function getSessionByCode(code) {
  const { data, error } = await supabase.from('sessions').select('*').eq('code', code.toUpperCase()).maybeSingle()
  if (error) throw error
  return data
}

export async function getSession(sessionId) {
  const { data, error } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
  if (error) throw error
  return data
}

export async function updatePhase(sessionId, phase) {
  const { error } = await supabase.from('sessions').update({ phase }).eq('id', sessionId)
  if (error) throw error
  return { ok: true }
}

export async function updateVoteLimit(sessionId, voteLimit) {
  const { error } = await supabase.from('sessions').update({ vote_limit: voteLimit }).eq('id', sessionId)
  if (error) throw error
  return { ok: true }
}

// ── Groups ────────────────────────────────────────────────
export async function getGroups(sessionId) {
  const { data, error } = await supabase.from('groups').select('*').eq('session_id', sessionId).order('name')
  if (error) throw error
  return data
}

// ── Phase 1: OCR ──────────────────────────────────────────
export async function analyzeImages(sessionId, groupId, files) {
  return atlasEngine.analyzeImages(sessionId, groupId, files)
}

export async function getIdeas(sessionId) {
  const { data, error } = await supabase.from('ideas').select('*').eq('session_id', sessionId)
  if (error) throw error
  return data
}

// ── Phase 2: Categories ───────────────────────────────────
export async function createCategory(sessionId, title) {
  const { data, error } = await supabase.from('categories').insert({
    id: window.crypto.randomUUID(),
    session_id: sessionId,
    title: title
  }).select().single()
  if (error) throw error
  return { ok: true, category: data }
}

export async function updateCategoryTitle(categoryId, title) {
  const { error } = await supabase.from('categories').update({ title }).eq('id', categoryId)
  if (error) throw error
  return { ok: true }
}

export async function assignIdeaToCategory(categoryId, ideaId) {
  // First remove from any existing category in the same session (optional constraint)
  await supabase.from('idea_categories').delete().eq('idea_id', ideaId)
  
  const { error } = await supabase.from('idea_categories').insert({
    category_id: categoryId,
    idea_id: ideaId
  })
  if (error) throw error
  return { ok: true }
}

export async function getCategories(sessionId) {
  const { data, error } = await supabase
    .from('categories')
    .select('*, idea_categories(idea_id)')
    .eq('session_id', sessionId)
  if (error) throw error
  return data
}

export async function deleteCategory(categoryId) {
  // DB handles cascading? If not, delete assignments first
  await supabase.from('idea_categories').delete().eq('category_id', categoryId)
  const { error } = await supabase.from('categories').delete().eq('id', categoryId)
  if (error) throw error
  return { ok: true }
}

// ── Phase 3: Voting ───────────────────────────────────────
export async function castVote(sessionId, ideaId, userToken) {
  const { data: vCount } = await supabase.from('votes').select('id', { count: 'exact' })
    .eq('session_id', sessionId).eq('user_token', userToken)
  
  const { data: session } = await supabase.from('sessions').select('vote_limit').eq('id', sessionId).single()
  
  if ((vCount?.length || 0) >= (session?.vote_limit || 3)) {
    throw new Error('Has alcanzado el límite de votos')
  }

  const { error } = await supabase.from('votes').insert({
    session_id: sessionId,
    idea_id: ideaId,
    user_token: userToken
  })
  if (error) throw error
  return { ok: true }
}

export async function removeVote(sessionId, ideaId, userToken) {
  const { error } = await supabase.from('votes').delete()
    .eq('session_id', sessionId).eq('idea_id', ideaId).eq('user_token', userToken)
  if (error) throw error
  return { ok: true }
}

export async function getVoteCounts(sessionId) {
  const { data, error } = await supabase.from('votes').select('idea_id').eq('session_id', sessionId)
  if (error) throw error
  
  const counts = {}
  data.forEach(v => {
    counts[v.idea_id] = (counts[v.idea_id] || 0) + 1
  })
  return counts
}

export async function getMyVotes(sessionId, userToken) {
  const { data, error } = await supabase.from('votes').select('idea_id').eq('session_id', sessionId).eq('user_token', userToken)
  if (error) throw error
  return data.map(v => v.idea_id)
}

// ── Phase 4: Sketch ───────────────────────────────────────
export async function generateSketch(sessionId, ideaText, groupContext = '') {
  return atlasEngine.generateSketch(sessionId, ideaText, groupContext)
}

export async function getResults(sessionId) {
  const { data: ideas } = await supabase.from('ideas').select('*').eq('session_id', sessionId)
  const { data: votes } = await supabase.from('votes').select('idea_id').eq('session_id', sessionId)
  
  const ideasWithVotes = ideas.map(idea => ({
    ...idea,
    vote_count: votes.filter(v => v.idea_id === idea.id).length
  }))
  
  return ideasWithVotes.sort((a,b) => b.vote_count - a.vote_count)
}

export async function updateIdea(ideaId, text, drawingDescription) {
  const updates = {}
  if (text !== undefined) updates.content = text
  if (drawingDescription !== undefined) updates.drawing_description = drawingDescription
  
  const { error } = await supabase.from('ideas').update(updates).eq('id', ideaId)
  if (error) throw error
  return { ok: true }
}

export async function autoClassifyIdeas(sessionId) {
  return atlasEngine.atlasEngine?.autoClassifyIdeas(sessionId) || atlasEngine.autoClassifyIdeas(sessionId)
}

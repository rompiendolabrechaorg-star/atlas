import { supabase } from './supabase'
import { GoogleGenerativeAI } from "@google/generative-ai"

/**
 * Deep cleanup helper (strips hidden chars, spaces, non-ascii)
 */
const cleanKey = (k) => {
  if (!k) return '';
  return k.trim().replace(/[^A-Za-z0-9\-_]/g, '');
}

export const getGeminiKey = () => {
  const localKey = localStorage.getItem('atlas_gemini_key');
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  // Prioritize local storage (explicitly set by user) then environment (system secret)
  const key = cleanKey(localKey) || cleanKey(envKey);
  return key;
}
export const setGeminiKey = (key) => localStorage.setItem('atlas_gemini_key', cleanKey(key))

/**
 * Initialize Gemini dynamically
 */
const getModel = (modelName = "gemini-1.5-flash") => {
  const key = getGeminiKey();
  if (!key) {
    console.error("❌ [Atlas] Error: No API Key found.");
    throw new Error("API_KEY_MISSING");
  }
  
  // Debug: Show start and end to verify cache isn't serving an old key
  console.log(`[Atlas] IA Init (v4.1 - STABLE V1). Key: ${key.slice(0,6)}...${key.slice(-4)} (Len: ${key.length})`);
  
  // Explicitly force v1beta for maximum compatibility
  const genAI = new GoogleGenerativeAI(key);
  const fullModelName = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
  return genAI.getGenerativeModel({ model: fullModelName }, { apiVersion: "v1" });
}

/**
 * Live Connection Test (v4.7 - Ultra Robust)
 */
export const testGeminiConnection = async (tempKey = null) => {
  try {
    const key = cleanKey(tempKey || getGeminiKey());
    if (!key) throw new Error("No hay llave configurada (ni en LocalStorage ni en Variables de Entorno)");
    
    console.log(`[Atlas] Testing Key: ${key.slice(0,6)}...${key.slice(-4)} (v1beta)`);
    
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "models/gemini-1.5-flash" }, { apiVersion: "v1" });
    
    // Minimal request to verify key validity
    const result = await model.generateContent("test");
    const response = await result.response;
    if (response) {
      return { ok: true, tokens: 1 };
    }
    throw new Error("Respuesta vacía de la API");
  } catch (e) {
    console.error("[Atlas] Test Failed:", e);
    // Categorize common errors
    let userMessage = e.message;
    if (e.message.includes("API key not valid")) userMessage = "La API Key no es válida o ha sido revocada.";
    if (e.message.includes("blocked")) userMessage = "La petición fue bloqueada por la API (revisa cuotas o seguridad).";
    
    return { ok: false, error: userMessage, rawError: e.message };
  }
}

console.log("🚀 Atlas Engine 4.0 - PRO DIAGNOSTICS ACTIVE");

export const atlasEngine = {
  
  /**
   * Create a new session record in Supabase
   */
  async createSession(adminId, context, voteLimit) {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    const sessionId = window.crypto.randomUUID()

    const { data, error } = await supabase.from('sessions').insert({
      id: sessionId,
      admin_id: adminId,
      context: context,
      code: code,
      vote_limit: voteLimit,
      phase: 1
    }).select().single()

    if (error) throw error

    const groups = ['Grupo A', 'Grupo B', 'Grupo C', 'Grupo D'].map(name => ({
      id: window.crypto.randomUUID(),
      session_id: sessionId,
      name: name
    }))
    await supabase.from('groups').insert(groups)

    return { session_id: sessionId, code: code }
  },

  /**
   * Analyze group images using Gemini OCR
   */
  async analyzeImages(sessionId, groupId, files) {
    const model = getModel("gemini-1.5-flash")

    const prompt = `
      Analiza estas imágenes de post-its de una sesión de ideación.
      Genera una lista de ideas detectadas de forma clara y concisa. 
      Devuelve SOLO un JSON con este formato: {"ideas": ["idea1", "idea2", ...]}
    `

    const imageParts = await Promise.all(
      files.map(async file => {
        const base64 = await toBase64(file)
        return {
          inlineData: {
            data: base64.split(",")[1],
            mimeType: file.type
          }
        }
      })
    )

    const result = await model.generateContent([prompt, ...imageParts])
    const response = await result.response
    const text = response.text()
    
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim()
    const { ideas } = JSON.parse(jsonStr)

    const ideaObjects = ideas.map(content => ({
      id: window.crypto.randomUUID(),
      session_id: sessionId,
      group_id: groupId,
      content: content
    }))

    const { error } = await supabase.from('ideas').insert(ideaObjects)
    if (error) throw error

    return { ok: true }
  },

  /**
   * Phase 2: AI Classification of ideas into categories
   */
  async autoClassifyIdeas(sessionId) {
    const model = getModel("gemini-1.5-flash")

    const { data: session } = await supabase.from('sessions').select('context').eq('id', sessionId).single()
    const { data: ideas } = await supabase.from('ideas').select('id, content').eq('session_id', sessionId)
    
    if (!ideas || ideas.length === 0) return { ok: true }

    const prompt = `
      Basado en este contexto de sesión: "${session?.context || 'Ideación general'}"
      Clasifica estas ideas en un máximo de 5 categorías lógicas.
      Ideas: ${JSON.stringify(ideas.map(i => ({id: i.id, text: i.content})))}
      Devuelve SOLO un JSON con este formato: 
      {"categories": [{"title": "Nombre Cat", "idea_ids": ["uuid1", "uuid2"]}]}
    `

    const result = await model.generateContent(prompt)
    const text = (await result.response).text()
    const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim()
    const { categories } = JSON.parse(jsonStr)

    for (const cat of categories) {
      const catId = window.crypto.randomUUID()
      await supabase.from('categories').insert({
        id: catId,
        session_id: sessionId,
        title: cat.title
      })

      const assignments = cat.idea_ids.map(ideaId => ({
        category_id: catId,
        idea_id: ideaId
      }))
      await supabase.from('idea_categories').insert(assignments)
    }

    return { ok: true }
  },

  /**
   * Phase 4: Generate sketch prompt for an idea
   */
  async generateSketch(sessionId, ideaText, groupContext = '') {
    const model = getModel("gemini-2.0-flash")

    const prompt = `
      Genera una descripción visual breve y creativa para ilustrar esta idea: "${ideaText}"
      Contexto opcional: "${groupContext}"
      El objetivo es que sea una guía para hacer un dibujo sencillo tipo boceto.
      Respuesta corta (máximo 2 frases).
    `

    const result = await model.generateContent(prompt)
    return { sketch_prompt: (await result.response).text() }
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => resolve(reader.result)
    reader.onerror = error => reject(error)
  })
}

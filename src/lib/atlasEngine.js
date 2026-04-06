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
  console.log(`[Atlas] IA Init (v5.0 - NEXT GEN 2026). Key: ${key.slice(0,6)}...${key.slice(-4)} (Len: ${key.length})`);
  
  // Explicitly force v1beta for maximum compatibility
  const genAI = new GoogleGenerativeAI(key);
  const fullModelName = modelName.startsWith('models/') ? modelName : `models/${modelName}`;
  return genAI.getGenerativeModel({ model: fullModelName }, { apiVersion: "v1beta" });
}

/**
 * Live Connection Test (v5.0 - Ultra Robust)
 */
export const testGeminiConnection = async (tempKey = null) => {
  try {
    const rawKey = tempKey || getGeminiKey();
    const key = cleanKey(rawKey);
    if (!key) throw new Error("API_KEY_MISSING");
    
    console.log(`[Atlas] Validando llave: ${key.slice(0,6)}... (v2.5)`);
    
    const genAI = new GoogleGenerativeAI(key);
    const model = genAI.getGenerativeModel({ model: "models/gemini-2.5-flash" });
    
    // Configurar timeout manual de 20s para el test
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);
    
    const result = await model.generateContent("test");
    clearTimeout(timeoutId);

    const response = await result.response;
    if (response) return { ok: true };
    throw new Error("Respuesta de IA vacía");
  } catch (e) {
    console.error("[Atlas] Test llave fallido:", e);
    let msg = e.message;
    if (msg.includes("API key not valid")) msg = "⚠️ LA LLAVE NO ES VÁLIDA (Google Error 400)";
    if (msg.includes("API_KEY_MISSING")) msg = "⚠️ NO HAY LLAVE CONFIGURADA";
    if (msg.name === 'AbortError') msg = "⚠️ TIEMPO DE ESPERA AGOTADO (Network Timeout)";
    return { ok: false, error: msg };
  }
}

console.log("🚀 Atlas Engine v5.0 - NEXT GEN 2026 ACTIVE");

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
    const model = getModel("gemini-2.5-flash")
    const prompt = `
      Eres un experto en facilitación visual y metodología Manual Thinking.
      Tu tarea es analizar estas imágenes de una sesión de ideación creativa.
      
      INSTRUCCIONES:
      1. Identifica cada post-it o tarjeta individualmente.
      2. Interpreta el texto manuscrito. Si el texto es difícil de leer, usa el contexto visual para deducir la idea lógica (ej: si hay una bombilla, es una idea creativa).
      3. Extrae la idea principal de cada tarjeta de forma concisa.
      4. Si hay dibujos, menciónalos solo si son clave para la idea.
      5. Devuelve SOLO un objeto JSON con este formato: 
      {"ideas": ["texto de la idea 1", "texto de la idea 2", ...]}
    `

    const imageParts = await Promise.all(
      files.map(async file => {
        const base64 = await toBase64(file)
        return { inlineData: { data: base64.split(",")[1], mimeType: file.type } }
      })
    )

    console.log(`[Atlas] Iniciando análisis AI para grupo ${groupId}...`);

    try {
      // Timeout de 45 segundos para el procesamiento de imágenes
      const result = await Promise.race([
        model.generateContent([prompt, ...imageParts]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT_REACHED")), 45000))
      ]);

      const response = await result.response
      const text = response.text()
      console.log("[Atlas IA] Respuesta cruda recibida:", text)

      let ideas = []
      try {
        const jsonStr = text.replace(/```json/g, "").replace(/```/g, "").trim()
        const parsed = JSON.parse(jsonStr)
        const rawIdeas = Array.isArray(parsed) ? parsed : (parsed.ideas || [])
        
        ideas = rawIdeas.map(item => {
          if (typeof item === 'string') return item.trim()
          if (typeof item === 'object' && item !== null) return (item.text || item.content || item.idea || JSON.stringify(item)).trim()
          return String(item).trim()
        }).filter(str => str.length > 2)

      } catch (e) {
        console.warn("[Atlas IA] Error de parseo, usando fallback de líneas.");
        ideas = text.split('\n').map(l => l.replace(/^[-*•\d.]+\s*/, '').trim()).filter(l => l.length > 5 && !l.includes('{'))
      }

      if (ideas.length === 0) throw new Error("NO_IDEAS_DETECTED")

      const ideaObjects = ideas.map(content => ({
        id: window.crypto.randomUUID(),
        session_id: sessionId,
        group_id: groupId,
        content: content,
        text: content // Legacy support
      }))

      const { error } = await supabase.from('ideas').insert(ideaObjects)
      if (error) throw error

      return { ok: true, count: ideas.length }
    } catch (e) {
      console.error("[Atlas IA] Error corregido en análisis:", e);
      let userMsg = e.message;
      if (e.message === "TIMEOUT_REACHED") userMsg = "⏱️ La IA está tardando demasiado. Prueba con menos fotos o revisa tu conexión.";
      if (e.message.includes("API key not valid")) userMsg = "⚠️ LLAVE INVÁLIDA (Google Error 400). Por favor, revisa tus Ajustes.";
      if (e.message === "NO_IDEAS_DETECTED") userMsg = "⚠️ No se detectaron ideas claras. Asegúrate de que los post-its sean legibles.";
      
      throw new Error(userMsg);
    }
  },

  /**
   * Phase 2: AI Classification of ideas into categories
   */
  async autoClassifyIdeas(sessionId) {
    const model = getModel("gemini-2.5-flash")

    const { data: session } = await supabase.from('sessions').select('context').eq('id', sessionId).single()
    const { data: ideas } = await supabase.from('ideas').select('id, content').eq('session_id', sessionId)
    
    if (!ideas || ideas.length === 0) return { ok: true }

    const prompt = `
      Actúa como un estratega experto en síntesis de ideas.
      Contexto de la sesión: "${session?.context || 'Ideación general'}"
      
      TAREA:
      1. Analiza las siguientes ideas extraídas de una sesión de Manual Thinking.
      2. Agrúpalas de forma inteligente en un máximo de 5 categorías temáticas.
      3. Asegúrate de que los nombres de las categorías sean profesionales y evocadores.
      4. Asigna cada ID de idea a la categoría que mejor le encaje.
      
      IDEAS A CLASIFICAR:
      ${JSON.stringify(ideas.map(i => ({id: i.id, text: i.content})))}
      
      IMPORTANTE: Devuelve SOLO un JSON con este formato: 
      {"categories": [{"title": "Nombre Categoría", "idea_ids": ["uuid1", "uuid2"]}]}
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

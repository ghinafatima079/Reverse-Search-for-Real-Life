import { fetchWithRetry, extractBrandProductModelFromText, sampleMockResult } from '../../lib/utils'

export default async function handler(req, res) {
  function sendError(status, message, code = 'ERROR', details) {
    const payload = { error: message, code }
    if (details) payload.details = details
    return res.status(status).json(payload)
  }

  if (req.method !== 'POST') return sendError(405, 'Method not allowed', 'METHOD_NOT_ALLOWED')
  const { image } = req.body
  if (!image) return sendError(400, 'No image provided', 'NO_IMAGE')

  // mock mode for local testing
  if (process.env.USE_MOCK === 'true') return res.json(sampleMockResult())

  const geminiKey = process.env.GEMINI_API_KEY?.trim()
  const googleKey = process.env.GOOGLE_API_KEY?.trim()
  const geminiModel = process.env.GEMINI_MODEL?.trim() || 'gemini-vision'
  const geminiUrl = process.env.GEMINI_API_URL || `https://generativelanguage.googleapis.com/v1beta2/models/${geminiModel}:predict`
  const hasConfiguredGemini = Boolean(geminiKey && geminiModel && geminiModel !== 'your-gemini-model-name')
  const hasConfiguredVision = Boolean(googleKey)

  if (!hasConfiguredGemini && !hasConfiguredVision) {
    const mock = sampleMockResult()
    return res.json({
      ...mock,
      raw: {
        ...mock.raw,
        note: 'No API key configured. Using local demo response. Set GEMINI_API_KEY or GOOGLE_API_KEY to enable live detection.'
      }
    })
  }

  async function heuristicsFromText(text, raw) {
    let brand = null, product = null, model = null
    if (!text && raw && typeof raw === 'object') text = JSON.stringify(raw)
    if (text) {
      // simple heuristics
      const brandCandidates = ['Apple','Samsung','Sony','LG','Dell','HP','Lenovo','Microsoft']
      for (const b of brandCandidates) if (text.includes(b)) { brand = b; break }

      const m = text.match(/[A-Z0-9][-A-Z0-9]{2,}/gi)
      if (m && m.length) model = m[0]

      // pick a product-like word (two-word phrase containing common nouns)
      const prodMatch = text.match(/([A-Za-z0-9]+\s+(phone|laptop|monitor|camera|printer|router|headphones|speaker|tv|television|charger|adapter))/i)
      if (prodMatch) product = prodMatch[0]
    }
    return { brand, product, model }
  }

  // Try Gemini/Generative API when key is present
  if (hasConfiguredGemini) {
    try {
      const body = {
        instances: [ { input_image: { image_bytes: image, mime_type: 'image/jpeg' } } ]
      }

      const r = await fetchWithRetry(geminiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${geminiKey}`
        },
        body: JSON.stringify(body)
      }, 2, 8000)

      const json = await r.json()
      const candidateText = json?.predictions?.[0]?.content || json?.outputs?.[0]?.content || json?.candidates?.[0]?.content || json?.response || JSON.stringify(json)

      // If configured, call a small text model to parse structured JSON from the candidate text
      const parserModel = process.env.GEMINI_PARSER_MODEL || process.env.GEMINI_MODEL || null
      const parserUrl = process.env.GEMINI_PARSER_URL || (parserModel ? `https://generativelanguage.googleapis.com/v1beta2/models/${parserModel}:generate` : null)

      if (parserUrl && geminiKey) {
        try {
          const prompt = `Extract the product information from the following text. Return a JSON object with keys \"brand\", \"product\", and \"model\" (use null for unknown). Text:\n\n"""\n${candidateText}\n"""\n
JSON:`

          const pbody = { prompt: { text: prompt } }
          const pr = await fetchWithRetry(parserUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${geminiKey}`
            },
            body: JSON.stringify(pbody)
          }, 2, 8000)

          const pjson = await pr.json()
          const ptext = pjson?.candidates?.[0]?.content || pjson?.predictions?.[0]?.content || pjson?.output?.[0]?.content || pjson?.response || JSON.stringify(pjson)
          let parsedObj = null
          try {
            // try direct JSON parse
            parsedObj = JSON.parse(ptext.trim())
          } catch (e) {
            // try to extract JSON substring
            const m = ptext.match(/\{[\s\S]*\}/)
            if (m) {
              try { parsedObj = JSON.parse(m[0]) } catch(e2) { parsedObj = null }
            }
          }

          if (parsedObj) {
            return res.json({ brand: parsedObj.brand || null, product: parsedObj.product || null, model: parsedObj.model || null, raw: { vision: json, parser: pjson } })
          }
        } catch (err) {
          console.warn('Parser model failed, falling back to heuristics', err)
        }
      }

      const parsed = extractBrandProductModelFromText(candidateText)
      return res.json({ brand: parsed.brand, product: parsed.product, model: parsed.model, raw: json })
    } catch (err) {
      console.error('Gemini request error', err)
      // continue to fallback to Google Vision if configured
    }
  }

  // Fallback: try Google Vision if configured (keeps original heuristics)
  if (hasConfiguredVision) {
    try {
      const body = {
        requests: [
          {
            image: { content: image },
            features: [
              { type: 'LOGO_DETECTION', maxResults: 5 },
              { type: 'LABEL_DETECTION', maxResults: 10 },
              { type: 'TEXT_DETECTION', maxResults: 20 }
            ]
          }
        ]
      }

      const r = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${googleKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (!r.ok) {
        const txt = await r.text()
        console.error('Google Vision fallback error', r.status, txt)
        return sendError(502, 'Vision API error', 'VISION_API_ERROR', txt)
      }
      const json = await r.json()
      const resp = json.responses && json.responses[0]

      let brand = null, product = null, model = null
      if (resp.logoAnnotations && resp.logoAnnotations.length) brand = resp.logoAnnotations[0].description
      if (resp.labelAnnotations && resp.labelAnnotations.length) product = resp.labelAnnotations.find(l => l.score > 0.6)?.description || resp.labelAnnotations[0].description
      if (resp.fullTextAnnotation && resp.fullTextAnnotation.text) {
        const txt = resp.fullTextAnnotation.text
        const m = txt.match(/[A-Z0-9][-A-Z0-9]{2,}/gi)
        if (m && m.length) model = m[0]
      } else if (resp.textAnnotations && resp.textAnnotations.length) {
        const txt = resp.textAnnotations.map(t => t.description).join(' ')
        const m = txt.match(/[A-Z0-9][-A-Z0-9]{2,}/gi)
        if (m && m.length) model = m[0]
      }

      if (!brand && resp.labelAnnotations) {
        const brandCandidates = ['Apple','Samsung','Sony','LG','Dell','HP','Lenovo','Microsoft']
        const found = resp.labelAnnotations.map(l => l.description).find(d => brandCandidates.includes(d))
        if (found) brand = found
      }

      return res.json({ brand, product, model, raw: resp })
    } catch (err) {
      console.error('Google Vision fallback error', err)
      return sendError(500, 'Vision handler error', 'INTERNAL_ERROR')
    }
  }
  return sendError(400, 'No GEMINI_API_KEY or GOOGLE_API_KEY configured', 'NO_API_KEY')
}

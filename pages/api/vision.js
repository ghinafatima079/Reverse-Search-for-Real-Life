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

  // quick mock mode for local testing
  if (process.env.USE_MOCK === 'true') {
    return res.json(sampleMockResult())
  }

  const apiKey = process.env.GOOGLE_API_KEY?.trim()
  if (!apiKey) {
    const mock = sampleMockResult()
    return res.json({
      ...mock,
      raw: {
        ...mock.raw,
        note: 'No Google Vision API key configured. Using local demo response.'
      }
    })
  }

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
    const r = await fetchWithRetry(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 2, 8000)

    const json = await r.json()
    const resp = json.responses && json.responses[0]

    // combine detected text and labels for heuristics
    const labelText = (resp.labelAnnotations || []).map(l => l.description).join(' ')
    const txt = (resp.fullTextAnnotation && resp.fullTextAnnotation.text) || (resp.textAnnotations && resp.textAnnotations.map(t => t.description).join(' ')) || ''
    const combined = `${labelText} ${txt}`.trim()
    const parsed = extractBrandProductModelFromText(combined)

    // prefer explicit logo detection for brand
    if (resp.logoAnnotations && resp.logoAnnotations.length) parsed.brand = resp.logoAnnotations[0].description

    return res.json({ brand: parsed.brand, product: parsed.product, model: parsed.model, raw: resp })
  } catch (err) {
    console.error('Vision handler error', err)
    return sendError(500, err.message || 'Internal error', 'INTERNAL_ERROR')
  }
}

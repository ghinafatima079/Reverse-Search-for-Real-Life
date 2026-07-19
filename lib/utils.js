export async function fetchWithRetry(url, opts = {}, retries = 2, timeout = 8000) {
  let attempt = 0
  while (true) {
    attempt++
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), timeout)
    try {
      const res = await fetch(url, { signal: controller.signal, ...opts })
      clearTimeout(id)
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        const err = new Error(`Request failed ${res.status}`)
        err.status = res.status
        err.body = txt
        throw err
      }
      return res
    } catch (err) {
      clearTimeout(id)
      if (attempt > retries) throw err
      const backoff = 200 * Math.pow(2, attempt)
      await new Promise(r => setTimeout(r, backoff))
    }
  }
}

export function extractBrandProductModelFromText(text) {
  if (!text) return { brand: null, product: null, model: null }
  const brandCandidates = ['Apple','Samsung','Sony','LG','Dell','HP','Lenovo','Microsoft','Bose','Canon','Nikon','Asus','Acer']
  let brand = null
  for (const b of brandCandidates) if (text.indexOf(b) !== -1) { brand = b; break }

  // model patterns: ABC-1234, X123, Model 1234, M12345
  const modelRegexes = [/[A-Z]{2,}-\d{2,}/g, /[A-Z0-9]{2,}-[A-Z0-9]{2,}/g, /\b[A-Z0-9]{2,}\d{2,}\b/g, /Model\s+[A-Z0-9-]{2,}/gi]
  let model = null
  for (const rx of modelRegexes) {
    const m = text.match(rx)
    if (m && m.length) { model = m[0].trim(); break }
  }

  // product: look for nouns following brand or common product nouns
  let product = null
  const productNouns = ['phone','laptop','monitor','camera','printer','router','headphones','speaker','tv','television','charger','adapter','tablet']
  for (const noun of productNouns) {
    const rx = new RegExp(`([A-Za-z0-9- ]{0,30}\\b${noun}\\b)`, 'i')
    const m = text.match(rx)
    if (m) { product = m[1].trim(); break }
  }

  // if still no product, try taking a short label from start of text
  if (!product) {
    const short = text.split(/[\n\.]/)[0]
    if (short && short.length < 60) product = short.trim()
  }

  return { brand, product, model }
}

export function sampleMockResult() {
  return {
    brand: 'Acme',
    product: 'Acme SuperPhone 3000',
    model: 'SP-3000',
    raw: { mock: true }
  }
}

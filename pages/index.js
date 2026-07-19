import { useState, useEffect } from 'react'

export default function Home() {
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [engine, setEngine] = useState('gemini') // 'gemini' or 'google'
  useEffect(() => {
    const saved = typeof window !== 'undefined' && localStorage.getItem('rs_engine')
    if (saved) setEngine(saved)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('rs_engine', engine)
  }, [engine])

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(f)
  }

  async function handleSubmit() {
    if (!file) return
    setLoading(true)
    setError(null)
    setResult(null)
    const reader = new FileReader()
    reader.onload = async () => {
      try {
        const base64 = reader.result.split(',')[1]
        const endpoint = engine === 'gemini' ? '/api/vision_gemini' : '/api/vision'
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64 })
        })
        if (!res.ok) throw new Error(await res.text())
        const data = await res.json()
        setResult(data)
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    reader.readAsDataURL(file)
  }

  function makeSearchURL(q, engine = 'google') {
    const qstr = encodeURIComponent(q)
    if (engine === 'youtube') return `https://www.youtube.com/results?search_query=${qstr}`
    return `https://www.google.com/search?q=${qstr}`
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-3xl">
        <div className="card">
          <h1 className="text-3xl font-semibold mb-2">Reverse Search for Real Life</h1>
          <p className="text-sm text-gray-600 mb-4">Upload a photo of a product; we extract brand, product and model and surface helpful resources.</p>

          <div className="flex gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Engine</label>
              <select value={engine} onChange={e => setEngine(e.target.value)} className="text-sm border rounded-md p-1">
                <option value="gemini">Gemini</option>
                <option value="google">Google Vision</option>
              </select>
            </div>
            <label className="flex-1 cursor-pointer bg-white border border-gray-200 rounded-md p-3 flex items-center gap-3">
              <input type="file" accept="image/*" onChange={handleFile} className="hidden" />
              <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center">
                {preview ? <img src={preview} className="object-cover w-full h-full rounded-md" alt="preview" /> : <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v4a1 1 0 001 1h3m10 0h3a1 1 0 001-1V7M7 21h10"/></svg>}
              </div>
              <div className="text-left">
                <div className="text-sm font-medium">Select an image</div>
                <div className="text-xs text-gray-500">Photo of product, box, label or serial</div>
              </div>
            </label>

            <div>
              <button onClick={handleSubmit} disabled={!file || loading} className="px-4 py-2 bg-black text-white rounded-md disabled:opacity-50">Identify</button>
            </div>
          </div>

          {loading && (
            <div className="mt-6 flex items-center gap-4">
              <div className="loader" />
              <div className="w-full">
                <div className="h-3 bg-gray-200 rounded-full mb-2 animate-pulse" />
                <div className="h-3 bg-gray-200 rounded-full w-5/6 animate-pulse" />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4">
              <div className="text-red-600">Error: {error}</div>
              <div className="mt-2">
                <button onClick={handleSubmit} disabled={!file || loading} className="px-3 py-1 bg-gray-800 text-white rounded-md mr-2">Retry</button>
              </div>
            </div>
          )}

          {result && (
            <div className="mt-6 grid grid-cols-1 gap-4">
              <div className="p-4 rounded-lg bg-white border">
                <div className="text-sm text-gray-500">Detected</div>
                <div className="text-lg font-medium">{result.brand || 'Unknown Brand'} — {result.product || 'Unknown Product'}</div>
                <div className="text-sm text-gray-600">Model: {result.model || 'Unknown'}</div>
                {result.raw?.note && <div className="mt-2 text-xs text-amber-600">{result.raw.note}</div>}
                {result.raw && (
                  <details className="mt-2 text-xs text-gray-500">
                    <summary>Raw detection details</summary>
                    <pre className="whitespace-pre-wrap">{JSON.stringify(result.raw, null, 2)}</pre>
                  </details>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { key: 'manual', title: 'User Manual', q: `${result.brand} ${result.product} ${result.model} user manual` },
                  { key: 'setup', title: 'Setup Guide', q: `${result.brand} ${result.product} ${result.model} setup guide` },
                  { key: 'troubleshoot', title: 'Troubleshooting', q: `${result.brand} ${result.product} ${result.model} troubleshooting` },
                  { key: 'youtube', title: 'YouTube Tutorials', q: `${result.brand} ${result.product} ${result.model} tutorial`, engine: 'youtube' }
                ].map(card => (
                  <a key={card.key} className="block p-4 rounded-lg border hover:shadow-lg transition" href={makeSearchURL(card.q, card.engine)} target="_blank" rel="noreferrer">
                    <div className="text-sm text-gray-500">{card.title}</div>
                    <div className="font-medium mt-2">{card.q.replace(result.brand || 'Unknown', '').trim()}</div>
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <footer className="mt-6 text-center text-xs text-gray-400">No data is stored. Uses Gemini or Google Vision on the server (set GEMINI_API_KEY/GEMINI_MODEL or GOOGLE_API_KEY).</footer>
      </div>
    </main>
  )
}

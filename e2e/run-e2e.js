const { spawn } = require('child_process')
const path = require('path')
const fs = require('fs')
const fetch = global.fetch || require('node-fetch')
const { chromium } = require('playwright')

const ROOT = path.join(__dirname, '..')
const SAMPLE = path.join(__dirname, 'assets', 'sample.png')

async function waitForServer(url, timeout = 30000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch (e) {}
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error('Server did not start in time')
}

async function run() {
  console.log('Starting dev server (mock mode)')
  const dev = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'dev'], {
    cwd: ROOT,
    env: { ...process.env, USE_MOCK: 'true', PORT: '3000' },
    stdio: ['ignore', 'pipe', 'pipe']
  })

  dev.stdout.on('data', d => process.stdout.write('[dev] ' + d.toString()))
  dev.stderr.on('data', d => process.stderr.write('[dev] ' + d.toString()))

  try {
    await waitForServer('http://localhost:3000')
    console.log('Server is up, running Playwright...')

    // ensure sample exists
    if (!fs.existsSync(SAMPLE)) throw new Error('Sample image not found: ' + SAMPLE)

    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    await page.goto('http://localhost:3000')

    // make sure engine is set to gemini
    await page.selectOption('select', 'gemini')

    // upload
    const input = await page.$('input[type=file]')
    await input.setInputFiles(SAMPLE)

    // click identify
    await page.click('text=Identify')

    // wait for mock brand from sampleMockResult (Acme)
    await page.waitForSelector('text=Acme', { timeout: 10000 })
    console.log('E2E: detected mock brand text on page')

    await browser.close()
    dev.kill()
    console.log('E2E succeeded')
    process.exit(0)
  } catch (err) {
    console.error('E2E failed', err)
    dev.kill()
    process.exit(1)
  }
}

run()

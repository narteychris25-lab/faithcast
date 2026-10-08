/**
 * Generates original, copyright-free demo media into resources/demo/:
 *   welcome-background.jpg, worship-background.jpg, offering-background.jpg,
 *   motion-loop.webm (8 s seamless loop), offering-pad.wav (30 s ambient pad)
 *
 * Dev-only tool. Run with:  npx electron scripts/make-demo-media.cjs
 */
const { app, BrowserWindow, ipcMain } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const out = join(__dirname, '..', 'resources', 'demo')
mkdirSync(out, { recursive: true })

const page = `
<canvas id="c" width="1920" height="1080"></canvas>
<script>
const { ipcRenderer } = require('electron')
const c = document.getElementById('c'), g = c.getContext('2d')

function scene(t, a, b, glow) {
  const grd = g.createLinearGradient(0, 0, 1920, 1080)
  grd.addColorStop(0, a); grd.addColorStop(1, b)
  g.fillStyle = grd; g.fillRect(0, 0, 1920, 1080)
  for (let i = 0; i < 7; i++) {
    const x = 960 + Math.cos(t * 2 * Math.PI + i * 0.9) * (300 + i * 60)
    const y = 540 + Math.sin(t * 2 * Math.PI * (i % 2 ? 1 : -1) + i) * (160 + i * 25)
    const r = 260 + i * 40
    const rg = g.createRadialGradient(x, y, 0, x, y, r)
    rg.addColorStop(0, glow); rg.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill()
  }
  // soft light rays
  g.save(); g.globalAlpha = 0.07; g.fillStyle = '#fff'
  for (let i = 0; i < 6; i++) {
    g.beginPath(); const o = (i * 320 + t * 320) % 2200 - 200
    g.moveTo(o, 0); g.lineTo(o + 120, 0); g.lineTo(o - 380, 1080); g.lineTo(o - 500, 1080); g.fill()
  }
  g.restore()
}

async function still(name, a, b, glow, t) {
  scene(t, a, b, glow)
  ipcRenderer.send('file', name, c.toDataURL('image/jpeg', 0.9))
}

async function video() {
  const stream = c.captureStream(30)
  const rec = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 6_000_000 })
  const chunks = []
  rec.ondataavailable = (e) => chunks.push(e.data)
  const done = new Promise((r) => (rec.onstop = r))
  rec.start(500)
  const dur = 8000, start = performance.now()
  await new Promise((resolve) => {
    function frame() {
      const t = (performance.now() - start) / dur
      scene(t % 1, '#1b1446', '#05040f', 'rgba(120,110,255,0.35)')
      if (t < 1) requestAnimationFrame(frame); else resolve()
    }
    frame()
  })
  rec.stop(); await done
  const buf = await new Blob(chunks, { type: 'video/webm' }).arrayBuffer()
  ipcRenderer.send('bin', 'motion-loop.webm', new Uint8Array(buf))
}

async function audio() {
  const sr = 44100, secs = 30
  const ctx = new OfflineAudioContext(2, sr * secs, sr)
  const master = ctx.createGain(); master.gain.value = 0.18; master.connect(ctx.destination)
  // Slow chord progression (I – vi – IV – V in D), soft sine/triangle pad.
  const chords = [[146.83, 185.0, 220.0], [123.47, 146.83, 185.0], [98.0, 146.83, 196.0], [110.0, 138.59, 164.81]]
  chords.forEach((ch, i) => {
    const t0 = i * 7.5
    ch.forEach((f, k) => {
      for (const type of ['sine', 'triangle']) {
        const o = ctx.createOscillator(); o.type = type; o.frequency.value = f * (type === 'triangle' ? 2 : 1); o.detune.value = (k - 1) * 4
        const gn = ctx.createGain(); gn.gain.setValueAtTime(0, t0)
        gn.gain.linearRampToValueAtTime(type === 'sine' ? 0.5 : 0.12, t0 + 2.5)
        gn.gain.linearRampToValueAtTime(0, t0 + 9)
        o.connect(gn).connect(master); o.start(t0); o.stop(t0 + 9.5)
      }
    })
  })
  const buf = await ctx.startRendering()
  // Encode 16-bit PCM WAV
  const n = buf.length, ch = 2, bytes = 44 + n * ch * 2
  const dv = new DataView(new ArrayBuffer(bytes))
  const w = (o, s) => [...s].forEach((c2, i) => dv.setUint8(o + i, c2.charCodeAt(0)))
  w(0, 'RIFF'); dv.setUint32(4, bytes - 8, true); w(8, 'WAVE'); w(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true)
  dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * ch * 2, true)
  const L = buf.getChannelData(0), R = buf.getChannelData(1)
  for (let i = 0, o = 44; i < n; i++) { for (const s of [L[i], R[i]]) { dv.setInt16(o, Math.max(-1, Math.min(1, s)) * 0x7fff, true); o += 2 } }
  ipcRenderer.send('bin', 'offering-pad.wav', new Uint8Array(dv.buffer))
}

;(async () => {
  await still('welcome-background.jpg', '#0f3b5f', '#07121f', 'rgba(80,180,255,0.30)', 0.1)
  await still('worship-background.jpg', '#4a1d0f', '#120604', 'rgba(255,150,80,0.30)', 0.35)
  await still('offering-background.jpg', '#123d2b', '#04110b', 'rgba(120,255,180,0.22)', 0.6)
  await video()
  await audio()
  ipcRenderer.send('done')
})()
</script>`

app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false, width: 1920, height: 1080, webPreferences: { nodeIntegration: true, contextIsolation: false, backgroundThrottling: false, offscreen: false } })
  ipcMain.on('file', (_e, name, dataUrl) => {
    writeFileSync(join(out, name), Buffer.from(dataUrl.split(',')[1], 'base64'))
    console.log('wrote', name)
  })
  ipcMain.on('bin', (_e, name, bytes) => {
    writeFileSync(join(out, name), Buffer.from(bytes))
    console.log('wrote', name, bytes.length)
  })
  ipcMain.on('done', () => app.quit())
  void win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page))
})

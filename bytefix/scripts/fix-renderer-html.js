/**
 * Post-build script: Fix renderer HTML and JS for packaged Electron builds
 *
 * Problems:
 * 1. Vite outputs <script type="module" crossorigin> but the actual bundle
 *    contains NO import/export statements (it's a plain script). type="module"
 *    fails on file:// protocol due to CORS restrictions.
 * 2. Vite's bundle renames React to React$1 internally, but some compiled JSX
 *    references React.createElement directly, causing "React is not defined".
 * 3. Module scripts in <head> have implicit defer, but regular scripts don't,
 *    so we move them to end of <body> after <div id="root">.
 *
 * Solution: Strip type="module"/crossorigin, patch JS to alias React, move
 * scripts to end of body.
 */
const fs = require('fs')
const path = require('path')

// --- Fix HTML ---
const htmlPath = path.join(__dirname, '..', 'out', 'renderer', 'index.html')

if (!fs.existsSync(htmlPath)) {
  console.log('⚠️  Renderer HTML not found, skipping fix')
  process.exit(0)
}

let html = fs.readFileSync(htmlPath, 'utf8')

// Remove type="module" and crossorigin from script/link tags
// (the bundle is NOT an ES module - it has no import/export statements)
html = html.replace(/<script\s+type="module"\s+crossorigin\s+/g, '<script ')
html = html.replace(/<script\s+type="module"\s+/g, '<script ')
html = html.replace(/(<script[^>]*?)\s+crossorigin/g, '$1')
html = html.replace(/(<link[^>]*?)\s+crossorigin/g, '$1')

// Move script tags from <head> to end of <body> (after <div id="root">)
// so the DOM is ready when the script executes
const scriptTags = []
html = html.replace(/<script\s+src="[^"]+"[^>]*><\/script>/g, (match) => {
  scriptTags.push(match)
  return ''
})
if (scriptTags.length > 0) {
  html = html.replace('</body>', '    ' + scriptTags.join('\n    ') + '\n  </body>')
}

fs.writeFileSync(htmlPath, html, 'utf8')
console.log('✅ Fixed renderer HTML: removed type="module"/crossorigin, moved scripts after #root')

// --- Fix JS: alias React$1 -> React ---
const assetsDir = path.join(__dirname, '..', 'out', 'renderer', 'assets')
if (fs.existsSync(assetsDir)) {
  const files = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'))
  for (const file of files) {
    const jsPath = path.join(assetsDir, file)
    let js = fs.readFileSync(jsPath, 'utf8')

    // Check if bundle uses React$1 (Vite's renamed React) but also has
    // bare React. references (from compiled JSX)
    if (js.includes('React$1') && /(?<!\$)React\./.test(js)) {
      // Assign React to window/globalThis so it's accessible everywhere,
      // even inside Vite's IIFE wrapper where var would be scoped locally.
      // Also prepend a placeholder so any early references don't crash.
      const marker = 'const React$1 = /* @__PURE__ */ getDefaultExportFromCjs(reactExports);'
      const idx = js.indexOf(marker)
      if (idx !== -1) {
        const insertPos = idx + marker.length
        js = js.slice(0, insertPos) + '\nwindow.React = React$1;' + js.slice(insertPos)
      } else {
        console.warn(`\u26a0\ufe0f  ${file}: React$1 marker not found — alias not inserted. Vite output may have changed.`)
      }
      // Prepend empty React object so any code before the real assignment doesn't crash
      js = 'window.React = window.React || {};\n' + js
      fs.writeFileSync(jsPath, js, 'utf8')
      console.log(`✅ Fixed ${file}: added window.React = React$1 global alias`)
    }
  }
}

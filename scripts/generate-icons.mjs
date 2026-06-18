// Generates the PWA + Apple touch icons from a single SVG source.
// Run with: npm run icons   (regenerate whenever src/assets/icon-source.svg changes)
import sharp from 'sharp'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(resolve(root, 'src/assets/icon-source.svg'))

const targets = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'pwa-maskable-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
]

for (const { name, size } of targets) {
  await sharp(source)
    .resize(size, size)
    .png()
    .toFile(resolve(root, 'public', name))
  console.log(`generated public/${name} (${size}x${size})`)
}

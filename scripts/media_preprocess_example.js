// scripts/media_preprocess_example.js
// Exemplo ilustrativo de pré-processamento com sharp (imagens). Para vídeos, usar fluent-ffmpeg.
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const input = process.argv[2]
if (!input) {
  console.log('Uso: npm run media:preprocess -- <arquivo_imagem>')
  process.exit(1)
}
const outDir = path.join(process.cwd(), 'server', 'public', 'derivatives')
fs.mkdirSync(outDir, { recursive: true })
const out = path.join(outDir, 'sample_1920x1080.jpg')

// Redimensiona em modo cover 1920x1080
const main = async () => {
  await sharp(input).resize({ width: 1920, height: 1080, fit: 'cover', position: 'centre' }).jpeg({ quality: 85, progressive: true }).toFile(out)
  console.log('OK ->', out)
}
main().catch((e) => { console.error(e); process.exit(1) })

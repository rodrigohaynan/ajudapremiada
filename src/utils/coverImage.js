const TARGET_WIDTH = 1200
const TARGET_HEIGHT = 630
const MAX_FILE_SIZE = 12 * 1024 * 1024

export async function prepareCampaignCover(file) {
  if (!file) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Use uma imagem JPG, PNG ou WEBP.')
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('A imagem pode ter no máximo 12 MB.')
  }

  const source = await readImage(file)
  const canvas = document.createElement('canvas')
  canvas.width = TARGET_WIDTH
  canvas.height = TARGET_HEIGHT
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#f7faf9'
  ctx.fillRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT)

  const sourceRatio = source.width / source.height
  const targetRatio = TARGET_WIDTH / TARGET_HEIGHT
  let sx = 0
  let sy = 0
  let sw = source.width
  let sh = source.height

  if (sourceRatio > targetRatio) {
    sw = source.height * targetRatio
    sx = (source.width - sw) / 2
  } else {
    sh = source.width / targetRatio
    sy = (source.height - sh) / 2
  }

  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, TARGET_WIDTH, TARGET_HEIGHT)

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.8),
    originalName: file.name,
    width: TARGET_WIDTH,
    height: TARGET_HEIGHT,
  }
}

function readImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.onload = () => {
      const image = new Image()
      image.onerror = () => reject(new Error('Não foi possível processar a imagem.'))
      image.onload = () => resolve(image)
      image.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}

const POPULATION_COUNT = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4]

/** Calculates a 64-bit horizontal difference hash from a 9x8 grayscale frame. */
export function computeDHash(pixels: Uint8Array, width = 9, height = 8) {
  const expectedLength = width * height
  if (pixels.length < expectedLength) throw new Error(`dHashに必要なピクセル数が不足しています (${pixels.length}/${expectedLength})`)

  const hashBytes = new Uint8Array(8)
  let bitIndex = 0
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width - 1; x += 1) {
      const left = pixels[y * width + x]
      const right = pixels[y * width + x + 1]
      if (left > right) hashBytes[Math.floor(bitIndex / 8)] |= 1 << (7 - (bitIndex % 8))
      bitIndex += 1
    }
  }

  return Array.from(hashBytes, (value) => value.toString(16).padStart(2, '0')).join('')
}

export function computeAverageLuma(pixels: Uint8Array) {
  if (pixels.length === 0) throw new Error('輝度計算に必要なピクセルがありません')
  let total = 0
  for (const pixel of pixels) total += pixel
  return total / pixels.length
}

export function hammingDistance(first: string, second: string) {
  if (first.length !== second.length) throw new Error('異なる長さのhashは比較できません')

  let distance = 0
  for (let index = 0; index < first.length; index += 1) {
    const difference = Number.parseInt(first[index], 16) ^ Number.parseInt(second[index], 16)
    distance += POPULATION_COUNT[difference & 0xf]
  }
  return distance
}

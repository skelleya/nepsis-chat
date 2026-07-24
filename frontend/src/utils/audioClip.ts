/** Decode a browser-supported audio file and export a selected segment as WAV. */
export async function clipAudioToWav(
  file: File,
  startSeconds: number,
  maxDurationSeconds = 10
): Promise<File> {
  const context = new AudioContext()
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer())
    const startFrame = Math.max(0, Math.floor(startSeconds * decoded.sampleRate))
    const frameCount = Math.min(
      Math.floor(maxDurationSeconds * decoded.sampleRate),
      decoded.length - startFrame
    )
    if (frameCount <= 0) throw new Error('The selected clip is empty')

    const channels = Math.min(decoded.numberOfChannels, 2)
    const bytesPerSample = 2
    const dataSize = frameCount * channels * bytesPerSample
    const buffer = new ArrayBuffer(44 + dataSize)
    const view = new DataView(buffer)
    const writeText = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i))
    }

    writeText(0, 'RIFF')
    view.setUint32(4, 36 + dataSize, true)
    writeText(8, 'WAVE')
    writeText(12, 'fmt ')
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, channels, true)
    view.setUint32(24, decoded.sampleRate, true)
    view.setUint32(28, decoded.sampleRate * channels * bytesPerSample, true)
    view.setUint16(32, channels * bytesPerSample, true)
    view.setUint16(34, 16, true)
    writeText(36, 'data')
    view.setUint32(40, dataSize, true)

    let offset = 44
    const channelData = Array.from({ length: channels }, (_, channel) => decoded.getChannelData(channel))
    for (let frame = 0; frame < frameCount; frame += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const value = Math.max(-1, Math.min(1, channelData[channel][startFrame + frame] ?? 0))
        view.setInt16(offset, value < 0 ? value * 0x8000 : value * 0x7fff, true)
        offset += bytesPerSample
      }
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '').slice(0, 48) || 'sound'
    return new File([buffer], `${baseName}-clip.wav`, { type: 'audio/wav' })
  } finally {
    void context.close()
  }
}

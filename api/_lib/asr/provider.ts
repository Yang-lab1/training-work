import type { TranscribeRequest, TranscribeSuccess } from '../../../src/lib/asr/types.js'

export interface ASRProvider {
  name: string
  transcribe(input: TranscribeRequest): Promise<TranscribeSuccess>
}

import { useEffect } from 'react'

export function useRecordingGuard(
  recordingTaskId: string | null,
  recordingQuestionId: string | null,
) {
  useEffect(() => {
    const isRecording = recordingTaskId !== null || recordingQuestionId !== null
    if (!isRecording) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [recordingTaskId, recordingQuestionId])
}

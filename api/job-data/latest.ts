const DEFAULT_BASE_URL = 'https://raw.githubusercontent.com/Yang-lab1/training-work/main/latest'

declare const process: {
  env: Record<string, string | undefined>
}

type FeedFile = 'manifest' | 'jobs' | 'jobs_delta' | 'job_sources'

const fileMap: Record<FeedFile, string> = {
  manifest: 'manifest.json',
  jobs: 'jobs.json',
  jobs_delta: 'jobs_delta.json',
  job_sources: 'job_sources.json',
}

function json(payload: unknown, status = 200) {
  return Response.json(payload, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function getBaseUrl() {
  return (process.env.JOB_DATA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
}

function getToken() {
  return process.env.JOB_DATA_GITHUB_TOKEN || process.env.GITHUB_TOKEN || ''
}

async function fetchFeedJson(file: FeedFile) {
  const url = `${getBaseUrl()}/${fileMap[file]}`
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(url, { headers, cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`job data fetch failed: ${response.status} ${response.statusText}`)
  }
  return response.json() as Promise<unknown>
}

function parseFileParam(request: Request): FeedFile | null {
  const url = new URL(request.url)
  const file = url.searchParams.get('file')
  if (!file) return null
  if (file in fileMap) return file as FeedFile
  return null
}

export default {
  async fetch(request: Request) {
    if (request.method !== 'GET') {
      return json({ success: false, error: 'Only GET requests are supported.' }, 405)
    }

    try {
      const requestedFile = parseFileParam(request)
      if (new URL(request.url).searchParams.has('file') && !requestedFile) {
        return json({ success: false, error: 'The file parameter supports manifest, jobs, jobs_delta, or job_sources.' }, 400)
      }

      if (requestedFile) {
        return json({
          success: true,
          file: requestedFile,
          data: await fetchFeedJson(requestedFile),
        })
      }

      const [manifest, jobs, delta, sources] = await Promise.all([
        fetchFeedJson('manifest'),
        fetchFeedJson('jobs'),
        fetchFeedJson('jobs_delta'),
        fetchFeedJson('job_sources'),
      ])

      return json({
        success: true,
        manifest,
        jobs,
        delta,
        sources,
      })
    } catch (error) {
      return json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read job data.',
      }, 502)
    }
  },
}

declare const process: {
  env: Record<string, string | undefined>
}

export const serverEnv = process.env

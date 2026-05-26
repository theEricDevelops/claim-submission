export interface AppConfig {
  docuseal: {
    apiKey: string
    apiUrl: string
  }
  geoapifyApiKey: string
  sessionSecret: string
  sharedApiKey: string
}

export const config: AppConfig = {
  docuseal: {
    apiKey: process.env.DOCUSEAL_API_KEY || '',
    apiUrl: process.env.DOCUSEAL_API_URL || 'https://sign.plpas.com/api',
  },
  geoapifyApiKey: process.env.GEOAPIFY_API_KEY || '',
  sessionSecret: process.env.SESSION_SECRET || '',
  sharedApiKey: process.env.API_SHARED_SECRET || '',
}

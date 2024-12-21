import {MetadataRoute} from 'next'

import {env} from '@/env.mjs'

const sitemap = (): MetadataRoute.Sitemap => [
  {
    url: env.APP_URL || '/',
    lastModified: new Date(),
    changeFrequency: 'yearly',
    priority: 1,
    alternates: {
      languages: {
        pl: `${env.APP_URL}/pl`,
      },
    },
  },
]

export default sitemap

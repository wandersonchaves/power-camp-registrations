import {MetadataRoute} from 'next'

import {env} from '@/env.mjs'

const robots = (): MetadataRoute.Robots => ({
  rules: {
    userAgent: '*',
    allow: '/',
  },
  sitemap: `${env.APP_URL}/sitemap.xml`,
})

export default robots

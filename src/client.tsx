import { StartClient, hydrateStart } from '@tanstack/react-start/client'
import { getRouter } from './router'

const router = getRouter()

hydrateStart({ router, children: <StartClient router={router} /> })

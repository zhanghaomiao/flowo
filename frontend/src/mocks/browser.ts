import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const worker = setupWorker(...handlers)

// Start MSW conditionally
const startMSW = async () => {
  if (import.meta.env.DEV || import.meta.env.VITE_ENABLE_MSW === 'true') {
    try {
      await worker.start({
        serviceWorker: {
          url: `${import.meta.env.BASE_URL}mockServiceWorker.js`,
        },
        onUnhandledRequest: 'bypass',
      })
      console.log('MSW Service Worker started')
    } catch (error) {
      console.warn('Failed to start MSW:', error)
    }
  }
}

startMSW()

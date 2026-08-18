import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Note: StrictMode double-invokes effects in dev, which would mount/destroy
// the robot twice. The SDK handles this correctly (destroy removes the host),
// but to keep the example output clean we run without StrictMode.
createRoot(document.getElementById('root')!).render(<App />)

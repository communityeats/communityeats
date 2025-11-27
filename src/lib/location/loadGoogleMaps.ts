'use client'

let googleMapsPromise: Promise<typeof window.google> | null = null

const GOOGLE_SCRIPT_ATTRIBUTE = 'data-google-maps'

function attachLoadListener(element: HTMLScriptElement): Promise<typeof window.google> {
  return new Promise((resolve, reject) => {
    element.addEventListener('load', () => {
      if (window.google?.maps) {
        resolve(window.google)
      } else {
        reject(new Error('Google Maps script loaded but `google.maps` is unavailable.'))
      }
    })
    element.addEventListener('error', () => reject(new Error('Failed to load Google Maps script.')))
  })
}

export function loadGoogleMaps(apiKey: string): Promise<typeof window.google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only be loaded in the browser.'))
  }

  if (window.google?.maps?.places) {
    return Promise.resolve(window.google)
  }

  if (!apiKey) {
    return Promise.reject(new Error('Missing Google Maps API key.'))
  }

  if (!googleMapsPromise) {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[${GOOGLE_SCRIPT_ATTRIBUTE}]`)
    if (existingScript) {
      googleMapsPromise = attachLoadListener(existingScript)
    } else {
      const script = document.createElement('script')
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places`
      script.async = true
      script.defer = true
      script.setAttribute(GOOGLE_SCRIPT_ATTRIBUTE, 'true')
      googleMapsPromise = attachLoadListener(script)
      document.head.appendChild(script)
    }
  }

  return googleMapsPromise
}

export function resetGoogleMapsLoaderForTests() {
  if (typeof window !== 'undefined' && !window.google?.maps) {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[${GOOGLE_SCRIPT_ATTRIBUTE}]`)
    if (existingScript && existingScript.parentNode) {
      existingScript.parentNode.removeChild(existingScript)
    }
  }
  googleMapsPromise = null
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    google?: any
  }
}

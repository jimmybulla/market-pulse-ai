// frontend/jest.setup.ts
import '@testing-library/jest-dom'

// Polyfill fetch for jsdom environment so jest.spyOn(global, 'fetch') works
if (typeof global.fetch === 'undefined') {
  global.fetch = (() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as unknown as typeof fetch
}

'use server'

import { revalidatePath } from 'next/cache'

const rawBackend = process.env.BACKEND_URL || 'http://localhost:8000'
const BACKEND = rawBackend.startsWith('http') ? rawBackend : `https://${rawBackend}`

export async function deleteSignalAction(id: string): Promise<void> {
  try {
    await fetch(`${BACKEND}/signals/${id}`, { method: 'DELETE' })
  } catch {
    // Silent fail — UI handles optimistic removal
  }
  // Unconditional: if the delete failed, revalidation restores the signal
  // in server state, correcting the optimistic client-side removal.
  revalidatePath('/')
}

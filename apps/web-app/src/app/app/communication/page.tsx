import { redirect } from 'next/navigation';

/**
 * ⭐ Yeshua Connect — Entry point.
 *
 * Redirects IMMEDIATELY (server-side, no client round-trip) to
 * /app/communication/messages where the WhatsApp-like chat lives.
 *
 * This is the route linked from the main sidebar entry
 *   { path: '/app/communication', label: 'Yeshua Connect' }
 *
 * The chat IS the module — no header, no tabs, no dashboard.
 */

export default function CommunicationPage() {
  redirect('/app/communication/messages');
}

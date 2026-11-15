/** Local-only demonstration: no server persistence or filesystem access. */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function disabled() {
  return Response.json({
    status: 'disabled',
    code: 'SERVER_SYNC_DISABLED',
    storage: 'device-only',
    message: 'Server sync is disabled for this demo. Save on this device and export a report as a backup.',
  }, { status: 501, headers: { 'Cache-Control': 'no-store' } });
}
export const GET = disabled;
export const POST = disabled;

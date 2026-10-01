import { androidAssetLinks, MOBILE_BUNDLE_ID, parseFingerprints } from '@/lib/mobileLinks';

export function GET() {
  const fingerprints = parseFingerprints(process.env.ANDROID_SHA256_CERT_FINGERPRINTS);
  if (fingerprints.length === 0) return new Response(null, { status: 404 });
  return Response.json(androidAssetLinks(MOBILE_BUNDLE_ID, fingerprints));
}

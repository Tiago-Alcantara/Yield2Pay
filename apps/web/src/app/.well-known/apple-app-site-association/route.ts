import { appleAppSiteAssociation, MOBILE_BUNDLE_ID } from '@/lib/mobileLinks';

export function GET() {
  const teamId = process.env.APPLE_TEAM_ID;
  if (!teamId) return new Response(null, { status: 404 });
  return Response.json(appleAppSiteAssociation(teamId, MOBILE_BUNDLE_ID));
}

export const MOBILE_BUNDLE_ID = 'com.yield2pay.app';

export function appleAppSiteAssociation(teamId: string, bundleId = MOBILE_BUNDLE_ID) {
  return {
    applinks: {
      apps: [] as string[],
      details: [
        {
          appIDs: [`${teamId}.${bundleId}`],
          components: [
            { '/': '/deposito*' },
            { '/': '/saque*' },
          ],
        },
      ],
    },
  };
}

export function androidAssetLinks(packageName: string, fingerprints: string[]) {
  return [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageName,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}

export function parseFingerprints(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

import { describe, expect, it } from 'vitest';
import { androidAssetLinks, appleAppSiteAssociation, parseFingerprints } from './mobileLinks';

describe('mobile app links', () => {
  it('publica os caminhos de depósito e saque para o app iOS', () => {
    const file = appleAppSiteAssociation('TEAM123');
    expect(file.applinks.details[0].appIDs).toEqual(['TEAM123.com.yield2pay.app']);
    expect(file.applinks.details[0].components).toEqual([{ '/': '/deposito*' }, { '/': '/saque*' }]);
  });

  it('separa as impressões do certificado Android', () => {
    expect(parseFingerprints(' AA:BB , CC:DD ')).toEqual(['AA:BB', 'CC:DD']);
    expect(androidAssetLinks('com.yield2pay.app', ['AA'])[0].target.sha256_cert_fingerprints).toEqual([
      'AA',
    ]);
  });
});

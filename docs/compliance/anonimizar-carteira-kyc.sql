-- Anonimiza carteira e KYC. Irreversível. Rodar só depois de backup,
-- com o produto financeiro desligado.
-- Decisão: docs/compliance/decisao-dados-carteira-kyc.md

BEGIN;

UPDATE wallets
SET stellar_address = 'anon-' || id
WHERE stellar_address NOT LIKE 'anon-%';

UPDATE etherfuse_customers
SET customer_id = 'anon-' || id,
    bank_account_id = NULL,
    wallet_id = NULL,
    kyc_status = 'redacted'
WHERE customer_id NOT LIKE 'anon-%';

UPDATE ramp_orders
SET deposit_clabe = NULL
WHERE deposit_clabe IS NOT NULL;

COMMIT;

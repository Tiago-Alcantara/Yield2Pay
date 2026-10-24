# Decisão: dados de carteira e KYC com o produto oculto

Data: 2026-10-24. Vale enquanto `FINANCIAL_PRODUCT_ENABLED` não for `true`.

## O que fazer

Anonimizar. Não apagar as linhas.

O endereço Stellar, o identificador de cliente da rampa, a conta bancária, o id da carteira na rampa e a CLABE identificam a pessoa. Com o cofre fora do ar, a Yield2Pay não tem finalidade para guardar isso (LGPD art. 6º, III).

Apagar a linha de `wallets` ou de `etherfuse_customers` quebra o vínculo com depósitos, ordens e snapshots e some com o registro de que aquele tratamento existiu. O endereço na rede Stellar não sai da blockchain porque a linha some do banco.

A anonimização troca o endereço por `anon-` mais o id da linha, zera os identificadores da rampa e a CLABE, e marca o KYC como `redacted`. A operação está em `anonimizar-carteira-kyc.sql`. Ela não roda sozinha: exige backup e execução manual no banco.

## Menores em /family

Bloquear menores no cadastro. Guardar só "maior de 18 = sim". Não criar fluxo de consentimento dos pais nesta versão.

O fluxo parental pede dados do responsável, além do necessário, e /family hoje não se apresenta como serviço para criança. Se um advogado concluir que a área é usada por menores, o art. 14 da LGPD passa a exigir o consentimento específico de um dos pais — aí o fluxo entra. Até lá, o cadastro não segue sem o booleano de maioridade. O campo ainda não está na tela: o onboarding atual só redireciona para o painel.

## Fora desta decisão

Confirmar com advogado se, sem o produto, a Yield2Pay fica fora da Resolução BCB 520/2025. O conteúdo educativo continua sujeito à CVM Resolução 20/2021: não é recomendação de investimento.

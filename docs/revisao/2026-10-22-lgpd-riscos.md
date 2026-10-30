# Revisão de riscos legais: LGPD, cookies e publicidade (2026-10-22)

Revisão técnica feita pela leitura do código (`apps/web` e `apps/api`). Não é parecer jurídico: os itens críticos devem ser validados por um advogado de proteção de dados antes do lançamento.

## 🔴 Crítico

| # | Onde | Problema | Base legal | Correção |
|---|---|---|---|---|
| 1 | `app/page.tsx` (rodapé), `login/page.tsx`, `configuracoes/PrivacySection.tsx` | **Não existe Política de Privacidade nem Termos de Uso.** Os links apontam para `#`, `#termos` e `#privacidade`, mas o login diz "Ao continuar, você concorda com nossos Termos e Política de Privacidade" | LGPD art. 6º VI e art. 9º (transparência); CDC art. 46 (cláusula que o consumidor não pôde conhecer não o obriga) | Escrever e publicar `/privacidade` e `/termos`, e linkar no rodapé, no login e no onboarding |
| 2 | `PrivacySection.tsx` | O botão **"Baixar meus dados" é falso**: mostra "enviamos por e-mail ✓" e não faz nada | LGPD art. 18 II e V (acesso e portabilidade) e art. 19; CDC art. 37 (informação enganosa) | Endpoint real de exportação (JSON) ou texto honesto com canal de pedido e prazo de 15 dias |
| 3 | `PrivacySection.tsx` e backend | **A exclusão de conta também é falsa.** Sem saldo, "Confirmar exclusão" não faz nada. A API não tem rota de exclusão (`POST /account/data` só apaga gastos e aulas). Ficam no banco: nome, e-mail, extratos, vínculo com a família, carteira e dados da Etherfuse | LGPD art. 18 VI (eliminação) e art. 16 | Rota `DELETE /account` que apaga ou anonimiza tudo, mantendo só o exigido por lei (registros de transação financeira), e informar na política o que é retido e por quanto tempo |
| 4 | Landing `app/page.tsx` | Publicidade de rendimento: "+8,4% / ano", "Investimos seu capital", "rendimento estável", "Sem custo do seu bolso", "Suas assinaturas são pagas pelo rendimento", sem aviso de risco nem de que a rentabilidade não é garantida. A área da família já traz esse aviso; a landing não. O `DEMO_YIELD_BPS` (`ledger.service.ts`) injeta rendimento sintético: se ficar ligado em produção, o usuário vê dinheiro que não existe | CDC arts. 30, 31 e 37 (oferta vinculante, publicidade enganosa); regras da CVM sobre oferta de investimento e da Lei 14.478/2022 (criptoativos) | Aviso de risco junto de todo número de rendimento ("estimativa, não garantida, pode ser zero"); travar `DEMO_YIELD_BPS = 0` em produção na validação do `env.ts`; validar o enquadramento regulatório com um advogado |

## 🟠 Alto

| # | Onde | Problema | Base legal | Correção |
|---|---|---|---|---|
| 5 | `api/src/auth/auth.guard.ts`, `all-exceptions.filter.ts` | Logs com prefixo do token de login em toda requisição. O filtro de erro loga a exceção inteira, que pode conter e-mail, nome ou dados de extrato | LGPD art. 46 (segurança) e art. 6º III (necessidade) | Remover o log do token; filtrar campos pessoais nos logs; definir retenção dos logs |
| 6 | `family/_lib/familyStore.ts` | O `localStorage` guarda nome, e-mail, telefone, CPF mascarado, chave PIX e endereço da carteira em texto puro, sem expiração, e nada é limpo no logout | LGPD art. 46 (segurança); princípio da necessidade | Não guardar dados pessoais no navegador (buscar da API) ou limpar no logout; nunca guardar CPF ou chave PIX |
| 7 | Extratos (`statements/`) | Extratos bancários completos (estabelecimentos, valores, datas) ficam guardados sem prazo. Não são "dado sensível" do art. 5º II, mas revelam hábitos, saúde (farmácia, clínica) e religião (dízimo). E são visíveis para toda a família | LGPD art. 6º III (necessidade), art. 15 (término do tratamento), art. 46 | Política de retenção; avisar no upload que a família inteira verá os gastos; avaliar descartar o arquivo bruto e manter só as linhas |
| 8 | Fornecedores: Privy (EUA), Etherfuse (México/EUA), Vercel, provedor do banco | **Transferência internacional de dados** sem nenhuma informação ao titular | LGPD arts. 33 a 36 e Resolução CD/ANPD nº 19/2024 | Listar os operadores e os países na política; cláusulas contratuais padrão da ANPD com cada um |
| 9 | Projeto todo | Não há **Encarregado (DPO)** nem canal para o titular | LGPD art. 41 | Nomear o encarregado e publicar nome e contato na política (agentes de pequeno porte podem só ter um canal, conforme Res. CD/ANPD nº 2/2022) |

## 🟡 Médio

| # | Onde | Problema | Correção |
|---|---|---|---|
| 10 | Convites (`household.service.invite`) | E-mail de terceiro é guardado sem prazo, mesmo depois de revogado ou recusado | Apagar convites expirados ou revogados depois de X dias; citar na política |
| 11 | Saída ou remoção de membro | Os gastos de quem sai continuam visíveis para a família, com o nome da pessoa | Na saída, perguntar se apaga ou anonimiza os lançamentos |
| 12 | `auth.guard.ts` | O e-mail é buscado no Privy e regravado no banco a cada requisição, mesmo sem necessidade | Buscar só no login e no cadastro |
| 13 | Termos | Não há restrição de idade. Produto financeiro e cripto oferecido a menores de idade | Termo exigindo 18 anos ou mais; dados de criança e adolescente seguem o art. 14 |
| 14 | `ProfileSection.tsx` | Mostra um campo de CPF (mock) sem dizer para que serve | Se for coletado, informar a finalidade (ex.: KYC exigido pela Etherfuse) e a base legal |
| 15 | Tela de erro (`TechnicalPanel`) | Detalhes técnicos aparecem fora de produção | Garantir `APP_ENV=production` no deploy |

## 🟢 Baixo / ok

- **Cookies:** não há Google Analytics, Meta Pixel, Hotjar nem nenhum rastreador. As fontes do `next/font/google` são servidas pelo próprio site (o Google não recebe IP). Só existe o armazenamento do login do Privy e preferências no `localStorage`, que são **estritamente necessários**. **Não é preciso banner de consentimento**, mas o Guia de Cookies da ANPD (2022) pede que estejam listados na política (nome, finalidade, duração). Se um dia entrar analytics, aí sim é preciso banner com opção de recusar.
- O texto da área da família sobre rendimento variável já está bom; falta levar o mesmo aviso para a landing.

## Ordem sugerida

1. Publicar Política de Privacidade e Termos (itens 1, 8, 9 e 13 entram no texto).
2. Tornar reais a exportação e a exclusão de dados (2, 3), ou trocar por um canal de pedido honesto.
3. Avisos de risco na landing e trava do demo yield (4).
4. Logs e `localStorage` (5, 6).
5. Retenção de extratos, convites e saída de membro (7, 10, 11).

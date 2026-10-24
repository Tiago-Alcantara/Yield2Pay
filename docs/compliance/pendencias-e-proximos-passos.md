# Yield2Pay — o que falta e os próximos passos

Data: 24 de outubro de 2026.

Esta nota descreve a versão que pode ir para a internet agora, sem anúncio, e o que continua pendente do roteiro de conformidade (LGPD, CVM e segurança). Não é parecer jurídico.

## Esta versão

Nome interno: versão educativa quieta.

O produto financeiro nasce desligado. As flags `FINANCIAL_PRODUCT_ENABLED` e `NEXT_PUBLIC_FINANCIAL_PRODUCT` ficam fora, ou em `false`. A imagem Docker do site e da API grava esse padrão. Religar o cofre exige as duas flags em `true` e um build novo do site.

Entra no ar:

- Painel de gastos da casa, aulas 1 a 6, conceitos (carteira e moeda estável) e o FAQ.
- Aviso fixo em `/aprender`, `/conceitos` e no topo de cada aula: conteúdo educativo, sem recomendação de investimento, sem produto de investimento nesta versão.
- Frase de risco nas aulas 1, 3, 4 e 5 (paridade, perda da chave, transação irreversível).
- Descrição do site sem "fixed-income yield on USDC".

Fica de fora, com 404 no servidor e na API:

- Painel B2B, depósito, saque e a seção Carteira.
- Módulos vault, wallet, deposit, withdraw, ramp, stellar e ledger.
- Criação de carteira no login.
- Aula 7 (vault da DeFindex), links e arquivos.

O domínio já existe. Esta subida atualiza `https://yield2pay.com`, `https://www.yield2pay.com` e `https://api.yield2pay.com`. Não há post, nota de lançamento pública nem mudança no README dizendo que o site está no ar. O Coolify publica a branch `main`.

Ainda aparece na home a calculadora e o texto de rendimento pagando assinaturas. Isso é pendência consciente desta versão, não um anúncio novo.

## Antes de considerar a subida encerrada

1. Confirmar no Coolify que `FINANCIAL_PRODUCT_ENABLED` não está `true` na API nem no build do site.
2. A API em produção precisa de `APP_ENV=production`. A imagem já define isso. Se o painel sobrescrever com outro valor, o corpo de erro volta a mostrar detalhe técnico.
3. Sem `CORS_ORIGIN`, a API em produção só aceita `https://yield2pay.com` e `https://www.yield2pay.com`.
4. O container da API roda `prisma migrate deploy` na subida. As migrações novas de casa, aula e onboarding entram nesse passo. Fazer backup do Postgres antes.
5. Não rodar `docs/compliance/anonimizar-carteira-kyc.sql` nesta subida. A decisão está tomada (anonimizar, não apagar), mas a execução pede backup e uma janela separada.
6. Não divulgar a URL, não avisar a lista de espera e não descrever a home como lançamento.

## O que já ficou decidido e ainda não está na tela

| Tema | Decisão | O que falta |
|---|---|---|
| Carteira e KYC já gravados | Anonimizar, não apagar as linhas | Rodar o SQL depois do backup |
| Menores em `/family` | Bloquear no cadastro e guardar só "maior de 18 = sim" | A caixa ainda não existe. O onboarding só manda a pessoa ao painel |
| Encarregado (DPO) | Opcional para pequeno porte, recomendado | Nomear a pessoa e publicar o canal |
| BCB 520/2025 | Provável que esta versão saia do escopo, sem o produto | Confirmar com advogado |
| CVM Resolução 20/2021 | Educação não pode ser recomendação | Revisão do texto que ainda promete rendimento |

## Pendências, na ordem em que devem ser feitas

### 1. Conteúdo que ainda vende o produto

A busca por vault, DeFindex, rendimento, depósito, saque, yield e USDC ainda acha promessa de produto, não só educação genérica.

- Home da família e home B2B: a calculadora e frases do tipo "o rendimento paga suas assinaturas".
- FAQ de conceitos: depósito, cofre, saque por PIX e "a Yield2Pay organiza os pagamentos".
- Textos de configuração, PIX e notificações que falam do saque e da carteira do produto.
- README ainda descreve o cofre. Não entra no site, mas não deve ser o texto de divulgação.

Critério: com a flag desligada, o que o visitante lê não diz "na Yield2Pay o seu dinheiro rende".

### 2. Educação, riscos e acessibilidade

- Manter educação. Nada de "compre X", "use a exchange Y" ou comparação de retorno entre ativos.
- Conferir se os fatos das aulas 1 a 6 estão corretos e atuais.
- Imagens e SVGs de `public/aulas-cripto/img`: autoria própria ou licença. Isso entra no item de direitos autorais.
- Legendas `.vtt` das aulas 1 a 6 já existem. Falta revisar se cobrem o vídeo inteiro e se o texto alternativo das imagens é útil.
- O player usa arquivo de vídeo (jsDelivr ou storage próprio), não YouTube. O jsDelivr é fornecedor fora do Brasil e precisa entrar na lista de transferência internacional. O banner de cookies ainda não segura esse carregamento.

### 3. Menores

Implementar o booleano "maior de 18 = sim" antes de gravar a casa. Sem data de nascimento e sem fluxo de pai ou mãe, até um advogado dizer que `/family` é usado por criança.

### 4. Banner de cookies (Guia da ANPD)

O texto original deste item não veio no roteiro. O que já está definido:

- "Rejeitar não necessários" com o mesmo destaque de "aceitar", no primeiro e no segundo nível.
- Cookies não necessários desligados por padrão, consentimento por categoria.
- Analytics e pixels só depois do sim.
- Proibido banner com um único "ok" e caixas já marcadas.

### 5. Política, termos e transferência internacional

- Política (LGPD art. 9º): incluir o progresso das aulas (`LessonProgress`). Base legal: execução de contrato (art. 7º, V). Dizer por quanto tempo guarda.
- Contato do encarregado ou canal do titular. Acesso, correção e exclusão (art. 18). Resposta em até 15 dias.
- Lista de cookies por categoria: necessários, analytics, marketing.
- Fornecedores fora do Brasil: hospedagem, e-mail, analytics, vídeo (jsDelivr ou storage).
- Página em português da transferência internacional: destino, finalidade, contatos e direitos (Resolução CD/ANPD 19/2024, art. 17).
- Termos: cláusula de que o conteúdo educativo não é consultoria financeira.

### 6. LGPD operacional

O texto corrido original deste bloco não veio no roteiro. O que já está definido:

- Inventário: cada campo de formulário e de banco com finalidade e base legal. O que não tiver finalidade sai. Ferramenta citada: `goul4rt/lgpd-skills`, com commit fixado.
- Registro simplificado das operações de tratamento (art. 37; Resolução CD/ANPD 2/2022, art. 9º).
- Logs sem CPF e sem IP completo. Analytics com IP truncado.
- Prazo de retenção e rotina de exclusão por tipo de dado. Ao encerrar a conta, apagar ou anonimizar.
- Cláusulas-padrão da ANPD com fornecedores fora do Brasil (Resolução 19/2024). O prazo regulamentar citado venceu em 23/08/2025.
- Plano de incidente: avisar a ANPD e os usuários em até 3 dias úteis (Resolução CD/ANPD 15/2024).

### 7. Acessibilidade, direitos autorais e avaliações

Estes três itens chegaram só como "[colar aqui o texto original]". Não dá para fechá-los sem esse texto. O que já se sabe:

- Acessibilidade das aulas: legenda ou transcrição, e `alt` útil em `img/`.
- Direitos autorais: inclui a checagem das imagens e SVGs das aulas.
- Avaliações falsas: o critério original não está neste repositório. Não publicar depoimento inventado.

### 8. Segurança

- Rodar `cloudflare/security-audit-skill` no commit `c1c8a8c` sobre o código do app. Ainda não rodou.
- No painel da Cloudflare: HSTS e TLS, WAF gerenciado, APIs sem autenticação, MFA das contas e DNS pendurado.
- Esta nota não substitui essa auditoria.

### 9. Validação jurídica

Perguntas para o advogado, sem resposta neste repositório:

- (a) A Yield2Pay é agente de pequeno porte ou faz tratamento de alto risco (Resolução CD/ANPD 2/2022, arts. 3º e 4º)?
- (b) Com o produto oculto, ela fica fora da Resolução BCB 520/2025?
- (c) O conteúdo educativo respeita a CVM Resolução 20/2021?

Indicar o encarregado. É opcional para pequeno porte e recomendado.

## Ordem sugerida daqui para a frente

1. Subir esta versão quieta e conferir 404, aulas e painel de gastos no domínio, sem anunciar.
2. Trocar a home e o FAQ para educação, sem promessa de ganho.
3. Caixa "maior de 18".
4. Banner de cookies e o carregamento do vídeo.
5. Política, termos e página de transferência internacional.
6. Inventário, retenção, logs e plano de incidente.
7. Auditoria de segurança e o painel da Cloudflare.
8. Validação jurídica e, só então, a decisão de divulgar.

Documentos já escritos: `decisao-dados-carteira-kyc.md` e `anonimizar-carteira-kyc.sql`.

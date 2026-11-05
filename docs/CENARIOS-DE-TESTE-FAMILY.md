# Cenários de teste — Yield2Pay Família

Roteiro manual para percorrer o site da família e ver se alguma tela quebra.
Cada cenário tem o que fazer e o que deve acontecer. Marque **ok**, **falhou** ou **não testado** na coluna de resultado.

Este documento cobre só a vertical de famílias. Não inclui o B2B e não inclui nada que mexa com blockchain, cofre, carteira, depósito ou saque.

## Como usar

1. Use o site publicado ou o ambiente local já no ar. Anote a URL no topo da folha de resultado.
2. Use uma conta Google, a **Conta A**, para criar a casa. A **Conta B** só entra nos cenários de membro. O site ainda não deixa a pessoa convidada aceitar o convite pela tela, então esses cenários ficam como não testados até existir uma segunda conta no mesmo grupo.
3. Faça os cenários na ordem dos módulos. Os primeiros deixam a casa pronta para o resto.
4. Datas e “hoje” seguem o fuso de São Paulo. Um lançamento de amanhã não entra no total do dia.
5. Quando o cenário disser “recarregue”, use o recarregar do navegador na mesma URL.
6. Se a API não responder, o painel deve avisar em cerca de 8 segundos e oferecer **Tentar de novo**. Isso não é travamento silencioso.
7. Largura de celular: cerca de 390 px. Largura de desktop: 1280 px ou mais.

### O que fica de fora

Não execute e não registre como falha destes cenários:

| Fora do roteiro | Por quê |
|---|---|
| `/b2b`, `/b2b/dashboard`, `/b2b/deposit`, `/b2b/withdraw` | Produto B2B, ainda não entra neste roteiro |
| `/deposito`, `/saque`, `/deposit`, `/withdraw` | Produto financeiro. Com ele desligado, a página não deve existir |
| Configurações → Carteira, PIX e pagamentos, Assinaturas | Chave, cofre, cobertura por rendimento |
| `/dashboard/alguma-assinatura` | Detalhe de cobertura por rendimento |
| `/conceitos` | Texto sobre carteira e moeda estável |
| Qualquer QR Code, PIX real, USDC, Stellar ou assinatura de transação | Blockchain |

Se um botão dessas áreas aparecer no meio de um fluxo da família, anote o caminho e pare. Não siga o fluxo financeiro para “ver o que acontece”.

### O que é de verdade e o que é só neste navegador

| Lugar | O que esperar |
|---|---|
| Painel, gastos, importação, convite, conta, aulas | Gravado na API. Recarregar e trocar de aparelho mantém o dado |
| Tema em Aparência | Gravado neste navegador (`y2p-tema`) |
| Landing: idioma, calculadora e lista de espera | Só nesta aba. A lista de espera **não envia** o e-mail a lugar nenhum |
| Configurações → Perfil, Acesso e segurança, Notificações, Privacidade | Em grande parte só neste navegador. O nome que o grupo vê está na **Conta**, não nesse Perfil |

O nome de exemplo “Ana & Pedro” na tela de Configurações → Perfil **não** é a conta logada. O nome real está no modal **Sua conta**.

---

## Preparação

| ID | O que conferir antes de começar | Resultado esperado |
|---|---|---|
| P-01 | Abra `/` sem estar logado | A landing abre. Não pede Google |
| P-02 | Abra `/dashboard` sem estar logado | Vai para `/login?next=%2Fdashboard` (ou equivalente com `next` interno) |
| P-03 | Abra `/b2b` | **Não teste.** Se cair nessa página, volte. Ela não faz parte deste roteiro |
| P-04 | Tenha um arquivo `.ofx`, um `.csv` e um `.pdf` de extrato, cada um com menos de 5 MB, e um arquivo maior que 5 MB | Os três primeiros serão usados em Importação. O grande deve ser recusado |

CSV mínimo que o leitor aceita (salve como `gastos.csv`):

```csv
data,descricao,valor
12/10/2026,Supermercado Dia,10.00
```

---

## 1. Landing (`/`)

A landing é pública. A calculadora é uma simulação nesta aba. Ela não deposita e não fala com a rede.

### 1.1 Cabeçalho e idioma

| ID | Passos | Resultado esperado |
|---|---|---|
| L-01 | Abra `/`. Role até o fim e volte ao topo | Cabeçalho gruda no topo. Marca, links e seletor de idioma continuam visíveis. Nada sobrepõe o texto |
| L-02 | No desktop, clique em calculadora, como funciona e começar. No celular, só o botão de começar fica no cabeçalho | Cada link desce até a seção e a URL ganha o `#`. No celular, calculadora e como funciona somem do cabeçalho de propósito |
| L-03 | Troque o idioma para English e volte para Português | Títulos, botões e a calculadora mudam de língua. Não mistura frase em inglês no meio do português, e o contrário |
| L-04 | Com English selecionado, recarregue `/` | O idioma escolhido continua (fica neste navegador) |

### 1.2 Calculadora (simulação local)

| ID | Passos | Resultado esperado |
|---|---|---|
| L-05 | Na calculadora, desmarque todas as assinaturas e deixe “outras” vazio | A mensagem de liberdade vazia aparece. Não mostra porcentagem quebrada nem `NaN` |
| L-06 | Marque Netflix, Spotify e inglês (o padrão). Não mude o depósito | Os três entram na soma mensal. A barra e o percentual batem com a soma (não passam de 100%) |
| L-07 | Desmarque uma assinatura e marque de novo | A soma, a barra e o “quanto falta” atualizam na hora |
| L-08 | Em “outras assinaturas”, digite `100` e depois `1.234,50` | O valor entra na mensalidade. Letras são ignoradas ou não quebram o cálculo |
| L-09 | Mude o depósito no controle e troque o cenário entre 6%, 8% e 10% a.a. | Rendimento do mês, percentual e depósito necessário mudam. 10% cobre mais que 6% com o mesmo depósito |
| L-10 | Leia a nota embaixo da calculadora | Deixa claro que é simulação, não promessa de resultado |

### 1.3 Lista de espera

| ID | Passos | Resultado esperado |
|---|---|---|
| L-11 | Envie o formulário com o campo vazio, depois com `ana` e com `ana@` | Não envia. Mostra o pedido de e-mail válido |
| L-12 | Envie `ana@casa.com` | Mostra o estado de enviado. Não abre outra página e não pede login |
| L-13 | Recarregue a página | O “enviado” some. O e-mail não ficou guardado no servidor |

### 1.4 Entrar no app

| ID | Passos | Resultado esperado |
|---|---|---|
| L-14 | No rodapé, use “Já tenho conta — entrar” | Abre `/login?next=/dashboard` |
| L-15 | Na landing em inglês, o mesmo link | O login abre. O destino continua sendo o painel |

---

## 2. Login e sessão (`/login`)

O login da família é só com Google. Não há e-mail e senha.

| ID | Passos | Resultado esperado |
|---|---|---|
| S-01 | Abra `/login` | Título e texto falam dos gastos da casa, não do caixa da empresa. Botão “Continuar com Google” |
| S-02 | Troque PT/EN no seletor | Textos do painel de login mudam. O botão do Google continua clicável |
| S-03 | Clique em “Continuar com Google” e conclua com a Conta A | Volta logado e cai em `/dashboard`. Não fica preso em “Redirecionando…” |
| S-04 | Já logado, abra `/login` de novo | Sai da tela de login sozinho e vai ao painel |
| S-05 | Saia da conta (cenário C-27). Abra `/dashboard`, `/aprender`, `/conta` e `/configuracoes` | Cada uma manda para `/login?next=` com o caminho que você tentou. `/` continua pública |
| S-06 | Na tela de login, troque o `next` da URL para `https://example.com` e também para `//example.com`. Entre | Depois do Google, o destino é `/dashboard`. Não abre site externo |
| S-07 | Coloque `next=/aprender`, entre com a Conta A | Cai em `/aprender`, não no painel |
| S-08 | Corte a rede e clique em “Continuar com Google” (ou cancele o Google) | Aparece o erro para tentar de novo. A página não fica em branco |

---

## 3. Primeiro acesso

`/onboarding` só redireciona para `/dashboard`. O primeiro acesso de verdade acontece no painel.

Use uma Conta A que **ainda não tenha casa**. Se já tiver, pule para o módulo 4 e use o cenário O-08 para refazer o questionário.

### 3.1 Nome do grupo

| ID | Passos | Resultado esperado |
|---|---|---|
| O-01 | Entre com a Conta A nova | A tela pede “Como se chama este grupo?”. Não mostra a lista de gastos ainda |
| O-02 | Deixe o nome em branco ou só com espaços | “Continuar” fica desabilitado |
| O-03 | Digite `Casa teste` e continue | O grupo é criado. Em seguida abre o questionário de boas-vindas |
| O-04 | Recarregue no meio do questionário, antes de concluir | Não perde a casa. O questionário volta se ainda não foi concluído |

### 3.2 Questionário

O questionário tem nome, objetivo, forma de trazer gastos e familiaridade. A pergunta extra de experiência só aparece se você marcar “Já comprei” ou “Uso com frequência”. Ela só escolhe a trilha de aulas. Não ligue carteira nenhuma.

| ID | Passos | Resultado esperado |
|---|---|---|
| O-05 | No nome, digite uma letra só | “Continuar” fica desabilitado. Com 2 letras ou mais, habilita |
| O-06 | Preencha nome `Maria Silva` e apelido `Mari`. Aperte Enter em cada campo | Avança. A pergunta seguinte cumprimenta “Mari”. Se o apelido ficar vazio, usa “Maria” |
| O-07 | Nome com mais de 32 caracteres e apelido com mais de 24 | O campo corta no limite. Não estoura o layout |
| O-08 | Não marque nenhum objetivo | “Continuar” desabilitado. Com um ou mais, habilita. Dá para marcar e desmarcar |
| O-09 | Não escolha a forma de importação | “Continuar” desabilitado. Escolha uma: extrato, nota ou manual |
| O-10 | Em familiaridade, escolha “Nunca mexi” | Não aparece a pergunta “O que você já fez com cripto?”. O botão vira “Ver meu painel” |
| O-11 | Volte até o nome e avance de novo | As respostas anteriores continuam marcadas |
| O-12 | Use “Pular por agora” | Vai direto para a tela “Tudo pronto”, sem obrigar o restante |
| O-13 | Na tela final, desligue e ligue “Liberdade financeira” e “Grupo familiar”. Deixe a trilha de aulas como quiser. Confirme | Salva e abre o painel. O cumprimento usa o apelido. Se a liberdade ficou ligada, o cartão Liberdade aparece. Se o grupo ficou ligado e você é admin, o convite aparece no fim do painel |
| O-14 | Ainda na tela final, use “Refazer perguntas”. Volte até a familiaridade e marque “Já comprei” | Surge a pergunta “O que você já fez com cripto?”. Dá para não marcar nenhuma ação e mesmo assim concluir. O painel abre. Não há como reabrir este questionário depois que ele já foi salvo |
| O-15 | Na tela final, corte a rede e confirme | Mensagem “Não foi possível salvar. Tente de novo.” O botão volta a funcionar. Nada é marcado como concluído até salvar |
| O-16 | Na tela final, ignore os cartões “Cripto no painel”, “Reserva em dólar digital” e “Carteira própria” | Eles não fazem parte deste roteiro. Não clique em nada que peça endereço ou chave |

Objetivos e o que eles ligam por padrão (dá para mudar na tela final):

| Objetivo marcado | Efeito no painel |
|---|---|
| Construir uma reserva | Liberdade financeira ligada |
| Dividir com a família | Convite do grupo ligado |
| Entender cripto ou Acompanhar minhas criptos | Trilha de aulas ligada |
| Nenhum objetivo de reserva | Liberdade começa desligada, a menos que você ligue na tela final |

---

## 4. Painel (`/dashboard`)

Entre com a Conta A, casa já criada e questionário concluído.

### 4.1 Carga

| ID | Passos | Resultado esperado |
|---|---|---|
| D-01 | Abra `/dashboard` | “Olá,” mais o nome. Mês atual em São Paulo. Cartão de gasto, e Liberdade se estiver ligada |
| D-02 | Casa sem nenhum gasto | Totais em zero ou “—”. Texto de lista sem quebrar (“0 gastos”). Gráficos não mostram `NaN` |
| D-03 | Recarregue | Os mesmos gastos e o mesmo mês voltam |
| D-04 | Simule a API fora (rede off-line ou API parada) e abra o painel | Em cerca de 8 segundos: “Não foi possível carregar os gastos.” e botão **Tentar de novo**. A página não fica em branco |
| D-05 | Religue a rede e clique em **Tentar de novo** | Os números voltam. O aviso de erro some |

### 4.2 Mês

| ID | Passos | Resultado esperado |
|---|---|---|
| D-06 | No seletor de mês, vá para o mês passado e para o mês que vem | O título “Gastos de …” muda. Mês futuro diz que ainda não começou e a sobra prevista fica “—” |
| D-07 | No mês atual, compare o rótulo | “Gasto até dia N” (N = dia de hoje em São Paulo), não “Gasto em [mês]” como se o mês tivesse fechado |
| D-08 | Com gastos em dois meses, alterne | Cada mês mostra os seus lançamentos. Voltar ao mês anterior não mistura linhas |
| D-09 | Mês atual com um lançamento de data futura (importe ou lance com data de amanhã se o campo permitir; o manual bloqueia data futura) | A linha futura não entra no total de hoje. A lista avisa quantos lançamentos futuros ficaram de fora |

### 4.3 Cartões

| ID | Passos | Resultado esperado |
|---|---|---|
| D-10 | Com renda informada no perfil da casa | “Sobra prevista” (mês atual) ou “Sobrou no mês” (mês fechado) = renda − gastos do recorte. Sem renda, o valor é “—” e o texto diz que a renda não foi informada |
| D-11 | Com dois meses fechados | “Gasto médio” usa meses fechados. O mês atual mostra a projeção, não trata o mês incompleto como mês fechado |
| D-12 | Com várias categorias | “Maior categoria” é a que mais somou, com valor e percentual do mês |
| D-13 | Aplique um filtro (módulo 6) | O cartão principal passa a dizer “Só o que o filtro mostra”. Categoria líder e total acompanham o recorte, não o mês inteiro |

---

## 5. Lista de gastos

Categorias: Mercado, Restaurante, Transporte, Casa, Saúde, Assinaturas, Outros.

| ID | Passos | Resultado esperado |
|---|---|---|
| G-01 | Com mais de 8 gastos no mês | A lista mostra 8 e o botão “Ver todos os N gastos”. Ao abrir, mostra o restante. “Mostrar menos” volta a 8 |
| G-02 | Clique no chip de uma categoria e de novo em “Todas” | A lista e a contagem (“N gastos · R$ …”) filtram. “Todas” restaura |
| G-03 | Troque a categoria de um gasto no seletor da linha | A linha muda na hora. Recarregue: a categoria nova permanece. O gráfico de categorias acompanha |
| G-04 | Clique uma vez na lixeira | O botão vira “Confirmar”. O gasto continua |
| G-05 | Clique em “Confirmar” | O gasto some da lista e sai dos totais. Recarregue: continua apagado |
| G-06 | Clique na lixeira e depois clique em outro lugar ou em outro gasto, sem confirmar | O primeiro não é apagado |
| G-07 | Gasto que se repete em meses (mesmo estabelecimento em extratos de meses diferentes) | A linha ganha a marca “fixo” |
| G-08 | Quem lançou | Embaixo do nome do estabelecimento aparece o nome de quem adicionou |

---

## 6. Filtros

Abra o painel de filtros pelo controle ao lado do mês.

| ID | Passos | Resultado esperado |
|---|---|---|
| F-01 | Abra e feche o painel sem aplicar (Escape, clique fora ou fechar) | A lista não muda |
| F-02 | Busque por parte do nome, com acento diferente e maiúscula diferente (`padaria` encontra `Padaria`) | A lista filtra. O chip da busca aparece |
| F-03 | Busca que não existe | Lista vazia ou “Mostrar” indisponível para o mês já carregado. Nenhum erro de tela |
| F-04 | Filtro de valor mínimo maior que o máximo | Mensagem “O mínimo está maior que o máximo.” Não aplica |
| F-05 | Valor negativo | Mensagem “O valor não pode ser negativo.” |
| F-06 | Mínimo só, máximo só, e a faixa dos dois | Chip “Acima de …”, “Até …” ou “R$ … a R$ …”. A lista respeita a faixa |
| F-07 | Tipo “Só fixos” e “Só variáveis” | Cada um mostra só o seu grupo. “Todos” volta ao conjunto |
| F-08 | Várias categorias no painel de filtros | Dá para combinar. Cada uma vira um chip. Tirar o chip tira só aquela categoria |
| F-09 | Período “Últimos 7 dias”, “30 dias” e “90 dias” | O intervalo de datas preenche. O título da lista vira “Gastos do período”. A contagem de dias aparece |
| F-10 | Datas invertidas (fim antes do início) | O período é entendido do dia menor para o maior. Não zera a tela |
| F-11 | Período sem as duas datas | Não deixa aplicar, ou pede as duas datas |
| F-12 | Período que atravessa mais de 36 meses | Aviso “Mostramos só os primeiros 36 meses deste período.” A tela não trava |
| F-13 | Limpe os chips um a um e limpe tudo | Cada chip remove o seu critério. No fim, a lista volta ao mês inteiro |
| F-14 | Aplique um filtro, troque de mês pela seta e volte | O filtro de categoria, texto, valor e tipo continua. O modo “mês” mostra o mês escolhido |

---

## 7. Gráficos

Os quatro modos: Categorias, Mês a mês, Ritmo do mês, Fixos × variáveis.

| ID | Passos | Resultado esperado |
|---|---|---|
| GR-01 | Troque os quatro modos | Cada um desenha. Não fica gráfico do modo anterior por baixo. Texto não estoura o cartão |
| GR-02 | Em Categorias, clique numa fatia ou numa linha | O painel filtra por essa categoria (o mesmo efeito do chip) |
| GR-03 | Em Mês a mês, clique numa barra de outro mês | O painel muda para aquele mês |
| GR-04 | Mês sem gastos | O gráfico mostra vazio ou zero, sem divisão por zero visível (`NaN`, `Infinity`) |
| GR-05 | Com filtro ativo (módulo 6) | Categorias e totais do gráfico seguem o recorte, não o mês cheio |
| GR-06 | Estreite a janela até o celular | O gráfico continua legível ou rola. Não cobre a doca nem some |

---

## 8. Importar e lançar gasto

Abra por **Importar extrato** no cartão, pelo botão de upload da doca (`/dashboard?acao=importar`) ou por **Novo gasto** (`/dashboard?acao=novo`, que abre já em Manual).

Feche com **Fechar**, Escape ou clique no fundo escuro. Enquanto o modal está aberto, a página atrás não rola.

### 8.1 Extrato (OFX, CSV, PDF)

| ID | Passos | Resultado esperado |
|---|---|---|
| I-01 | Arraste um `.ofx` válido e também use “Escolher arquivo” com `.csv` e `.pdf` | Cada um importa. O modal diz quantos gastos entraram. **Ver minhas contas** fecha e desce até a lista |
| I-02 | Use “Usar extrato de exemplo” | Entram os gastos de exemplo (mercado, restaurante, transporte, aluguel, Netflix, farmácia). Eles aparecem em outubro de 2026 |
| I-03 | Importe o mesmo arquivo de novo | “Esse extrato já foi importado.” Nada duplica na lista |
| I-04 | Arquivo que não é extrato (uma foto, um `.txt` vazio) | “Não conseguimos ler esse arquivo. Use OFX, CSV ou PDF exportado pelo banco.” |
| I-05 | Arquivo maior que 5 MB | Recusado. A lista não muda |
| I-06 | Extrato em que toda linha é entrada (crédito). No CSV, isso só vale se o mesmo arquivo também tiver algum débito | “Nenhum gasto novo nesse arquivo. Entradas de dinheiro não entram na lista.” Um CSV só com valores positivos, sem nenhum débito, entra como gasto |
| I-07 | CSV com uma linha sem valor | Essa linha é ignorada. As linhas válidas entram |
| I-08 | Depois de importar, clique em “Desfazer” no nome do arquivo | Os gastos daquele arquivo saem. Os lançados à mão permanecem |
| I-09 | Desfazer com a rede caída | “Não conseguimos desfazer essa importação. Os gastos continuam no painel.” |

### 8.2 Nota fiscal

A busca de nota, hoje, só reconhece a chave de exemplo. Chave real de supermercado ainda não consulta a receita.

| ID | Passos | Resultado esperado |
|---|---|---|
| I-10 | Digite letras e espaços na chave | Só ficam dígitos, agrupados de 4 em 4. O contador vai até 44. **Buscar nota** só habilita com 44 dígitos |
| I-11 | Com 44 dígitos que não são o exemplo, busque | “Não encontramos essa nota. Confira a chave ou use o exemplo.” |
| I-12 | “Usar uma chave de exemplo” e busque | Mostra Supermercado Bom Preço, 12/10/2026, R$ 187,40 |
| I-13 | Troque a categoria e clique em **Adicionar aos gastos** | O gasto entra na lista de outubro de 2026. A chave zera para lançar outra |
| I-14 | Adicione com a rede caída | “Não conseguimos adicionar essa nota agora.” O rascunho da nota continua na tela |

### 8.3 Manual

| ID | Passos | Resultado esperado |
|---|---|---|
| I-15 | **Adicionar gasto** com onde vazio, ou valor vazio, ou `0` | “Preencha onde e o valor.” Nada é criado |
| I-16 | Valor `10,50`, onde `Padaria`, data de hoje, categoria Mercado | Entra como R$ 10,50 na data de hoje. Os campos onde e valor limpam. A data permanece |
| I-17 | Valor `10.50` (ponto) e `1.234,56` | Os dois são lidos como dez reais e cinquenta centavos e como mil duzentos e trinta e quatro reais e cinquenta e seis centavos |
| I-18 | Data de amanhã | “Essa data ainda não chegou. Use hoje ou um dia que já passou.” |
| I-19 | Valor de R$ 100.000,00 ou mais | Primeiro clique avisa e o botão vira “Confirmar valor”. Segundo clique lança. Se editar o valor, volta a pedir confirmação |
| I-20 | Abra pelo atalho **Novo gasto** da doca | O modal abre já na aba Manual |

---

## 9. Liberdade da reserva

Isto é “quantos meses a reserva segura a casa”. Não é depósito em cofre.

| ID | Passos | Resultado esperado |
|---|---|---|
| LF-01 | Com liberdade ligada e meta e reserva preenchidas | O cartão mostra percentual, meses, barra, meta e quanto falta. Status: “Em andamento”, “Meta alcançada” (100% ou mais) ou “Meta em aberto” se não houver meta |
| LF-02 | Sem meta ou sem reserva | Percentual “—” e texto de meta em aberto. Não quebra o cartão ao lado |
| LF-03 | Desligue “Liberdade financeira” na Conta → Aulas | O cartão some. Na doca somem o item Liberdade e o atalho de meta |
| LF-04 | Ligue de novo | Cartão e atalhos voltam. Recarregue: a preferência continua |
| LF-05 | Passe o mouse ou foque o atalho de meta da doca | Leva a `/dashboard#s-liberdade` e o cartão fica na área visível |
| LF-06 | Se a API falhar ao salvar o interruptor | O interruptor volta ao estado anterior e avisa “Não foi possível atualizar a liberdade financeira” |

---

## 10. Convite no painel

Só o admin vê o formulário no fim do painel, e só se “Convite no painel” estiver ligado.

O convite fica na lista da casa como “Convite enviado”. O site ainda não tem tela nem e-mail com link para a outra pessoa aceitar. Sem uma segunda conta já dentro do mesmo grupo, marque CV-04, CV-05, C-15, C-21, C-22, C-24 e R-04 como **não testado**.

| ID | Passos | Resultado esperado |
|---|---|---|
| CV-01 | Como admin, envie o formulário vazio | “Informe o e-mail de quem vai entrar na casa.” |
| CV-02 | Envie `pessoa@casa.com` | “Convite enviado.” O campo limpa |
| CV-03 | Envie de novo o mesmo e-mail, e também um texto sem @ | No painel, os dois caem em “Não conseguimos enviar o convite.” Na Conta, e-mail inválido diz “Digite um e-mail válido.” e e-mail repetido diz “Esse e-mail já está no grupo.” O convite não duplica |
| CV-04 | Como membro (Conta B, depois do aceite), olhe o fim do painel | O formulário de convite não aparece |
| CV-05 | Como membro, abra `/dashboard?acao=convidar` | Aviso “Só quem administra a casa pode convidar.” O modal de convite não abre para o membro |
| CV-06 | Desligue “Convite no painel” na Conta → Grupo | O bloco de convite some do painel. Os convites já enviados continuam na aba Grupo |
| CV-07 | Admin clica no atalho de pessoas da doca | Abre o fluxo de convidar (`/dashboard?acao=convidar`) |

---

## 11. Conta e grupo

Abra pelo avatar do painel, por `/conta`, ou por `/dashboard?conta=1`. O menu da doca também tem “Minha conta”.

Abas: Perfil, Aulas, Grupo, Conta e dados.

| ID | Passos | Resultado esperado |
|---|---|---|
| C-01 | Abra a conta | Modal “Configurações”, começa em Perfil, com “Carregando…” e depois os dados. Fundo da página não rola |
| C-02 | Feche pelo X, pelo clique no escuro e pela tecla Escape | Fecha. Escape com um diálogo de confirmação aberto fecha só o diálogo, não a conta inteira |
| C-03 | Com a API fora | “Não foi possível carregar a conta.” Não mostra formulário vazio como se estivesse pronto |
| C-04 | Troque as quatro abas | Cada uma mostra o seu bloco. A aba atual fica marcada |

### 11.1 Perfil

| ID | Passos | Resultado esperado |
|---|---|---|
| C-05 | Apague o nome | “Informe um nome.” O botão Salvar não deve gravar vazio |
| C-06 | Mude o nome e clique em Salvar (ou Enter) | Toast “Nome atualizado”. O olá do painel e a doca usam o nome novo. Recarregue e confira |
| C-07 | Nome igual ao que já está salvo | Não mostra Salvar |
| C-08 | Mais de 32 caracteres | O campo corta em 32 |
| C-09 | Olhe o e-mail | É o e-mail do Google. Não há campo para editá-lo |

### 11.2 Aulas (preferências)

| ID | Passos | Resultado esperado |
|---|---|---|
| C-10 | Ligue e desligue a trilha. Com ela ligada, alterne “Do zero” e “Já conheço” | Toast de confirmação. No painel, o bloco de aulas muda de trilha, some ao desligar, e o botão “Tenho interesse” aparece quando está desligada |
| C-11 | Falha de rede no interruptor | Toast de erro. O interruptor não fica mentindo o estado salvo |

### 11.3 Grupo

Faça C-12 em diante com a Conta A como admin. Use a Conta B nos cenários de membro.

| ID | Passos | Resultado esperado |
|---|---|---|
| C-12 | Admin muda o nome do grupo e salva | Toast “Nome do grupo atualizado”. A doca mostra o nome novo |
| C-13 | Nome vazio | Não oferece Salvar |
| C-14 | Mais de 40 caracteres | Corta em 40 |
| C-15 | Membro abre a aba Grupo | Vê o nome, sem campo de edição. Texto diz que só o admin muda o nome |
| C-16 | Se um membro conseguir disparar a troca (outra aba antiga) | Toast “Só o admin muda o nome do grupo”. O nome não muda |
| C-17 | Admin convida `b@casa.com` | A pessoa aparece como “Convite enviado”. Toast com o e-mail |
| C-18 | E-mail inválido (`b@`, `b casa.com`) | “Digite um e-mail válido.” |
| C-19 | E-mail de quem já está na lista, em outro caixa | “Esse e-mail já está no grupo.” |
| C-20 | Admin remove o convite (×) | A linha some. Toast de removido |
| C-21 | Com a Conta B já dentro do grupo, abra o painel | Vê os gastos da casa. O papel é Membro. Não vê botão de remover os outros. Não há, neste site, um botão de aceitar convite |
| C-22 | Admin remove o membro | A Conta B deixa de ver a casa. Os gastos dela deixam de aparecer para o grupo |
| C-23 | Admin, sozinho ou com outras pessoas, olha “Sair do grupo” | Não há botão. Sozinho, o texto diz que a saída deixaria o grupo sem admin. Com outras pessoas, o texto diz que o admin não sai enquanto houver outras pessoas |
| C-24 | Membro clica em “Sair do grupo”, cancela, e depois confirma | Cancelar fica no grupo. Confirmar fecha a conta e a Conta B cai na tela de criar um grupo novo. A Conta A continua na casa original |
| C-25 | Lista de pessoas | “Você” no próprio nome. Papéis: Admin, Membro, Convite enviado. Contagem “1 pessoa” ou “N pessoas” |

### 11.4 Conta e dados

| ID | Passos | Resultado esperado |
|---|---|---|
| C-26 | Sair → Cancelar | Continua logado |
| C-27 | Sair → Sair | A sessão acaba. A próxima tela é o login. Abrir `/dashboard` pede Google de novo. Os dados da casa continuam para o próximo login da mesma conta |
| C-28 | Apagar gastos → digite `apagar` em minúsculas | O botão “Apagar para sempre” fica desabilitado. Só `APAGAR` em maiúsculas habilita |
| C-29 | Confirme com `APAGAR` | Toast “Gastos importados apagados”. A lista zera. A conta e o grupo continuam. Não há como desfazer |
| C-30 | Cancelar o diálogo de apagar | Os gastos continuam |

### 11.5 Menu da doca

| ID | Passos | Resultado esperado |
|---|---|---|
| C-31 | Abra o menu do nome na doca | Mostra o grupo real, sem saldo. Clique fora, Escape ou Tab fecha |
| C-32 | Setas para cima e para baixo | O foco circula nos itens do menu |
| C-33 | “Configurações do grupo” e “Ver minha conta” | O primeiro abre o painel com a conta por cima (`/dashboard?conta=1`). O segundo abre `/conta` |
| C-34 | Nome do grupo com aspas ou sinal de menor no texto | O nome aparece como texto. Não vira botão extra nem imagem |

---

## 12. Aulas (`/aprender`)

A trilha é conteúdo e progresso. Concluir aulas não abre investimento e não pede carteira. Se a frase de trilha concluída aparecer, registre só se a tela quebrou. Não procure um produto de investimento em seguida.

Há duas trilhas: “Do zero” e “Já conheço”. O painel e a Conta escolhem qual.

| ID | Passos | Resultado esperado |
|---|---|---|
| A-01 | Com a trilha ligada, abra `/aprender` | Lista de aulas, progresso e aviso educativo no topo. Link “Painel da família” volta ao `/dashboard` |
| A-02 | Trilha desligada. No painel, clique em “Tenho interesse” | A trilha do zero liga. A lista de aulas aparece |
| A-03 | Abra a aula 1 | A leitura carrega. Se o vídeo não estiver no ar, a frase “O vídeo desta aula não está no ar…” aparece e o texto da aula continua embaixo. Isso não é falha da página |
| A-04 | Responda o teste com pelo menos um erro e marque como concluída | “Acerte todas as perguntas do teste para concluir esta aula.” A aula não entra como concluída |
| A-05 | Acerte todas e conclua | A aula marca concluída. O progresso “N de M” no painel sobe. Recarregue `/aprender`: continua concluída |
| A-06 | Feche a aula no meio da leitura e abra de novo | Volta na mesma aula. A posição lembrada não joga você para outra aula |
| A-07 | Use próxima e anterior entre as cenas ou aulas | Não passa do fim nem volta antes da primeira. O indicador da aula atual acompanha |
| A-08 | Conclua com a rede caída | “Não foi possível salvar o progresso. Tente de novo.” Ao religar, concluir de novo grava |
| A-09 | Desmarque uma aula concluída, cancele e depois confirme | Cancelar mantém concluída. Confirmar tira a marca. Se era a última, a mensagem de trilha concluída some |
| A-10 | No painel, “Começar aula 1”, “Continuar · aula N” e, com tudo feito, “Trilha concluída · recomeçar” | Cada botão abre a aula certa. Recomeçar tira as conclusões depois que a gravação funciona |
| A-11 | Troque para “Já conheço” na Conta | A lista de `/aprender` muda para a outra trilha. O progresso de uma não se confunde com o da outra |
| A-12 | API de aulas fora | “Não foi possível carregar as aulas.” e link de volta ao painel |
| A-13 | Pela doca, item Aprender, estando em `/conceitos` | O item Aprender fica ativo. **Não percorra o conteúdo de `/conceitos`.** Se a página abrir, volte pelo link do cabeçalho |

A doca não aparece em `/aprender`? Deve aparecer. Itens: Painel, Gastos (desce para `#s-gastos`), Liberdade (se ligada), Aprender.

---

## 13. Navegação, tema e configurações

### 13.1 Doca

A doca aparece em `/dashboard`, `/aprender`, `/conta` e `/configuracoes`. Não aparece na landing nem no login.

| ID | Passos | Resultado esperado |
|---|---|---|
| N-01 | Em cada tela logada acima, olhe a doca | Os itens cabem. O conteúdo não fica escondido atrás dela. Dá para rolar até o último bloco |
| N-02 | Painel, Gastos, Aprender | Painel abre `/dashboard`. Gastos desce até a lista. Aprender abre `/aprender` e fica marcado |
| N-03 | Em `/configuracoes` | Nenhum item da doca fica marcado como página atual |
| N-04 | Atalho de upload e o botão “Novo gasto” | Abrem o modal de importar. Novo gasto abre em Manual |
| N-05 | Celular (390 px) | A doca continua usável. O cabeçalho do painel empilha saudação e filtros. O avatar de configurações fica na saudação |

### 13.2 Tema

Em `/configuracoes`, seção Aparência. Temas escuros: Escuro, Meia-noite, Petróleo, Floresta, Espresso, Ameixa, Bordô, Oliva noite, Grafite quente, OLED, Ardósia. Claros: Cloud Dancer, Gelo, Sálvia, Zinco.

| ID | Passos | Resultado esperado |
|---|---|---|
| N-06 | Escolha um tema claro e um escuro | O fundo, os cartões e o texto mudam na hora. Toast “Tema … aplicado.” Some sozinho |
| N-07 | Vá ao painel, às aulas e à conta | O mesmo tema vale nas telas da família |
| N-08 | Recarregue e abra de novo | O tema continua |
| N-09 | Landing `/` e `/login` | Não herdam o tema colorido da área logada. Continuam com a aparência própria |
| N-10 | Tema claro no painel | Texto e valores continuam legíveis. Gráfico e chips não ficam brancos em fundo branco |

### 13.3 Configurações (`/configuracoes`)

A seção **Carteira** não deve aparecer enquanto o produto financeiro estiver desligado. Não abra PIX, Assinaturas nem qualquer link de saque. Essas partes estão fora do roteiro.

O que vale testar aqui é se a página abre e se Aparência (acima), Perfil visual, segurança visual, notificações e privacidade não quebram a tela. O nome e os gastos de verdade estão na Conta (módulo 11).

| ID | Passos | Resultado esperado |
|---|---|---|
| N-11 | Abra `/configuracoes` | Título Configurações. Menu: Perfil, Aparência, Acesso e segurança, PIX e pagamentos, Assinaturas, Notificações, Privacidade e dados. Sem Carteira |
| N-12 | Abra `/configuracoes#carteira` | Página não encontrada. Não mostra endereço de carteira |
| N-13 | Perfil: troque o nome da tela, envie e remova a “foto”, troque o idioma | A própria tela reflete a mudança. O “Olá” do painel **não** muda por causa desse nome. O idioma da landing acompanha o seletor |
| N-14 | Acesso e segurança: tente encerrar o aparelho atual e, em outro aparelho da lista, cancele e depois confirme | O aparelho atual não sai da lista. O outro pede confirmação e só então marca a sessão como encerrada **nesta tela** |
| N-15 | Notificações: desligue e ligue cada interruptor | O estado muda na hora. Recarregar mantém neste navegador. Não espere e-mail real |
| N-16 | Privacidade: clique em baixar dados | O rótulo do botão muda por uns segundos. Nenhum arquivo precisa baixar. Não clique no caminho de saque |
| N-17 | “Voltar ao painel” | Volta ao `/dashboard` |
| N-18 | No celular, o menu de seções | Vira faixa de chips. Dá para chegar em Aparência e em Privacidade sem cortar o rótulo no meio da palavra |

---

## 14. Regressão cruzada

Faça esta passagem no fim, com a casa já cheia de gastos.

| ID | Passos | Resultado esperado |
|---|---|---|
| R-01 | Desktop e celular: landing, login, painel, modal de importar, conta, aulas, configurações | Sem texto cortado, sem botão fora da tela, sem duas barras de rolagem horizontal |
| R-02 | Importe um extrato, lance um gasto manual, mude a categoria, apague um, convide, saia com a Conta B e entre de novo | Cada ação sobrevive a recarregar e a um novo login |
| R-03 | Duas abas da Conta A abertas. Apague um gasto numa aba e recarregue a outra | A segunda aba, depois de recarregar, não mostra o gasto apagado |
| R-04 | Conta A e Conta B no mesmo grupo. A lança um gasto | B vê o gasto e o nome de quem lançou, depois de recarregar |
| R-05 | Teclado: Tab na doca, no menu do grupo, no questionário e nos modais | O foco aparece. Escape fecha modal. Não há armadilha de foco que impeça sair |
| R-06 | Voltar do navegador a partir de uma aula, da conta e de configurações | Volta para a tela anterior. Não abre uma tela em branco |
| R-07 | URL `/dashboard?acao=importar`, `?acao=novo` e `?conta=1` coladas direto | Cada uma abre o modal certo uma vez. Recarregar não empilha vários modais |
| R-08 | Casa com muitos gastos (se conseguir passar de 100 mil linhas) | Aviso “Mostramos só as primeiras 100 mil despesas. O restante ficou de fora.” A lista que couber continua usável |

---

## Folha de resultado

Copie a tabela, uma linha por cenário que rodar.

| Data | Ambiente (URL) | Navegador | Conta | ID | ok / falhou | O que apareceu de diferente |
|---|---|---|---|---|---|---|
| | | | | | | |

Quando falhar, anote o caminho (por exemplo “Painel → Importar → CSV”) e a frase exata da tela. Não anote senha, código do Google nem conteúdo completo de extrato bancário.

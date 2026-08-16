/**
 * Dicionário das telas "Yield2Pay para famílias".
 *
 * PT é a cópia literal de design/nemPages/Yield2Pay Famílias*.dc.html; EN da
 * landing vem de "Yield2Pay Families EN.dc.html". As telas internas só existem
 * em PT no design — a versão EN aqui segue o mesmo tom e é o que a chave
 * "Idioma" das Configurações alterna.
 */

const pt = {
  brand: 'Yield2Pay',
  brandTag: 'Para famílias',
  langLabel: 'Idioma',

  landing: {
    navCalc: 'Calculadora',
    navHow: 'Como funciona',
    navCta: 'Entrar na lista',
    enterApp: 'Já tenho conta — entrar ›',

    heroEyebrow: 'Yield2Pay para famílias',
    heroTitle: 'O rendimento do seu próprio dinheiro paga suas assinaturas.',
    heroSub:
      'Você deposita uma quantia, ela continua sua, e o que ela rende cobre a Netflix, o Spotify, a escola de inglês. O principal fica parado, esperando o dia em que você quiser de volta.',
    heroCta1: 'Quero entrar na lista',
    heroCta2: 'Fazer as contas',
    heroSeals: ['Não-custodial', 'Saque quando quiser', 'Sem mensalidade'],
    heroCardLabel: 'Este mês',
    heroCardSub: 'pagos pelo rendimento do seu depósito',
    heroCardRows: ['Netflix', 'Spotify Família', 'Escola de inglês'],
    heroCardPaid: 'pago',
    heroCardNote: 'Exemplo ilustrativo',

    calcEyebrow: 'Calculadora',
    calcTitle: 'Seu percentual de liberdade',
    calcSub:
      'Marque o que sua casa assina hoje e veja quanto precisaria estar depositado para que o rendimento desse valor cobrisse a conta.',
    calcSubsLabel: 'Assinaturas da casa',
    calcExtraLabel: 'Outras assinaturas (R$ por mês)',
    calcDepositLabel: 'Quanto você já teria depositado',
    calcDepositAria: 'Valor depositado',
    calcScenarioLabel: 'Cenário da simulação',
    calcScenarioSuffix: '% a.a.',
    freedomLabel: 'Percentual de liberdade',
    freedomEmpty: 'Escolha ao menos uma assinatura para ver o cálculo.',
    freedomFull: 'Neste cenário, todas as suas assinaturas estariam cobertas.',
    freedomPartial:
      'das suas assinaturas seriam pagas pelo rendimento do que você já teria depositado.',
    rowMonthly: 'Suas assinaturas',
    rowCovered: 'Coberto no cenário',
    rowNeeded: 'Depósito para chegar a 100%',
    calcCta: 'Entrar na lista de espera',
    calcNote: 'Simulação com cenário escolhido por você. Não é promessa de resultado.',

    howEyebrow: 'Como funciona',
    howTitle: 'Três passos, uma vez só',
    howSteps: [
      {
        n: '01',
        title: 'Você abre sua carteira',
        desc: 'Leva alguns minutos. A carteira é sua: as chaves ficam com você, e a Yield2Pay nunca guarda o seu dinheiro.',
      },
      {
        n: '02',
        title: 'Deposita uma vez',
        desc: 'Por PIX, no valor que fizer sentido para a sua casa. O principal continua seu e você pode sacar quando quiser.',
      },
      {
        n: '03',
        title: 'As contas se pagam',
        desc: 'Você escolhe quais assinaturas entram. Todo mês, o rendimento gerado vai direto para elas, sem você mexer um dedo.',
      },
    ],

    behindEyebrow: 'Sem letras miúdas',
    behindTitle: 'O que está por trás',
    behindCards: [
      {
        kicker: 'Carteira',
        title: 'O dinheiro nunca sai das suas mãos',
        desc: 'Sua carteira é não-custodial: só você assina o que sai dela. A Yield2Pay é a ferramenta que organiza os pagamentos, não o cofre que guarda o seu saldo.',
      },
      {
        kicker: 'Stablecoin',
        title: 'Seu saldo em moeda estável',
        desc: 'O depósito fica em stablecoin lastreada em dólar — feita para andar colada à moeda, sem o sobe e desce do resto do mercado cripto. Você vê o valor em reais o tempo todo.',
      },
      {
        kicker: 'Rendimento',
        title: 'Só o que ele produz é gasto',
        desc: 'O saldo é alocado em protocolos abertos e auditados, que geram um rendimento variável — pode subir, pode cair, e não há garantia nenhuma. É esse rendimento, e só ele, que paga suas assinaturas. O principal continua intocado.',
      },
    ],

    ctaTitle: 'Comece pela lista de espera',
    ctaSub:
      'Avisamos você quando a sua vaga abrir. Sem cobrança, sem compromisso, e o seu e-mail não vai para lugar nenhum.',
    emailLabel: 'Seu e-mail',
    emailPlaceholder: 'voce@email.com',
    emailError: 'Digite um e-mail válido para a gente avisar você.',
    submitIdle: 'Entrar na lista',
    submitSent: 'Pronto — a gente avisa você',
    ctaNote: 'Ferramenta de pagamento não-custodial. Você mantém a posse do seu saldo.',

    footerNote:
      'A Yield2Pay é uma ferramenta de pagamento não-custodial. Não somos instituição financeira e não administramos recursos de terceiros. O rendimento gerado é variável e pode ser zero. Os valores exibidos nesta página são simulações escolhidas por você, não projeções nem promessas.',
    copyright: '© 2026',

    subs: [
      { id: 'netflix', name: 'Netflix', price: 59.9 },
      { id: 'spotify', name: 'Spotify Família', price: 34.9 },
      { id: 'ingles', name: 'Escola de inglês', price: 189 },
      { id: 'academia', name: 'Academia', price: 129.9 },
      { id: 'disney', name: 'Disney+', price: 43.9 },
      { id: 'icloud', name: 'iCloud + Google One', price: 27.9 },
      { id: 'celular', name: 'Plano de celular', price: 89.9 },
      { id: 'delivery', name: 'Clube de delivery', price: 19.9 },
    ],
  },

  onboarding: {
    loginTitle: 'Entre para começar',
    loginSub:
      'Sem senha para decorar, sem frase secreta para anotar. Você entra com a conta que já usa.',
    google: 'Continuar com Google',
    apple: 'Continuar com Apple',
    loginNote: 'Ao entrar, sua carteira é criada na hora, e ela é só sua.',

    walletTitle: 'Sua carteira foi criada',
    walletKicker: 'O que isso significa',
    walletBody:
      'Pense nela como um cofre digital em que só a sua chave abre a porta. A chave fica com você, protegida pela sua conta. A Yield2Pay organiza os pagamentos, mas nunca guarda nem movimenta o seu dinheiro sem a sua autorização.',
    walletCta: 'Fazer meu primeiro depósito',

    pixFirstTitle: 'Seu primeiro depósito',
    pixTitle: 'Depositar por PIX',
    pixSub:
      'O valor entra na sua carteira como moeda digital estável: ela é feita para valer sempre a mesma coisa, sem o sobe e desce do mercado. Você continua vendo tudo em reais.',
    pixAmountLabel: 'Valor do depósito (R$)',
    pixAmountPlaceholder: '5.000',
    pixQr: 'QR PIX',
    pixCopyLabel: 'Pix copia e cola',
    pixCopy: 'Copiar código',
    pixCopied: 'Copiado ✓',
    pixConfirm: 'Já fiz o PIX',
    pixBack: 'Voltar sem depositar',
    stepsAria: 'Progresso do cadastro',
  },

  withdraw: {
    title: 'Sacar meu saldo',
    sub: 'O valor cai por PIX na conta do seu próprio CPF, sem carência e sem multa.',
    amountLabel: 'Valor do saque (R$)',
    keyLabel: 'Chave PIX de destino',
    allLabel: 'Sacar tudo',
    available: 'Disponível',
    confirm: 'Confirmar saque',
    back: 'Voltar ao painel',
    note: 'O saque reduz o seu depósito e, com ele, o rendimento que paga as assinaturas.',
    errorAmount: 'Digite um valor entre R$ 1 e o seu saldo depositado.',
    done: 'Saque solicitado ✓',
  },

  dash: {
    concepts: 'Entenda como funciona',
    hello: 'Olá,',
    menuAccount: 'Minha conta',
    menuSubs: 'Assinaturas',
    menuLogout: 'Sair',
    menuAll: 'Ver todas as configurações ›',

    freedomLabel: 'Percentual de liberdade',
    freedomFull: 'Todas as assinaturas da casa se pagam sozinhas neste cenário.',
    freedomPartial: 'das contas da casa já se pagam com o rendimento do seu depósito.',
    scenarioNote: (rate: string) =>
      `Estimativa no cenário de ${rate} ao ano, escolhido por você. O rendimento é variável e pode ser menor.`,
    scenarioNoteShort: (rate: string) =>
      `Estimativa no cenário de ${rate} ao ano, escolhido por você. O rendimento é variável.`,

    balanceLabel: 'Seu saldo depositado',
    balanceSub: 'Continua seu. Saque quando quiser.',
    paidLabel: 'O rendimento pagou este mês',
    paidSub: 'Só o que o saldo produz é usado. O principal fica intocado.',

    vaultTitle: 'Seu cofre',
    vaultSub: 'Onde o seu depósito fica guardado enquanto rende',
    vaultBadge: 'Cofre DeFindex · Código aberto',
    vaultStored: 'Guardado no cofre',
    vaultNote:
      'Só a sua chave autoriza saídas. A Yield2Pay não guarda nem movimenta o seu saldo.',
    vaultDeposit: 'Depositar por PIX',
    vaultWithdraw: 'Sacar meu saldo',
    movTitle: 'Movimentações recentes',
    movYield: 'Rendimento do mês',
    movYieldSub: 'estimativa · creditado dia 1º',
    movAuto: 'pagamento automático',
    movDeposit: 'Depósito via PIX',
    movDepositSub: 'entrada na sua carteira',

    subsTitle: 'Assinaturas da casa',
    subsTotal: (total: string) => `Total de ${total} por mês`,
    subsAdd: '+ Adicionar assinatura',
    subsClose: 'Fechar',
    subsNamePlaceholder: 'Nome da assinatura',
    subsPricePlaceholder: 'R$ por mês',
    subsNameAria: 'Nome da assinatura',
    subsPriceAria: 'Valor mensal',
    subsAddCta: 'Adicionar',
    subsHintCovered: 'o rendimento paga esta conta',
    subsHintMissing: (missing: string) => `faltam ${missing} de depósito`,
    subsFooter: 'A ordem da lista define quais contas o rendimento cobre primeiro.',
    statusCovered: 'coberta',
    statusNotYet: 'ainda não',
    empty: 'Nenhuma assinatura na lista ainda. Adicione a primeira acima.',
  },

  detail: {
    back: '‹ Voltar para o painel',
    perMonth: 'por mês',
    statusCovered: 'coberta',
    statusNotYet: 'ainda não coberta',
    lineCovered:
      'Esta conta já se paga sozinha: o rendimento do seu depósito cobre o valor dela todo mês, sem tocar no principal.',
    linePartial: (pct: number, missing: string) =>
      `Você está a ${pct}% do caminho. Com mais ${missing} depositados, o rendimento passaria a cobrir esta conta todo mês.`,
    neededLabel: 'Depósito que cobre esta conta',
    neededSub: 'junto com as contas acima dela na lista',
    missingLabel: 'Falta depositar',
    missingSub: 'para ela se pagar todo mês, enquanto o cenário se mantiver',
    cta: 'Depositar por PIX',
    note: (rate: string) =>
      `Estimativa no cenário de ${rate} ao ano, escolhido por você. Não é promessa de resultado.`,
    notFound: 'Assinatura não encontrada.',
  },

  concepts: {
    back: '‹ Voltar ao painel',
    eyebrow: 'Entenda como funciona',
    title: 'Sem pressa. É mais simples do que parece.',
    sub: 'São só três ideias por trás de tudo. Abra a que estiver te deixando em dúvida.',
    what: 'O que é',
    why: 'Por que isso é bom pra você',
    how: 'O que você faz na prática',
    answered: 'Isso respondeu sua dúvida? Voltar ao painel ›',
    items: [
      {
        id: 'carteira',
        n: '01',
        title: 'Carteira',
        sub: 'Sua conta aqui dentro — só que a chave é sua',
        what: 'É a sua conta aqui dentro. A diferença é que a chave é sua, não nossa — como ter o cofre em casa em vez de alugar um no banco.',
        why: 'Ninguém pode bloquear, congelar ou mexer no seu dinheiro. Nem a gente.',
        how: 'Nada de senha extra nem código para anotar. O acesso é protegido pelo login de Google ou Apple que você já usa. Perdeu o celular? É só entrar de novo com a sua conta em outro aparelho.',
      },
      {
        id: 'moeda',
        n: '02',
        title: 'Moeda digital estável',
        sub: 'Dinheiro digital que segue o dólar, sem montanha-russa',
        what: 'É dinheiro digital que segue o dólar — não sobe e desce como as criptomoedas que aparecem no jornal.',
        why: 'Seu saldo não vira montanha-russa. R$ 100 guardados hoje continuam valendo por volta de R$ 100 amanhã.',
        how: 'Nada — você vê tudo em reais e deposita e saca por PIX. Só vale saber: como ela segue o dólar, o valor em reais varia um pouco junto com ele, para cima ou para baixo.',
      },
      {
        id: 'rendimento',
        n: '03',
        title: 'Rendimento',
        sub: 'Seu dinheiro parado trabalhando pelas suas contas',
        what: 'É o seu dinheiro parado trabalhando, como quando fica guardado rendendo — só que aqui o resultado vai direto para as suas contas.',
        why: 'Todo mês, o que o saldo produz paga suas assinaturas sem você mexer um dedo. O que você depositou não é gasto.',
        how: 'Pode sacar o seu depósito quando quiser, por PIX. O rendimento varia mês a mês — pode ser maior, menor ou até zero — por isso mostramos estimativas, nunca promessas.',
      },
    ],
    faqTitle: 'Perguntas frequentes',
    faq: [
      {
        q: 'E se eu perder meu celular?',
        a: 'Seu dinheiro não está no aparelho, está na sua carteira. Entre com o seu login Google ou Apple em qualquer celular e tudo estará lá.',
      },
      {
        q: 'Meu dinheiro pode sumir?',
        a: 'O que você depositou fica guardado em um cofre digital de código aberto, com auditoria pública, e só a sua chave autoriza saídas. O rendimento do mês varia, mas o seu depósito não é gasto.',
      },
      {
        q: 'Posso tirar meu dinheiro quando quiser?',
        a: 'Pode. O saque cai por PIX, sem carência, sem multa e sem precisar pedir para ninguém.',
      },
      {
        q: 'Vocês têm acesso ao meu saldo?',
        a: 'Não. A Yield2Pay organiza os pagamentos que você autorizou, mas não guarda nem consegue movimentar o seu dinheiro.',
      },
    ],
    backCta: 'Voltar ao painel',
    note: 'Ferramenta de pagamento não-custodial. Projeções são estimativas condicionais, nunca promessas.',
  },

  settings: {
    back: '‹ Voltar ao painel',
    title: 'Configurações',
    sub: 'Sua conta, sua carteira e suas preferências, tudo num lugar só.',
    navAria: 'Seções',
    nav: [
      ['perfil', 'Perfil'],
      ['seguranca', 'Acesso e segurança'],
      ['carteira', 'Carteira'],
      ['pix', 'PIX e pagamentos'],
      ['assinaturas', 'Assinaturas'],
      ['notificacoes', 'Notificações'],
      ['privacidade', 'Privacidade e dados'],
    ],

    profileTitle: 'Perfil',
    photoUpload: 'Enviar foto',
    photoChange: 'Trocar foto',
    photoRemove: 'Remover',
    nameLabel: 'Nome de exibição',
    emailLabel: 'E-mail da conta',
    emailNote: 'É o seu login. Trocar exige confirmação — fale com a gente.',
    phoneLabel: 'Telefone (opcional)',
    phonePlaceholder: '(11) 90000-0000',
    cpfLabel: 'CPF',
    cpfNote: 'Verificado — não pode ser alterado.',
    langLabel: 'Idioma',
    langPt: 'Português',
    langEn: 'English',
    save: 'Salvar alterações',
    saving: 'Salvando…',
    saved: 'Alterações salvas ✓',

    recoveryKicker: 'Como recuperar seu acesso',
    recoveryTitle: 'Você nunca fica trancado do lado de fora',
    recoveryBody:
      'Sua carteira é recuperada pelo mesmo login de Google ou Apple que você usa para entrar — em qualquer aparelho. Não existe frase secreta para decorar nem papel para esconder na gaveta. E a Yield2Pay não consegue ver nem mover o seu dinheiro sozinha: toda saída precisa da sua autorização.',
    accessTitle: 'Acesso',
    googleLogin: 'Login com Google',
    lastAccess: 'Último acesso: hoje, 09:14',
    twoFATitle: 'Autenticação em duas etapas',
    twoFASub: 'Um código extra no seu celular antes de qualquer saque.',
    devicesTitle: 'Dispositivos conectados',
    deviceEnd: 'Encerrar sessão',
    deviceConfirm: 'Confirmar?',
    deviceEnded: 'Sessão encerrada',

    walletTitle: 'Sua carteira',
    walletCopy: 'Copiar',
    walletCopied: 'Copiado ✓',
    walletNote:
      'É o número da sua conta aqui dentro — como agência e conta, só que da sua carteira.',
    walletLink: 'Entenda como funciona ›',
    historyTitle: 'Histórico de movimentações',
    exportCsv: 'Exportar CSV',
    exportCsvDone: 'CSV gerado ✓',
    exportPdf: 'Exportar PDF',
    exportPdfDone: 'PDF gerado ✓',
    filters: [
      ['todos', 'Tudo'],
      ['entrada', 'Entradas'],
      ['saida', 'Saídas'],
      ['pagamento', 'Pagamentos'],
    ],
    historyEmpty: 'Nenhuma movimentação neste filtro.',
    histWithdraw: 'Saque por PIX',
    histWithdrawSub: 'para conta do seu CPF',

    pixTitle: 'Chave PIX para saques',
    pixSub: 'Por segurança, o saque só vai para uma conta do seu próprio CPF.',
    pixChange: 'Trocar chave',
    pixUpdated: 'Chave atualizada ✓',
    pixPlaceholder: 'Nova chave (e-mail, telefone ou CPF)',
    pixAria: 'Nova chave PIX',
    pixInvalid: 'Essa chave não parece válida. Use e-mail, telefone ou CPF.',
    pixContinue: 'Continuar',
    pixCancel: 'Cancelar',
    pixConfirmQuestion: 'Confirmar troca para',
    pixConfirmStep: 'Passo 2 de 2 — a chave antiga deixa de valer na hora.',
    pixConfirmYes: 'Sim, trocar chave',
    pixConfirmSaving: 'Salvando…',
    pixBack: 'Voltar',

    autoTitle: 'Depósito automático',
    autoSub: 'Um PIX recorrente para o seu percentual de liberdade crescer sozinho.',
    autoAmount: 'Valor (R$)',
    autoFreq: 'Frequência',
    autoFreqs: [
      ['mensal', 'Todo mês'],
      ['quinzenal', 'A cada 15 dias'],
    ],
    autoSave: 'Salvar',
    autoSaved: 'Salvo ✓',

    cardTitle: 'Cartão virtual',
    cardSub: 'Para pagar assinaturas que não aceitam débito automático.',
    cardSoon: 'Em breve',

    subsTitle: 'Assinaturas',
    subsSub:
      'A ordem abaixo é a prioridade: quando o rendimento do mês não cobre tudo, as contas do topo são pagas primeiro.',
    subsDue: (dia: string) => `vence dia ${dia}`,
    subsUp: 'Subir prioridade',
    subsDown: 'Descer prioridade',
    subsEdit: 'Editar',
    subsRemove: 'Remover',
    subsRemoveConfirm: 'Confirmar?',
    subsValueLabel: 'Valor mensal (R$)',
    subsDayLabel: 'Dia de vencimento',
    subsSave: 'Salvar',
    subsCancel: 'Cancelar',
    statusCovered: 'coberta',
    statusNotYet: 'ainda não',

    channelsTitle: 'Canais',
    channels: [
      ['email', 'E-mail', 'Resumo no seu e-mail da conta.'],
      ['push', 'Push no celular', 'Avisos na hora, direto no aparelho.'],
    ],
    eventsTitle: 'Quando avisar você',
    events: [
      ['paga', 'Assinatura paga pelo rendimento', 'Avisa quando uma conta do mês se pagou sozinha.'],
      ['deposito', 'Depósito confirmado', 'Avisa quando um PIX seu entrou na carteira.'],
      ['saque', 'Saque concluído', 'Avisa quando o dinheiro caiu na sua conta.'],
      ['liberdade', 'Mudança no Percentual de Liberdade', 'Avisa quando ele sobe ou desce.'],
      ['lembrete', 'Lembrete de depósito', 'Um empurrãozinho na data do seu depósito automático.'],
    ],

    dataTitle: 'Seus dados',
    dataSub:
      'Pela lei brasileira de proteção de dados (LGPD), seus dados são seus: você pode baixar uma cópia ou pedir para a gente apagar tudo, quando quiser.',
    dataDownload: 'Baixar meus dados',
    dataDownloadDone: 'Preparando… enviamos por e-mail ✓',
    terms: 'Termos de Uso',
    privacy: 'Política de Privacidade',
    deleteTitle: 'Excluir minha conta',
    deleteSub:
      'Antes de excluir, você precisa sacar todo o saldo da sua carteira — a exclusão não movimenta dinheiro por você.',
    deleteCta: 'Quero excluir minha conta',
    deleteStep: 'Passo 2 de 2 — confirmação',
    deleteBody:
      'Sua conta ainda tem saldo guardado. Saque tudo por PIX antes de confirmar a exclusão.',
    deleteError: 'Não foi possível excluir: ainda existe saldo na carteira. Saque primeiro.',
    deleteConfirm: 'Confirmar exclusão',
    deleteWithdrawFirst: 'Sacar meu saldo primeiro',
    deleteCancel: 'Cancelar',
  },
};

/** Formato canônico do dicionário — PT é a fonte da verdade. */
export type FamilyDict = typeof pt;

const en: FamilyDict = {
  brand: 'Yield2Pay',
  brandTag: 'For families',
  langLabel: 'Language',

  landing: {
    navCalc: 'Calculator',
    navHow: 'How it works',
    navCta: 'Join the list',
    enterApp: 'I already have an account — sign in ›',

    heroEyebrow: 'Yield2Pay for families',
    heroTitle: 'The yield on your own money pays your subscriptions.',
    heroSub:
      'You put in an amount once. It stays yours, and what it earns covers Netflix, Spotify, the kids’ language classes. The principal sits untouched, waiting for the day you want it back.',
    heroCta1: 'Join the waitlist',
    heroCta2: 'Run the numbers',
    heroSeals: ['Non-custodial', 'Withdraw anytime', 'No monthly fee'],
    heroCardLabel: 'This month',
    heroCardSub: 'paid by the yield on your deposit',
    heroCardRows: ['Netflix', 'Spotify Family', 'Language classes'],
    heroCardPaid: 'paid',
    heroCardNote: 'Illustrative example',

    calcEyebrow: 'Calculator',
    calcTitle: 'Your freedom percentage',
    calcSub:
      'Tick what your household subscribes to today and see how much would need to be sitting there for the yield on it to cover the bill.',
    calcSubsLabel: 'Household subscriptions',
    calcExtraLabel: 'Other subscriptions (R$ per month)',
    calcDepositLabel: 'How much you’d have deposited',
    calcDepositAria: 'Deposited amount',
    calcScenarioLabel: 'Simulation scenario',
    calcScenarioSuffix: '%/yr',
    freedomLabel: 'Freedom percentage',
    freedomEmpty: 'Pick at least one subscription to see the math.',
    freedomFull: 'In this scenario, every one of your subscriptions would be covered.',
    freedomPartial: 'of your subscriptions would be paid by the yield on what you had deposited.',
    rowMonthly: 'Your subscriptions',
    rowCovered: 'Covered in this scenario',
    rowNeeded: 'Deposit to reach 100%',
    calcCta: 'Join the waitlist',
    calcNote: 'A simulation using a scenario you pick. Not a promise of results.',

    howEyebrow: 'How it works',
    howTitle: 'Three steps, once',
    howSteps: [
      {
        n: '01',
        title: 'You open your wallet',
        desc: 'It takes a few minutes. The wallet is yours: you hold the keys, and Yield2Pay never holds your money.',
      },
      {
        n: '02',
        title: 'You deposit once',
        desc: 'By PIX, in whatever amount makes sense for your household. The principal stays yours and you can withdraw it whenever you want.',
      },
      {
        n: '03',
        title: 'The bills pay themselves',
        desc: 'You choose which subscriptions are in. Every month the yield goes straight to them, without you lifting a finger.',
      },
    ],

    behindEyebrow: 'No fine print',
    behindTitle: 'What’s behind it',
    behindCards: [
      {
        kicker: 'Wallet',
        title: 'The money never leaves your hands',
        desc: 'Your wallet is non-custodial: only you sign what leaves it. Yield2Pay is the tool that arranges the payments, not the vault that holds your balance.',
      },
      {
        kicker: 'Stablecoin',
        title: 'Your balance in a stable currency',
        desc: 'The deposit sits in a dollar-backed stablecoin, built to track the currency without the swings of the rest of the crypto market. You see the value in reais the whole time.',
      },
      {
        kicker: 'Yield',
        title: 'Only what it produces gets spent',
        desc: 'The balance is allocated to open, audited protocols that generate a variable yield. It can go up, it can go down, and nothing is guaranteed. That yield, and only that yield, pays your subscriptions. The principal stays untouched.',
      },
    ],

    ctaTitle: 'Start with the waitlist',
    ctaSub:
      'We’ll let you know when your spot opens. No charge, no commitment, and your email goes nowhere else.',
    emailLabel: 'Your email',
    emailPlaceholder: 'you@email.com',
    emailError: 'Enter a valid email so we can reach you.',
    submitIdle: 'Join the waitlist',
    submitSent: 'Done — we will be in touch',
    ctaNote: 'Non-custodial payment tool. You keep ownership of your balance.',

    footerNote:
      'Yield2Pay is a non-custodial payment tool. We are not a financial institution and we do not manage third-party funds. The yield generated is variable and may be zero. The figures on this page are simulations you choose, not projections or promises.',
    copyright: '© 2026',

    subs: [
      { id: 'netflix', name: 'Netflix', price: 59.9 },
      { id: 'spotify', name: 'Spotify Family', price: 34.9 },
      { id: 'ingles', name: 'Language classes', price: 189 },
      { id: 'academia', name: 'Gym', price: 129.9 },
      { id: 'disney', name: 'Disney+', price: 43.9 },
      { id: 'icloud', name: 'iCloud + Google One', price: 27.9 },
      { id: 'celular', name: 'Phone plan', price: 89.9 },
      { id: 'delivery', name: 'Delivery club', price: 19.9 },
    ],
  },

  onboarding: {
    loginTitle: 'Sign in to get started',
    loginSub:
      'No password to memorise, no secret phrase to write down. You sign in with the account you already use.',
    google: 'Continue with Google',
    apple: 'Continue with Apple',
    loginNote: 'When you sign in, your wallet is created on the spot — and it is yours alone.',

    walletTitle: 'Your wallet is ready',
    walletKicker: 'What that means',
    walletBody:
      'Think of it as a digital vault only your key opens. The key stays with you, protected by your account. Yield2Pay arranges the payments, but never holds or moves your money without your authorisation.',
    walletCta: 'Make my first deposit',

    pixFirstTitle: 'Your first deposit',
    pixTitle: 'Deposit by PIX',
    pixSub:
      'The amount lands in your wallet as a stable digital currency: it is built to always be worth the same, without the market swings. You keep seeing everything in reais.',
    pixAmountLabel: 'Deposit amount (R$)',
    pixAmountPlaceholder: '5.000',
    pixQr: 'PIX QR',
    pixCopyLabel: 'PIX copy and paste',
    pixCopy: 'Copy code',
    pixCopied: 'Copied ✓',
    pixConfirm: 'I’ve sent the PIX',
    pixBack: 'Go back without depositing',
    stepsAria: 'Sign-up progress',
  },

  withdraw: {
    title: 'Withdraw my balance',
    sub: 'The money lands by PIX in an account under your own CPF — no lock-up, no penalty.',
    amountLabel: 'Withdrawal amount (R$)',
    keyLabel: 'Destination PIX key',
    allLabel: 'Withdraw everything',
    available: 'Available',
    confirm: 'Confirm withdrawal',
    back: 'Back to the dashboard',
    note: 'Withdrawing lowers your deposit and, with it, the yield that pays your subscriptions.',
    errorAmount: 'Enter an amount between R$ 1 and your deposited balance.',
    done: 'Withdrawal requested ✓',
  },

  dash: {
    concepts: 'Understand how it works',
    hello: 'Hi,',
    menuAccount: 'My account',
    menuSubs: 'Subscriptions',
    menuLogout: 'Sign out',
    menuAll: 'See all settings ›',

    freedomLabel: 'Freedom percentage',
    freedomFull: 'Every household subscription pays for itself in this scenario.',
    freedomPartial: 'of the household bills already pay for themselves with the yield on your deposit.',
    scenarioNote: (rate: string) =>
      `Estimate in the ${rate} a year scenario you picked. The yield is variable and may be lower.`,
    scenarioNoteShort: (rate: string) =>
      `Estimate in the ${rate} a year scenario you picked. The yield is variable.`,

    balanceLabel: 'Your deposited balance',
    balanceSub: 'Still yours. Withdraw whenever you want.',
    paidLabel: 'The yield paid this month',
    paidSub: 'Only what the balance produces is used. The principal stays untouched.',

    vaultTitle: 'Your vault',
    vaultSub: 'Where your deposit sits while it earns',
    vaultBadge: 'DeFindex vault · Open source',
    vaultStored: 'Held in the vault',
    vaultNote: 'Only your key authorises withdrawals. Yield2Pay neither holds nor moves your balance.',
    vaultDeposit: 'Deposit by PIX',
    vaultWithdraw: 'Withdraw my balance',
    movTitle: 'Recent activity',
    movYield: 'Yield for the month',
    movYieldSub: 'estimate · credited on the 1st',
    movAuto: 'automatic payment',
    movDeposit: 'Deposit via PIX',
    movDepositSub: 'incoming to your wallet',

    subsTitle: 'Household subscriptions',
    subsTotal: (total: string) => `${total} a month in total`,
    subsAdd: '+ Add subscription',
    subsClose: 'Close',
    subsNamePlaceholder: 'Subscription name',
    subsPricePlaceholder: 'R$ per month',
    subsNameAria: 'Subscription name',
    subsPriceAria: 'Monthly amount',
    subsAddCta: 'Add',
    subsHintCovered: 'the yield pays this bill',
    subsHintMissing: (missing: string) => `${missing} more to deposit`,
    subsFooter: 'The order of the list decides which bills the yield covers first.',
    statusCovered: 'covered',
    statusNotYet: 'not yet',
    empty: 'No subscriptions on the list yet. Add the first one above.',
  },

  detail: {
    back: '‹ Back to the dashboard',
    perMonth: 'a month',
    statusCovered: 'covered',
    statusNotYet: 'not covered yet',
    lineCovered:
      'This bill already pays for itself: the yield on your deposit covers it every month, without touching the principal.',
    linePartial: (pct: number, missing: string) =>
      `You are ${pct}% of the way there. With ${missing} more deposited, the yield would cover this bill every month.`,
    neededLabel: 'Deposit that covers this bill',
    neededSub: 'together with the bills above it on the list',
    missingLabel: 'Still to deposit',
    missingSub: 'for it to pay for itself every month, as long as the scenario holds',
    cta: 'Deposit by PIX',
    note: (rate: string) =>
      `Estimate in the ${rate} a year scenario you picked. Not a promise of results.`,
    notFound: 'Subscription not found.',
  },

  concepts: {
    back: '‹ Back to the dashboard',
    eyebrow: 'Understand how it works',
    title: 'Take your time. It is simpler than it looks.',
    sub: 'There are only three ideas behind all of it. Open the one you are unsure about.',
    what: 'What it is',
    why: 'Why that is good for you',
    how: 'What you actually do',
    answered: 'Did that answer it? Back to the dashboard ›',
    items: [
      {
        id: 'carteira',
        n: '01',
        title: 'Wallet',
        sub: 'Your account in here — except the key is yours',
        what: 'It is your account in here. The difference is that the key is yours, not ours — like keeping the safe at home instead of renting one at the bank.',
        why: 'Nobody can block, freeze or touch your money. Not even us.',
        how: 'No extra password, no code to write down. Access is protected by the Google or Apple login you already use. Lost your phone? Just sign in again on another device.',
      },
      {
        id: 'moeda',
        n: '02',
        title: 'Stable digital currency',
        sub: 'Digital money that tracks the dollar, without the rollercoaster',
        what: 'It is digital money that tracks the dollar — it does not swing like the cryptocurrencies in the news.',
        why: 'Your balance does not become a rollercoaster. R$ 100 held today is still worth around R$ 100 tomorrow.',
        how: 'Nothing — you see everything in reais and deposit and withdraw by PIX. Worth knowing: because it tracks the dollar, the value in reais moves a little with it, up or down.',
      },
      {
        id: 'rendimento',
        n: '03',
        title: 'Yield',
        sub: 'Your idle money working for your bills',
        what: 'It is your idle money working, the way savings earn — except here the result goes straight to your bills.',
        why: 'Every month, what the balance produces pays your subscriptions without you lifting a finger. What you deposited is not spent.',
        how: 'You can withdraw your deposit whenever you want, by PIX. The yield varies month to month — it can be higher, lower or even zero — which is why we show estimates, never promises.',
      },
    ],
    faqTitle: 'Frequently asked questions',
    faq: [
      {
        q: 'What if I lose my phone?',
        a: 'Your money is not on the device, it is in your wallet. Sign in with your Google or Apple login on any phone and everything is there.',
      },
      {
        q: 'Can my money disappear?',
        a: 'What you deposited sits in an open-source digital vault with public audits, and only your key authorises withdrawals. The monthly yield varies, but your deposit is not spent.',
      },
      {
        q: 'Can I take my money out whenever I want?',
        a: 'Yes. Withdrawals land by PIX, with no lock-up, no penalty and no need to ask anyone.',
      },
      {
        q: 'Do you have access to my balance?',
        a: 'No. Yield2Pay arranges the payments you authorised, but it neither holds nor can move your money.',
      },
    ],
    backCta: 'Back to the dashboard',
    note: 'Non-custodial payment tool. Projections are conditional estimates, never promises.',
  },

  settings: {
    back: '‹ Back to the dashboard',
    title: 'Settings',
    sub: 'Your account, your wallet and your preferences, all in one place.',
    navAria: 'Sections',
    nav: [
      ['perfil', 'Profile'],
      ['seguranca', 'Access and security'],
      ['carteira', 'Wallet'],
      ['pix', 'PIX and payments'],
      ['assinaturas', 'Subscriptions'],
      ['notificacoes', 'Notifications'],
      ['privacidade', 'Privacy and data'],
    ],

    profileTitle: 'Profile',
    photoUpload: 'Upload photo',
    photoChange: 'Change photo',
    photoRemove: 'Remove',
    nameLabel: 'Display name',
    emailLabel: 'Account email',
    emailNote: 'It is your login. Changing it needs confirmation — talk to us.',
    phoneLabel: 'Phone (optional)',
    phonePlaceholder: '(11) 90000-0000',
    cpfLabel: 'CPF',
    cpfNote: 'Verified — cannot be changed.',
    langLabel: 'Language',
    langPt: 'Português',
    langEn: 'English',
    save: 'Save changes',
    saving: 'Saving…',
    saved: 'Changes saved ✓',

    recoveryKicker: 'How to recover your access',
    recoveryTitle: 'You never get locked out',
    recoveryBody:
      'Your wallet is recovered with the same Google or Apple login you sign in with — on any device. There is no secret phrase to memorise and no paper to hide in a drawer. And Yield2Pay cannot see or move your money on its own: every withdrawal needs your authorisation.',
    accessTitle: 'Access',
    googleLogin: 'Google login',
    lastAccess: 'Last access: today, 09:14',
    twoFATitle: 'Two-factor authentication',
    twoFASub: 'An extra code on your phone before any withdrawal.',
    devicesTitle: 'Connected devices',
    deviceEnd: 'End session',
    deviceConfirm: 'Confirm?',
    deviceEnded: 'Session ended',

    walletTitle: 'Your wallet',
    walletCopy: 'Copy',
    walletCopied: 'Copied ✓',
    walletNote:
      'It is your account number in here — like a branch and account number, but for your wallet.',
    walletLink: 'Understand how it works ›',
    historyTitle: 'Activity history',
    exportCsv: 'Export CSV',
    exportCsvDone: 'CSV generated ✓',
    exportPdf: 'Export PDF',
    exportPdfDone: 'PDF generated ✓',
    filters: [
      ['todos', 'Everything'],
      ['entrada', 'Incoming'],
      ['saida', 'Outgoing'],
      ['pagamento', 'Payments'],
    ],
    historyEmpty: 'Nothing under this filter.',
    histWithdraw: 'Withdrawal via PIX',
    histWithdrawSub: 'to an account under your CPF',

    pixTitle: 'PIX key for withdrawals',
    pixSub: 'For safety, withdrawals only go to an account under your own CPF.',
    pixChange: 'Change key',
    pixUpdated: 'Key updated ✓',
    pixPlaceholder: 'New key (email, phone or CPF)',
    pixAria: 'New PIX key',
    pixInvalid: 'That key does not look valid. Use an email, phone or CPF.',
    pixContinue: 'Continue',
    pixCancel: 'Cancel',
    pixConfirmQuestion: 'Confirm the change to',
    pixConfirmStep: 'Step 2 of 2 — the old key stops working immediately.',
    pixConfirmYes: 'Yes, change the key',
    pixConfirmSaving: 'Saving…',
    pixBack: 'Back',

    autoTitle: 'Automatic deposit',
    autoSub: 'A recurring PIX so your freedom percentage grows on its own.',
    autoAmount: 'Amount (R$)',
    autoFreq: 'Frequency',
    autoFreqs: [
      ['mensal', 'Every month'],
      ['quinzenal', 'Every 15 days'],
    ],
    autoSave: 'Save',
    autoSaved: 'Saved ✓',

    cardTitle: 'Virtual card',
    cardSub: 'For subscriptions that do not accept direct debit.',
    cardSoon: 'Coming soon',

    subsTitle: 'Subscriptions',
    subsSub:
      'The order below is the priority: when the monthly yield does not cover everything, the bills at the top are paid first.',
    subsDue: (dia: string) => `due on the ${dia}`,
    subsUp: 'Move priority up',
    subsDown: 'Move priority down',
    subsEdit: 'Edit',
    subsRemove: 'Remove',
    subsRemoveConfirm: 'Confirm?',
    subsValueLabel: 'Monthly amount (R$)',
    subsDayLabel: 'Due day',
    subsSave: 'Save',
    subsCancel: 'Cancel',
    statusCovered: 'covered',
    statusNotYet: 'not yet',

    channelsTitle: 'Channels',
    channels: [
      ['email', 'Email', 'A summary to your account email.'],
      ['push', 'Phone push', 'Alerts right away, straight to the device.'],
    ],
    eventsTitle: 'When to notify you',
    events: [
      ['paga', 'Subscription paid by the yield', 'Tells you when a bill paid for itself.'],
      ['deposito', 'Deposit confirmed', 'Tells you when a PIX of yours reached the wallet.'],
      ['saque', 'Withdrawal completed', 'Tells you when the money reached your account.'],
      ['liberdade', 'Freedom percentage change', 'Tells you when it goes up or down.'],
      ['lembrete', 'Deposit reminder', 'A nudge on the date of your automatic deposit.'],
    ],

    dataTitle: 'Your data',
    dataSub:
      'Under the Brazilian data protection law (LGPD), your data is yours: you can download a copy or ask us to erase everything, whenever you want.',
    dataDownload: 'Download my data',
    dataDownloadDone: 'Preparing… we sent it by email ✓',
    terms: 'Terms of Use',
    privacy: 'Privacy Policy',
    deleteTitle: 'Delete my account',
    deleteSub:
      'Before deleting, you need to withdraw the whole balance from your wallet — deleting does not move money for you.',
    deleteCta: 'I want to delete my account',
    deleteStep: 'Step 2 of 2 — confirmation',
    deleteBody:
      'Your account still holds a balance. Withdraw everything by PIX before confirming the deletion.',
    deleteError: 'Could not delete: there is still a balance in the wallet. Withdraw first.',
    deleteConfirm: 'Confirm deletion',
    deleteWithdrawFirst: 'Withdraw my balance first',
  deleteCancel: 'Cancel',
},
};

export const FAM = { pt, en };

export type FamilyLang = keyof typeof FAM;

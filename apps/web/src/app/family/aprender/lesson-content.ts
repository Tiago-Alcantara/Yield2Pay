import type { LessonView } from '@yield2pay/shared';

/**
 * Roteiro de layout da trilha "Cripto sem pressa".
 * Títulos, passos e ilustrações são provisórios: o conteúdo final e o vídeo
 * entram neste arquivo quando chegarem.
 */
export interface LessonScene {
  kicker: string;
  fig: string;
  sub: string;
  chips: string[];
  cap: string;
  img?: string;
}

export interface PresentedLesson {
  id: string;
  title: string;
  desc: string;
  scenes: LessonScene[];
}

const BEGINNER_IDS = ['beginner-1', 'beginner-2', 'beginner-3', 'beginner-4'] as const;

function scene(
  kicker: string,
  fig: string,
  sub: string,
  chips: string[],
  cap: string,
  img = '',
): LessonScene {
  return { kicker, fig, sub, chips, cap, img: img || undefined };
}

export const CRIPTO_LESSONS: PresentedLesson[] = [
  {
    id: 'beginner-1',
    title: 'O que é cripto, sem jargão',
    desc: 'Os conceitos básicos: o que é, como funciona e por que é diferente do dinheiro do banco.',
    scenes: [
      scene('Dinheiro digital', '₿', 'Dinheiro que existe só na internet.', ['sem cédula', 'sem moeda'], 'Cripto é dinheiro que existe só no mundo digital. Não tem nota nem moeda, só registros.'),
      scene('Sem intermediário', 'A → B', 'A troca vai direto, sem banco no meio.', ['24 horas', 'qualquer país'], 'Você manda direto para outra pessoa, a qualquer hora, sem um banco aprovando no meio.'),
      scene('Registro público', '#842.519', 'Cada troca fica anotada num livro que todos podem ver.', ['bloco', 'bloco', 'bloco'], 'Cada transação entra num registro aberto, em blocos encadeados. Ninguém apaga o que foi escrito.'),
      scene('Escassez', '21 mi', 'É o máximo de bitcoins que vão existir.', ['nunca mais que isso'], 'O bitcoin tem limite: nunca vão existir mais de 21 milhões. Ninguém pode imprimir mais.'),
      scene('Stablecoin', '1 = US$ 1', 'Moeda digital presa ao dólar, sem sobe e desce.', ['USDC', 'USDT'], 'Stablecoins acompanham o dólar. Servem para guardar valor e render, sem a oscilação do bitcoin.'),
      scene('Risco', '−60%', 'O bitcoin já caiu isso em um ano. Só entra o que pode esperar.', ['longo prazo', 'valor pequeno'], 'O preço oscila muito. Por isso, só coloque o que a família pode deixar parado por anos.'),
    ],
  },
  {
    id: 'beginner-2',
    title: 'Risco: quanto faz sentido para a família',
    desc: 'Quanto do patrimônio faz sentido colocar, em que ordem, e como fugir dos golpes mais comuns.',
    scenes: [
      scene('Oscilação', '±10%', 'Num único dia, o preço pode subir ou cair isso.', ['normal em cripto'], 'Em cripto, variar dez por cento num dia é comum. Saber disso antes evita decisões no susto.'),
      scene('Reserva primeiro', '6 meses', 'Antes de cripto, a reserva de emergência da casa.', ['1º reserva', '2º cripto'], 'Primeiro a família guarda alguns meses de gastos num lugar seguro. Só depois pensa em cripto.'),
      scene('Quanto colocar', '1–5%', 'Uma fatia pequena do patrimônio, que não faz falta.', ['fatia pequena'], 'Uma regra simples: uma fatia pequena do que vocês têm. Se cair pela metade, a vida segue igual.'),
      scene('Horizonte', '4+ anos', 'Quem precisa do dinheiro logo não deveria estar aqui.', ['longo prazo'], 'Cripto é para dinheiro que pode ficar parado por anos. Para metas próximas, use outro caminho.'),
      scene('Aos poucos', 'R$ 200/mês', 'Comprar todo mês dilui o risco de entrar na hora errada.', ['todo mês', 'sem adivinhar'], 'Em vez de tentar acertar o melhor dia, compre um valor fixo todo mês. O preço médio se ajusta.'),
      scene('Golpes', '100%', 'Promessa de retorno garantido é golpe. Sempre.', ['desconfie', 'pergunte'], 'Ninguém garante lucro em cripto. Se prometem retorno certo e rápido, é golpe.'),
    ],
  },
  {
    id: 'beginner-3',
    title: 'Bitcoin, stablecoins e rendimento',
    desc: 'A diferença entre bitcoin e stablecoins, e de onde vem um rendimento de verdade.',
    scenes: [
      scene('Dois tipos', '₿ · $', 'Bitcoin oscila. Stablecoin acompanha o dólar.', ['volátil', 'estável'], 'Existem dois grandes tipos: o bitcoin, que oscila, e as stablecoins, que seguem o dólar.'),
      scene('Bitcoin', '₿', 'Reserva de valor de longo prazo, com oscilação.', ['escasso', 'volátil'], 'O bitcoin é usado como reserva de valor de longo prazo. Por ser escasso, oscila bastante.'),
      scene('Stablecoin', 'US$ 1', 'Estável, serve para guardar e movimentar.', ['USDC', 'dólar digital'], 'A stablecoin vale sempre perto de um dólar. É prática para guardar e mandar dinheiro.'),
      scene('Rendimento', '+4% a.a.', 'Stablecoins podem render emprestadas a quem paga juros.', ['juros', 'em dólar'], 'Stablecoins podem render juros quando emprestadas. O retorno vem em dólar, não em reais.'),
      scene('De onde vem', '? → %', 'Todo rendimento tem uma origem que dá para explicar.', ['origem clara'], 'Antes de aceitar um rendimento, pergunte de onde ele vem. Se ninguém explica, desconfie.'),
      scene('Capital fica', '100% seu', 'O rendimento trabalha. O capital continua seu.', ['saque a qualquer hora'], 'No modelo certo, só o rendimento trabalha. O dinheiro principal continua seu, para sacar quando quiser.'),
    ],
  },
  {
    id: 'beginner-4',
    title: 'Como guardar com segurança',
    desc: 'Como guardar sua cripto sem depender da sorte: chaves, senhas e cuidados simples.',
    scenes: [
      scene('Carteira', 'chave', 'Ter cripto é ter uma chave que prova que ela é sua.', ['chave privada'], 'Ter cripto, na prática, é ter uma chave. Quem controla a chave controla o dinheiro.'),
      scene('Quem guarda', 'A | B', 'Na corretora, ela guarda. Na carteira própria, você guarda.', ['corretora', 'carteira própria'], 'Na corretora, a empresa guarda por você. Na carteira própria, a responsabilidade é sua.'),
      scene('Frase de recuperação', '12 palavras', 'Quem tem essas palavras tem o dinheiro.', ['papel', 'nunca em foto'], 'A frase de recuperação devolve o acesso se você perder o celular. Anote no papel e guarde bem.'),
      scene('Ninguém pede', '0', 'Nenhum suporte de verdade pede sua senha ou suas palavras.', ['nunca compartilhe'], 'Nenhuma empresa séria pede sua senha ou suas palavras. Quem pede está tentando roubar.'),
      scene('Duas etapas', '2FA', 'Verificação em duas etapas na corretora e no e-mail.', ['app autenticador'], 'Ative a verificação em duas etapas com um app autenticador. É a proteção mais simples que existe.'),
      scene('Teste pequeno', 'R$ 10', 'Antes de um valor alto, envie um pouco e confira.', ['confira o endereço'], 'Antes de enviar um valor alto, mande um pouco e confirme que chegou. Envio errado não volta.'),
    ],
  },
];

function placeholderLesson(lesson: LessonView, index: number): PresentedLesson {
  return {
    id: lesson.id,
    title: lesson.title,
    desc: 'O roteiro e o vídeo desta aula entram aqui.',
    scenes: [
      scene(
        'Em breve',
        String(index + 1).padStart(2, '0'),
        lesson.title,
        [`${lesson.durationMinutes} min`],
        'O conteúdo desta aula ainda vai ser publicado.',
      ),
    ],
  };
}

export function lessonsForTrack(track: 'beginner' | 'fund', apiLessons: LessonView[]): PresentedLesson[] {
  if (track === 'beginner') {
    return CRIPTO_LESSONS.map((lesson, index) => ({
      ...lesson,
      id: apiLessons[index]?.id ?? BEGINNER_IDS[index],
    }));
  }
  return apiLessons.map(placeholderLesson);
}

export function trackCopy(track: 'beginner' | 'fund'): { eyebrow: string; title: string; lede: string } {
  if (track === 'fund') {
    return {
      eyebrow: 'Aprender · Cripto',
      title: 'Cripto, um passo além',
      lede: 'Aulas curtas para entender como o fundo entra no plano de liberdade da família.',
    };
  }
  return {
    eyebrow: 'Aprender · Cripto',
    title: 'Cripto sem pressa',
    lede: 'Aulas curtas para entender como cripto pode, ou não, entrar no plano de liberdade da família.',
  };
}

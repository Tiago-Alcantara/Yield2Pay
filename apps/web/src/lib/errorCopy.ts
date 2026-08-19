import type { ErrorStatusCode } from '@yield2pay/shared';

/**
 * Ações que uma tela de erro pode oferecer. `review` e `close` só existem no
 * popup; `home` só na tela cheia.
 */
export type ErrorAction = 'home' | 'login' | 'retry' | 'support' | 'review';

export interface ErrorCopy {
  /** Rótulo monoespaçado acima do título: "Erro 404 · página não encontrada". */
  kicker: string;
  title: string;
  msg: string;
  primary: ErrorAction;
  secondary: ErrorAction | null;
}

/**
 * Cópia da tela cheia (ErrorPage). Regra de produto — não mudar sem combinar:
 * 404 não oferece "tentar novamente" porque repetir não resolve.
 */
export const PAGE_COPY: Record<ErrorStatusCode, ErrorCopy> = {
  400: {
    kicker: 'Erro 400 · pedido inválido',
    title: 'Esse pedido não pôde ser processado',
    msg: 'Alguma informação enviada não está no formato que esperávamos. Volte, revise os dados e envie de novo.',
    primary: 'home',
    secondary: 'support',
  },
  401: {
    kicker: 'Erro 401 · sessão expirada',
    title: 'Sua sessão expirou',
    msg: 'Por segurança, encerramos sessões inativas. Entre na sua conta para continuar de onde parou.',
    primary: 'login',
    secondary: 'home',
  },
  403: {
    kicker: 'Erro 403 · sem permissão',
    title: 'Você não tem acesso a esta página',
    msg: 'Sua conta não tem permissão para ver este conteúdo. Se acredita que deveria ter, fale com quem administra a conta.',
    primary: 'home',
    secondary: 'support',
  },
  404: {
    kicker: 'Erro 404 · página não encontrada',
    title: 'Esta página não existe',
    msg: 'O endereço pode ter mudado ou o link veio incompleto. Confira o endereço ou volte ao início.',
    primary: 'home',
    secondary: null,
  },
  408: {
    kicker: 'Erro 408 · tempo esgotado',
    title: 'O pedido demorou demais',
    msg: 'A conexão levou mais tempo do que o esperado e nós a encerramos. Tente novamente em alguns instantes.',
    primary: 'retry',
    secondary: 'home',
  },
  500: {
    kicker: 'Erro 500 · falha interna',
    title: 'Algo saiu errado do nosso lado',
    msg: 'O erro não foi causado por você. Já registramos o ocorrido — tente novamente em alguns instantes.',
    primary: 'retry',
    secondary: 'home',
  },
  502: {
    kicker: 'Erro 502 · serviço indisponível',
    title: 'Não conseguimos falar com o serviço',
    msg: 'Uma parte do sistema não respondeu. Normalmente é passageiro: tente novamente em alguns instantes.',
    primary: 'retry',
    secondary: 'home',
  },
  503: {
    kicker: 'Erro 503 · em manutenção',
    title: 'Estamos em manutenção',
    msg: 'O serviço está indisponível por pouco tempo enquanto atualizamos o sistema. Tente novamente em alguns minutos.',
    primary: 'retry',
    secondary: 'home',
  },
};

/**
 * Status que aparecem no popup: falha de UMA ação, com a tela de trás ainda
 * válida. Os erros de carregamento de rota (404, 502, 503) vão para a tela
 * cheia, onde não há nada a preservar atrás.
 */
export const DIALOG_STATUS_CODES = [400, 401, 403, 408, 500] as const;

export type DialogStatusCode = (typeof DIALOG_STATUS_CODES)[number];

/**
 * Cópia do popup (ErrorDialog). Mesmo kicker e título da tela cheia, mensagem
 * enxuta e ação primária que refaz a AÇÃO, não a página — a secundária é sempre
 * "Fechar", porque mandar para o início custaria o contexto do usuário.
 */
export const DIALOG_COPY: Record<DialogStatusCode, ErrorCopy> = {
  400: {
    kicker: PAGE_COPY[400].kicker,
    title: PAGE_COPY[400].title,
    msg: 'Alguma informação não está no formato que esperávamos. Revise os dados e envie de novo.',
    primary: 'review',
    secondary: null,
  },
  401: {
    kicker: PAGE_COPY[401].kicker,
    title: PAGE_COPY[401].title,
    msg: 'Por segurança, encerramos sessões inativas. Entre na sua conta para continuar.',
    primary: 'login',
    secondary: null,
  },
  403: {
    kicker: PAGE_COPY[403].kicker,
    title: 'Você não tem acesso a isso',
    msg: 'Sua conta não tem permissão para esta ação. Se acredita que deveria ter, fale com quem administra a conta.',
    primary: 'support',
    secondary: null,
  },
  408: {
    kicker: PAGE_COPY[408].kicker,
    title: PAGE_COPY[408].title,
    msg: 'A conexão levou mais tempo do que o esperado. Tente novamente em alguns instantes.',
    primary: 'retry',
    secondary: null,
  },
  500: {
    kicker: PAGE_COPY[500].kicker,
    title: 'Não conseguimos concluir agora',
    msg: 'O erro não foi causado por você e já foi registrado. Tente novamente em alguns instantes.',
    primary: 'retry',
    secondary: null,
  },
};

/** Rótulos dos botões, por ação. */
export const ACTION_LABELS: Record<ErrorAction, string> = {
  home: 'Voltar ao início',
  login: 'Fazer login',
  retry: 'Tentar novamente',
  support: 'Falar com o suporte',
  review: 'Revisar dados',
};

export const SUPPORT_EMAIL = 'suporte@yield2pay.com.br';

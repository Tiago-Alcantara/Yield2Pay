import type { AppEnv } from '@yield2pay/shared';

/**
 * Ambiente lógico do front. Espelha o APP_ENV da API — os dois precisam
 * concordar para o painel técnico ter dado para mostrar.
 */
export const APP_ENV: AppEnv =
  (process.env.NEXT_PUBLIC_APP_ENV as AppEnv | undefined) ?? 'development';

/**
 * Gate do painel técnico. É uma constante de módulo comparada com um literal
 * de propósito: o bundler substitui process.env.NEXT_PUBLIC_APP_ENV pelo valor
 * do build e elimina o ramo inteiro. Em produção o painel — e o stack trace que
 * ele mostra — não existem no bundle. Não trocar por flag de runtime, feature
 * flag remota ou prop booleana.
 */
export const SHOW_TECHNICAL_DETAILS = process.env.NEXT_PUBLIC_APP_ENV === 'staging';

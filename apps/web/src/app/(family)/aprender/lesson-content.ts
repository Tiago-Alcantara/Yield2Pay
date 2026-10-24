import type { LessonView } from '@yield2pay/shared';

/**
 * O texto fica em /aulas-cripto. O mp4 não cabe no app e o raw do GitHub
 * não faz streaming: o padrão é a CDN do jsDelivr, e
 * NEXT_PUBLIC_LESSON_VIDEO_BASE troca isso por um storage próprio.
 * String vazia desliga o vídeo.
 */
const CDN_VIDEO_BASE = 'https://cdn.jsdelivr.net/gh/Tiago-Alcantara/videos-cripto@main/videos';

function videoBase(): string | null {
  const configured = process.env.NEXT_PUBLIC_LESSON_VIDEO_BASE;
  if (configured === '') return null;
  return (configured || CDN_VIDEO_BASE).replace(/\/$/, '');
}

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
  durationSeconds: number;
  videoUrl?: string;
  captionsUrl?: string;
  posterUrl?: string;
  readUrl?: string;
  scenes: LessonScene[];
}

interface PublishedLesson {
  id: string;
  title: string;
  desc: string;
  durationSeconds: number;
  videoFolder: string;
  poster: string;
  page: string;
}

const PUBLISHED: PublishedLesson[] = [
  {
    id: 'beginner-1',
    title: 'O que é criptomoeda?',
    desc: 'Dinheiro que nasceu digital e funciona sem um banco no meio.',
    durationSeconds: 335,
    videoFolder: 'aula-01',
    poster: '/aulas-cripto/img/aula-01/capa.svg',
    page: '/aulas-cripto/aula-01-o-que-e-criptomoeda.html',
  },
  {
    id: 'beginner-2',
    title: 'Blockchain: o caderno que ninguém apaga',
    desc: 'Como milhares de computadores mantêm um registro único, público e muito difícil de fraudar.',
    durationSeconds: 295,
    videoFolder: 'aula-02',
    poster: '/aulas-cripto/img/aula-02/capa.svg',
    page: '/aulas-cripto/aula-02-blockchain.html',
  },
  {
    id: 'beginner-3',
    title: 'Carteira cripto: o que é e para que serve',
    desc: 'Ela não guarda moedas. Guarda as chaves que dão acesso a elas.',
    durationSeconds: 273,
    videoFolder: 'aula-03',
    poster: '/aulas-cripto/img/aula-03/capa.svg',
    page: '/aulas-cripto/aula-03-carteira-cripto.html',
  },
  {
    id: 'beginner-4',
    title: 'Chaves, endereço e frase de recuperação',
    desc: 'O que você pode compartilhar, o que nunca pode, e como não perder o acesso.',
    durationSeconds: 288,
    videoFolder: 'aula-04',
    poster: '/aulas-cripto/img/aula-04/capa.svg',
    page: '/aulas-cripto/aula-04-chaves-e-frase-de-recuperacao.html',
  },
  {
    id: 'beginner-5',
    title: 'Enviar e receber cripto, sem susto',
    desc: 'Rede, taxa e confirmação: o passo a passo de uma transferência segura.',
    durationSeconds: 293,
    videoFolder: 'aula-05',
    poster: '/aulas-cripto/img/aula-05/capa.svg',
    page: '/aulas-cripto/aula-05-enviar-e-receber.html',
  },
  {
    id: 'beginner-6',
    title: 'Segurança: como não cair em golpes',
    desc: 'Os golpes mais comuns em cripto e os hábitos simples que protegem o seu dinheiro.',
    durationSeconds: 293,
    videoFolder: 'aula-06',
    poster: '/aulas-cripto/img/aula-06/capa.svg',
    page: '/aulas-cripto/aula-06-seguranca-e-golpes.html',
  },
];

function present(lesson: PublishedLesson): PresentedLesson {
  const base = videoBase();
  return {
    id: lesson.id,
    title: lesson.title,
    desc: lesson.desc,
    durationSeconds: lesson.durationSeconds,
    videoUrl: base ? `${base}/${lesson.videoFolder}/brag.mp4` : undefined,
    captionsUrl: `/aulas-cripto/legenda/${lesson.videoFolder}.vtt`,
    posterUrl: lesson.poster,
    readUrl: lesson.page,
    scenes: [],
  };
}

const BY_ID = new Map(PUBLISHED.map((lesson) => [lesson.id, present(lesson)]));

export const CRIPTO_LESSONS: PresentedLesson[] = PUBLISHED.map(present);

export function lessonsForTrack(_track: 'beginner' | 'fund', apiLessons: LessonView[]): PresentedLesson[] {
  return apiLessons.map((lesson) => BY_ID.get(lesson.id) ?? {
    id: lesson.id,
    title: lesson.title,
    desc: 'O roteiro e o vídeo desta aula entram aqui.',
    durationSeconds: lesson.durationMinutes * 60,
    scenes: [],
  });
}

export function trackCopy(track: 'beginner' | 'fund'): { eyebrow: string; title: string; lede: string } {
  if (track === 'fund') {
    return {
      eyebrow: 'Aprender · Cripto',
      title: 'Cripto, um passo além',
      lede: 'A mesma trilha do zero, para quem quer revisar o básico.',
    };
  }
  return {
    eyebrow: 'Aprender · Cripto',
    title: 'Cripto do zero',
    lede: 'Seis aulas curtas. O texto fica nesta página, e o vídeo toca se o arquivo estiver num endereço que aceite streaming.',
  };
}

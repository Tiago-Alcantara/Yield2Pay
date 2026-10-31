'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, useSearchParams } from 'next/navigation';
import { LOCAL_DEV_TOKEN } from '../_lib/localSession';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { createHouseholdApi } from '../_lib/householdApi';
import {
  CRIPTO_LESSONS,
  lessonsForTrack,
  trackCopy,
  type PresentedLesson,
} from './lesson-content';
import { picksMatch, prepareLessonMarkup, type QuizQuestion } from './lesson-article';
import {
  aprenderPath,
  lessonDuration,
  missingLessonMessage,
  nextSpeed,
  openingLessonIndex,
  readPlayback,
  sceneIndex,
  seekTime,
  writePlayback,
} from './player';
import './aula.css';

type GetToken = () => Promise<string | null>;
type Track = 'beginner' | 'fund';

interface Playback {
  li: number;
  t: number;
  playing: boolean;
  open: boolean;
  speed: number;
  cc: boolean;
  done: boolean[];
  pos: number[];
  expanded: number;
}

interface Ready {
  kind: 'ready';
  track: Track;
  lessons: PresentedLesson[];
  playback: Playback;
  quizAnswers: Record<string, number[]>;
}

interface QuizGate {
  lessonId: string;
  ready: boolean;
  passed: boolean;
  picks: number[];
}

type Phase = { kind: 'loading' } | { kind: 'interest' } | { kind: 'error' } | Ready;

function lessonSeconds(lesson: PresentedLesson | undefined): number {
  if (!lesson) return 0;
  return lesson.durationSeconds > 0 ? lesson.durationSeconds : lessonDuration(lesson.scenes.length);
}

function lessonPosition(playback: Playback, index: number, lesson: PresentedLesson | undefined): number {
  const total = lessonSeconds(lesson);
  const raw = index === playback.li ? playback.t : playback.pos[index] ?? 0;
  return raw > 0 && raw < total ? raw : 0;
}

function statusOf(error: unknown): number {
  return typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status: number }).status)
    : 0;
}

export default function AulaCripto() {
  if (!isPrivyConfigured) {
    return <AulaScreen getToken={async () => LOCAL_DEV_TOKEN} />;
  }
  return <PrivyAula />;
}

function PrivyAula() {
  const { getAccessToken } = usePrivy();
  return <AulaScreen getToken={getAccessToken} />;
}

function AulaScreen({ getToken }: { getToken: GetToken }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const aulaQuery = searchParams.get('aula');
  const aulaRef = useRef(aulaQuery);
  aulaRef.current = aulaQuery;
  const replaceRef = useRef(router.replace);
  replaceRef.current = router.replace;
  const lastPath = useRef('');
  const saveChain = useRef(Promise.resolve());
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [saveError, setSaveError] = useState('');
  const [confirmUnmark, setConfirmUnmark] = useState(false);
  const [quizGate, setQuizGate] = useState<QuizGate | null>(null);
  const [scrollSteps, setScrollSteps] = useState(false);
  const stepsRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const lessonsRef = useRef<PresentedLesson[]>([]);

  const api = () => createHouseholdApi(() => getTokenRef.current());

  useEffect(() => {
    const client = api();
    let cancelled = false;
    (async () => {
      try {
        const profile = await client.getProfile().catch((error: unknown) => {
          if (statusOf(error) === 404) return null;
          throw error;
        });
        if (cancelled) return;
        if (profile?.cryptoExperience === 'declined') {
          setPhase({ kind: 'interest' });
          return;
        }
        const track: Track = profile?.cryptoExperience === 'fund' ? 'fund' : 'beginner';
        const [apiLessons, progress] = await Promise.all([
          client.getLessons(track),
          client.getLessonProgress(),
        ]);
        if (cancelled) return;
        const lessons = lessonsForTrack(track, apiLessons);
        const done = lessons.map((lesson) =>
          progress.some((row) => row.lessonId === lesson.id && row.completed),
        );
        const quizAnswers: Record<string, number[]> = {};
        for (const row of progress) {
          if (Array.isArray(row.answers)) quizAnswers[row.lessonId] = row.answers;
        }
        const saved = readPlayback(window.localStorage, lessons.length);
        const li = openingLessonIndex(aulaRef.current, lessons.length, done);
        const total = lessonSeconds(lessons[li]);
        const resume = saved.pos[li] ?? 0;
        setPhase({
          kind: 'ready',
          track,
          lessons,
          quizAnswers,
          playback: {
            li,
            t: resume >= total ? 0 : resume,
            playing: false,
            open: false,
            speed: 1,
            cc: true,
            done,
            pos: saved.pos,
            expanded: li,
          },
        });
      } catch {
        if (!cancelled) setPhase({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const requested = Number(aulaQuery);
    setConfirmUnmark(false);
    setPhase((current) => {
      if (current.kind !== 'ready') return current;
      if (!Number.isInteger(requested) || requested < 1 || requested > current.lessons.length) return current;
      const index = requested - 1;
      if (current.playback.li === index) return current;
      const total = lessonSeconds(current.lessons[index]);
      const saved = current.playback.pos[index] ?? 0;
      return {
        ...current,
        playback: {
          ...current.playback,
          li: index,
          expanded: index,
          t: saved >= total ? 0 : saved,
          playing: false,
          open: false,
        },
      };
    });
  }, [aulaQuery]);

  useEffect(() => {
    if (phase.kind !== 'ready') return;
    const next = aprenderPath(phase.playback.li + 1);
    if (lastPath.current === next) return;
    lastPath.current = next;
    if (searchParams.get('aula') === String(phase.playback.li + 1)) return;
    replaceRef.current(next, { scroll: false });
  }, [phase, searchParams]);

  const ready = phase.kind === 'ready' ? phase : null;
  lessonsRef.current = ready?.lessons ?? [];

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      setPhase((current) => {
        if (current.kind !== 'ready') return current;
        const playback = current.playback;
        if (!playback.playing || !playback.open) return current;
        if (lessonsRef.current[playback.li]?.videoUrl) return current;
        const count = lessonsRef.current[playback.li]?.scenes.length ?? 0;
        const total = lessonDuration(count);
        const t = Math.min(total, playback.t + 0.1 * playback.speed);
        return { ...current, playback: { ...playback, t, playing: t < total } };
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [ready?.kind]);

  useEffect(() => {
    if (!ready?.playback.open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeLesson();
      } else if (event.key === ' ' && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        togglePlay();
      } else if (event.key === 'ArrowRight') {
        stepScene(1);
      } else if (event.key === 'ArrowLeft') {
        stepScene(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
    };
  }, [ready?.playback.open, ready?.playback.li]);

  useEffect(() => {
    if (!scrollSteps || !ready?.playback.open) return;
    const id = window.setTimeout(() => {
      stepsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setScrollSteps(false);
    }, 60);
    return () => window.clearTimeout(id);
  }, [scrollSteps, ready?.playback.open]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      setPhase((current) => {
        if (current.kind !== 'ready') return current;
        const playback = current.playback;
        const total = lessonSeconds(current.lessons[playback.li]);
        const at = playback.t < total ? playback.t : 0;
        if ((playback.pos[playback.li] ?? 0) === at) return current;
        const pos = playback.pos.slice();
        pos[playback.li] = at;
        try {
          writePlayback(window.localStorage, { li: playback.li, pos });
        } catch {
          return current;
        }
        return { ...current, playback: { ...playback, pos } };
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [ready?.kind]);

  function patchPlayback(update: (playback: Playback, lessons: PresentedLesson[]) => Playback) {
    setPhase((current) => {
      if (current.kind !== 'ready') return current;
      return { ...current, playback: update(current.playback, current.lessons) };
    });
  }

  function rememberPosition(playback: Playback, lessons: PresentedLesson[]): number[] {
    const pos = playback.pos.slice();
    const total = lessonSeconds(lessons[playback.li]);
    pos[playback.li] = playback.t < total ? playback.t : 0;
    return pos;
  }

  function openLesson(index: number, play: boolean) {
    if (phase.kind === 'ready' && index >= 0 && index < phase.lessons.length) {
      const next = aprenderPath(index + 1);
      lastPath.current = next;
      if (searchParams.get('aula') !== String(index + 1)) {
        replaceRef.current(next, { scroll: false });
      }
    }
    setSaveError('');
    setConfirmUnmark(false);
    patchPlayback((playback, lessons) => {
      const pos = rememberPosition(playback, lessons);
      const total = lessonSeconds(lessons[index]);
      const saved = pos[index] ?? 0;
      const restart = play && playback.done[index];
      return {
        ...playback,
        pos,
        li: index,
        expanded: index,
        t: restart || saved >= total ? 0 : saved,
        open: false,
        playing: false,
      };
    });
  }

  function closeLesson() {
    patchPlayback((playback, lessons) => ({
      ...playback,
      pos: rememberPosition(playback, lessons),
      open: false,
      playing: false,
    }));
  }

  function togglePlay() {
    patchPlayback((playback, lessons) => {
      const total = lessonSeconds(lessons[playback.li]);
      if (playback.t >= total) return { ...playback, t: 0, playing: true };
      return { ...playback, playing: !playback.playing };
    });
  }

  function goToScene(index: number) {
    patchPlayback((playback, lessons) => ({
      ...playback,
      t: seekTime(index, lessons[playback.li]?.scenes.length ?? 0),
    }));
  }

  function stepScene(delta: number) {
    patchPlayback((playback, lessons) => {
      const count = lessons[playback.li]?.scenes.length ?? 0;
      const current = sceneIndex(playback.t, count);
      return { ...playback, t: seekTime(current + delta, count) };
    });
  }

  function rememberQuiz(lessonId: string, picks: number[]) {
    setPhase((current) => {
      if (current.kind !== 'ready') return current;
      return { ...current, quizAnswers: { ...current.quizAnswers, [lessonId]: picks } };
    });
  }

  function enqueueSave(lessonId: string, completed: boolean, picks: number[]): Promise<boolean> {
    const run = saveChain.current.then(async () => {
      try {
        await api().putLessonProgress(lessonId, completed, picks);
        return true;
      } catch (error) {
        setSaveError(statusOf(error) === 400
          ? 'Acerte todas as perguntas do teste para concluir esta aula.'
          : 'Não foi possível salvar o progresso. Tente de novo.');
        return false;
      }
    });
    saveChain.current = run.then(() => undefined, () => undefined);
    return run;
  }

  async function setCompleted(index: number, completed: boolean, picks: number[]): Promise<boolean> {
    if (phase.kind !== 'ready') return false;
    const lesson = phase.lessons[index];
    if (!lesson) return false;
    const saved = await enqueueSave(lesson.id, completed, picks);
    if (!saved) return false;
    setSaveError('');
    rememberQuiz(lesson.id, picks);
    patchPlayback((playback) => {
      const done = playback.done.slice();
      done[index] = completed;
      return { ...playback, done };
    });
    return true;
  }

  async function showInterest() {
    try {
      await api().patchProfile({ cryptoExperience: 'beginner' });
    } catch {
      setPhase({ kind: 'error' });
      return;
    }
    setPhase({
      kind: 'ready',
      track: 'beginner',
      lessons: CRIPTO_LESSONS,
      quizAnswers: {},
      playback: {
        li: 0,
        t: 0,
        playing: false,
        open: false,
        speed: 1,
        cc: true,
        done: CRIPTO_LESSONS.map(() => false),
        pos: CRIPTO_LESSONS.map(() => 0),
        expanded: 0,
      },
    });
  }

  async function completeCurrent(): Promise<boolean> {
    if (phase.kind !== 'ready') return false;
    const index = phase.playback.li;
    const lesson = phase.lessons[index];
    if (!lesson) return false;
    if (phase.playback.done[index]) return true;
    const gate = quizGate?.lessonId === lesson.id ? quizGate : null;
    if (!gate?.ready) {
      setSaveError('O teste desta aula ainda está carregando.');
      return false;
    }
    if (!gate.passed) {
      setSaveError('Acerte todas as perguntas do teste para concluir esta aula.');
      return false;
    }
    return setCompleted(index, true, gate.picks);
  }

  async function finishAndAdvance() {
    if (phase.kind !== 'ready') return;
    const index = phase.playback.li;
    const last = index >= phase.lessons.length - 1;
    const saved = await completeCurrent();
    if (!saved) return;
    if (!last) {
      openLesson(index + 1, true);
      return;
    }
    const done = phase.playback.done.map((item, itemIndex) => item || itemIndex === index);
    const message = missingLessonMessage(done.flatMap((item, itemIndex) => (item ? [] : [itemIndex + 1])));
    setSaveError(message ?? '');
  }

  async function unmarkCurrent() {
    if (phase.kind !== 'ready') return;
    const index = phase.playback.li;
    const lesson = phase.lessons[index];
    const picks = quizGate?.lessonId === lesson?.id ? quizGate.picks : phase.quizAnswers[lesson?.id ?? ''] ?? [];
    const saved = await setCompleted(index, false, picks);
    if (saved) setConfirmUnmark(false);
  }

  return (
    <div className="aula">
      <Shell>
        {phase.kind === 'loading' && <p className="aula-lede">Carregando aulas…</p>}
        {phase.kind === 'error' && (
          <div className="aula-empty">
            <p className="aula-error">Não foi possível carregar as aulas.</p>
            <a className="aula-back" href="/dashboard">Voltar ao painel</a>
          </div>
        )}
        {phase.kind === 'interest' && (
          <Interest onInterest={() => void showInterest()} />
        )}
        {phase.kind === 'ready' && (
          <Trail
            phase={phase}
            saveError={saveError}
            stepsRef={stepsRef}
            playerRef={playerRef}
            onExpand={(index) => patchPlayback((playback) => ({ ...playback, expanded: index }))}
            onStart={(index) => openLesson(index, true)}
            onRead={(index) => {
              openLesson(index, false);
              setScrollSteps(true);
            }}
            onClose={closeLesson}
            onToggle={togglePlay}
            onSeek={goToScene}
            onStep={stepScene}
            onSpeed={() => patchPlayback((playback) => ({ ...playback, speed: nextSpeed(playback.speed) }))}
            onCaption={() => patchPlayback((playback) => ({ ...playback, cc: !playback.cc }))}
            onWatch={(index) => {
              goToScene(index);
              patchPlayback((playback) => ({ ...playback, playing: true }));
              playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            onToggleDone={() => {
              if (phase.playback.done[phase.playback.li]) setConfirmUnmark(true);
              else void completeCurrent();
            }}
            confirmUnmark={confirmUnmark}
            onKeep={() => setConfirmUnmark(false)}
            onUnmark={() => void unmarkCurrent()}
            quizAnswers={phase.quizAnswers}
            onQuiz={setQuizGate}
            onAnswers={(picks) => {
              const lesson = phase.lessons[phase.playback.li];
              if (!lesson || phase.playback.done[phase.playback.li]) return;
              rememberQuiz(lesson.id, picks);
              void enqueueSave(lesson.id, false, picks);
            }}
            onPrevious={() => {
              if (phase.kind !== 'ready' || phase.playback.li <= 0) return;
              openLesson(phase.playback.li - 1, false);
            }}
            onNext={() => void finishAndAdvance()}
            onProgress={(seconds) => patchPlayback((playback) => ({ ...playback, t: seconds }))}
            onSelect={(index) => openLesson(index, false)}
          />
        )}
      </Shell>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="aula-main" data-screen-label="Aprender">
      <div className="aula-top">
        <a className="aula-brand" href="/dashboard">
          <span className="aula-mark" />
          Yield2Pay
        </a>
        <a className="aula-back" href="/dashboard">← Painel da família</a>
      </div>
      {children}
    </main>
  );
}

function Interest({ onInterest }: { onInterest: () => void }) {
  return (
    <>
      <header>
        <div className="aula-kicker">Aprender · Cripto</div>
        <h1>Quando fizer sentido</h1>
        <p className="aula-lede">
          Preparamos uma trilha curta e sem jargão sobre cripto e liberdade financeira. Ela libera o acesso ao investimento quando você quiser.
        </p>
      </header>
      <div className="aula-empty">
        <button type="button" className="aula-primary" onClick={onInterest}>Tenho interesse</button>
      </div>
    </>
  );
}

function Trail({
  phase,
  saveError,
  stepsRef,
  playerRef,
  onExpand,
  onStart,
  onRead,
  onClose,
  onToggle,
  onSeek,
  onStep,
  onSpeed,
  onCaption,
  onWatch,
  onToggleDone,
  confirmUnmark,
  onKeep,
  onUnmark,
  quizAnswers,
  onQuiz,
  onAnswers,
  onPrevious,
  onNext,
  onProgress,
  onSelect,
}: {
  phase: Ready;
  saveError: string;
  stepsRef: RefObject<HTMLDivElement | null>;
  playerRef: RefObject<HTMLDivElement | null>;
  onExpand: (index: number) => void;
  onStart: (index: number) => void;
  onRead: (index: number) => void;
  onClose: () => void;
  onToggle: () => void;
  onSeek: (index: number) => void;
  onStep: (delta: number) => void;
  onSpeed: () => void;
  onCaption: () => void;
  onWatch: (index: number) => void;
  onToggleDone: () => void;
  confirmUnmark: boolean;
  onKeep: () => void;
  onUnmark: () => void;
  quizAnswers: Record<string, number[]>;
  onQuiz: (gate: QuizGate) => void;
  onAnswers: (picks: number[]) => void;
  onPrevious: () => void;
  onNext: () => void;
  onProgress: (seconds: number) => void;
  onSelect: (index: number) => void;
}) {
  const { lessons, playback, track } = phase;
  const copy = trackCopy(track);
  const allDone = playback.done.length > 0 && playback.done.every(Boolean);
  const lesson = lessons[playback.li];

  return (
    <>
      <header>
        <div className="aula-kicker">{copy.eyebrow} · {lessons.length} aulas</div>
        <h1>{copy.title}</h1>
        <p className="aula-lede">{copy.lede}</p>
        {allDone && (
          <p className="aula-unlocked">Trilha concluída. O acesso ao investimento em cripto está liberado.</p>
        )}
      </header>
      <nav className="aula-switch" aria-label="Aulas">
        {lessons.map((item, index) => (
          <button
            key={item.id}
            type="button"
            aria-current={index === playback.li ? 'true' : undefined}
            onClick={() => onSelect(index)}
          >
            <span>{playback.done[index] ? '✓' : index + 1}</span>
            {item.title}
          </button>
        ))}
      </nav>
      {lesson?.readUrl && (
        <LessonPage
          lesson={lesson}
          index={playback.li}
          totalLessons={lessons.length}
          done={playback.done[playback.li] ?? false}
          startAt={playback.t}
          saveError={saveError}
          savedAnswers={quizAnswers[lesson.id]}
          confirmUnmark={confirmUnmark}
          onProgress={onProgress}
          onToggleDone={onToggleDone}
          onKeep={onKeep}
          onUnmark={onUnmark}
          onQuiz={onQuiz}
          onAnswers={onAnswers}
          onPrevious={onPrevious}
          onNext={onNext}
          onOpenRead={(file) => {
            const index = lessons.findIndex((item) => item.readUrl?.endsWith(file));
            if (index >= 0) onSelect(index);
          }}
        />
      )}
    </>
  );
}

function LessonPage({
  lesson,
  index,
  totalLessons,
  done,
  startAt,
  saveError,
  savedAnswers,
  confirmUnmark,
  onProgress,
  onToggleDone,
  onKeep,
  onUnmark,
  onQuiz,
  onAnswers,
  onPrevious,
  onNext,
  onOpenRead,
}: {
  lesson: PresentedLesson;
  index: number;
  totalLessons: number;
  done: boolean;
  startAt: number;
  saveError: string;
  savedAnswers: number[] | undefined;
  confirmUnmark: boolean;
  onProgress: (seconds: number) => void;
  onToggleDone: () => void;
  onKeep: () => void;
  onUnmark: () => void;
  onQuiz: (gate: QuizGate) => void;
  onAnswers: (picks: number[]) => void;
  onPrevious: () => void;
  onNext: () => void;
  onOpenRead: (file: string) => void;
}) {
  return (
    <article className="aula-lesson">
      <div className="aula-kicker" aria-label="Aula atual">Aula {index + 1} de {totalLessons}</div>
      <h2>{lesson.title}</h2>
      <p className="aula-lede">{lesson.desc}</p>
      <LessonVideo lesson={lesson} startAt={startAt} onProgress={onProgress} />
      {lesson.readUrl && (
        <LessonReading
          lessonId={lesson.id}
          url={lesson.readUrl}
          saved={savedAnswers}
          locked={done}
          onOpenRead={onOpenRead}
          onQuiz={onQuiz}
          onAnswers={onAnswers}
        />
      )}
      <div className="aula-foot">
        <span />
        <div className="aula-foot-actions">
          <button type="button" className="aula-next" onClick={onPrevious} disabled={index === 0}>
            Aula anterior
          </button>
          {done && confirmUnmark ? (
            <div className="aula-confirm">
              <p>Desmarcar esta aula? Ela sai da trilha e o investimento fica bloqueado até você concluir tudo de novo.</p>
              <button type="button" className="aula-done" onClick={onUnmark}>Desmarcar</button>
              <button type="button" className="aula-next" onClick={onKeep}>Manter concluída</button>
            </div>
          ) : (
            <button type="button" className="aula-done" onClick={onToggleDone}>
              {done ? 'Concluída ✓' : 'Marcar como concluída'}
            </button>
          )}
          <button type="button" className="aula-next aula-primary" onClick={onNext}>
            {index === totalLessons - 1 ? 'Concluir trilha' : 'Próxima aula'}
          </button>
        </div>
      </div>
      {saveError && <p className="aula-error" role="alert">{saveError}</p>}
    </article>
  );
}

function LessonVideo({
  lesson,
  startAt,
  onProgress,
}: {
  lesson: PresentedLesson;
  startAt: number;
  onProgress: (seconds: number) => void;
}) {
  const [failed, setFailed] = useState(false);
  if (!lesson.videoUrl || failed) {
    return (
      <p className="aula-video-missing" role="status">
        O vídeo desta aula não está no ar. O arquivo precisa estar num CDN ou num storage que aceite streaming. A leitura segue abaixo.
      </p>
    );
  }
  return (
    <video
      key={lesson.id}
      className="aula-video"
      controls
      playsInline
      preload="metadata"
      poster={lesson.posterUrl}
      src={lesson.videoUrl}
      crossOrigin="anonymous"
      aria-label="Vídeo da aula"
      onError={() => setFailed(true)}
      onLoadedMetadata={(event) => {
        const video = event.currentTarget;
        if (startAt > 1 && startAt < video.duration) video.currentTime = startAt;
      }}
      onTimeUpdate={(event) => onProgress(event.currentTarget.currentTime)}
    >
      {lesson.captionsUrl && (
        <track kind="captions" srcLang="pt-BR" label="Português" src={lesson.captionsUrl} default />
      )}
    </video>
  );
}

function LessonReading({
  lessonId,
  url,
  saved,
  locked,
  onOpenRead,
  onQuiz,
  onAnswers,
}: {
  lessonId: string;
  url: string;
  saved: number[] | undefined;
  locked: boolean;
  onOpenRead: (file: string) => void;
  onQuiz: (gate: QuizGate) => void;
  onAnswers: (picks: number[]) => void;
}) {
  const openRef = useRef(onOpenRead);
  openRef.current = onOpenRead;
  const quizRef = useRef(onQuiz);
  quizRef.current = onQuiz;
  const [markup, setMarkup] = useState<{ css: string; html: string; quiz: QuizQuestion[] } | null>(null);
  const [picks, setPicks] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    setMarkup(null);
    quizRef.current({ lessonId, ready: false, passed: false, picks: [] });
    fetch(url)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error('aula'))))
      .then((source) => {
        if (cancelled) return;
        setMarkup(prepareLessonMarkup(source));
      })
      .catch(() => {
        if (cancelled) return;
        setMarkup(null);
        quizRef.current({ lessonId, ready: true, passed: false, picks: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [lessonId, url]);

  useEffect(() => {
    if (!markup) return;
    setPicks(saved && saved.length === markup.quiz.length ? [...saved] : markup.quiz.map(() => -1));
  }, [markup, saved]);

  useEffect(() => {
    if (!markup) return;
    quizRef.current({
      lessonId,
      ready: true,
      passed: picksMatch(markup.quiz, picks),
      picks,
    });
  }, [lessonId, markup, picks]);

  function onArticleClick(event: React.MouseEvent<HTMLDivElement>) {
    const link = (event.target as HTMLElement).closest('a');
    if (link instanceof HTMLAnchorElement && (link.getAttribute('href') ?? '').endsWith('.html')) {
      event.preventDefault();
      openRef.current(link.getAttribute('href') ?? '');
    }
  }

  function choose(index: number, choice: number) {
    if (locked || !markup) return;
    const next = markup.quiz.map((_, option) => picks[option] ?? -1);
    next[index] = choice;
    setPicks(next);
    onAnswers(next);
  }

  if (!markup) return null;
  const correct = markup.quiz.filter((question, index) => picks[index] === question.answer).length;
  return (
    <div className="aula-texto" onClick={onArticleClick}>
      <div dangerouslySetInnerHTML={{ __html: `<style>${markup.css.replace(/<\/style/gi, '<\\/style')}</style>${markup.html}` }} />
      {markup.quiz.length > 0 && (
        <div className="quiz">
          <div className="eyebrow">Teste rápido</div>
          <h2>Confira o que ficou</h2>
          <p className="aula-quiz-score">{correct} de {markup.quiz.length} certas. Acerte todas para concluir a aula.</p>
          {markup.quiz.map((question, questionIndex) => {
            const picked = picks[questionIndex];
            const answered = picked >= 0;
            return (
              <div key={question.prompt} className={answered ? 'card q done' : 'card q'}>
                <p className="qq">{question.prompt}</p>
                <div className="opts">
                  {question.options.map((option, optionIndex) => (
                    <button
                      key={option.letter}
                      type="button"
                      className={answered ? (optionIndex === question.answer ? 'ok' : 'no') : undefined}
                      aria-pressed={picked === optionIndex}
                      disabled={locked}
                      onClick={() => choose(questionIndex, optionIndex)}
                    >
                      <span className="l">{option.letter}</span>
                      <span>{option.text}</span>
                    </button>
                  ))}
                </div>
                {answered && (
                  <p className="why">
                    <strong>{picked === question.answer ? 'Acertou. ' : 'Não foi essa. '}</strong>
                    {question.why}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

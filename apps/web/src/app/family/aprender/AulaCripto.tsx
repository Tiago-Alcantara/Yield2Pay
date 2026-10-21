'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSearchParams } from 'next/navigation';
import { LOCAL_DEV_TOKEN } from '../_lib/localSession';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { createHouseholdApi } from '../_lib/householdApi';
import {
  CRIPTO_LESSONS,
  lessonsForTrack,
  trackCopy,
  type PresentedLesson,
} from './lesson-content';
import { prepareLessonMarkup } from './lesson-article';
import {
  firstOpenIndex,
  formatClock,
  lessonDuration,
  nextSpeed,
  readPlayback,
  sceneIndex,
  seekTime,
  segmentFill,
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
  const searchParams = useSearchParams();
  const aulaQuery = searchParams.get('aula');
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [saveError, setSaveError] = useState('');
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
        const saved = readPlayback(window.localStorage, lessons.length);
        const requested = Number(aulaQuery);
        const expanded = requested >= 1 && requested <= lessons.length ? requested - 1 : firstOpenIndex(done);
        const total = lessonSeconds(lessons[saved.li]);
        const resume = saved.pos[saved.li] ?? 0;
        setPhase({
          kind: 'ready',
          track,
          lessons,
          playback: {
            li: saved.li,
            t: resume >= total ? 0 : resume,
            playing: false,
            open: false,
            speed: 1,
            cc: true,
            done,
            pos: saved.pos,
            expanded,
          },
        });
      } catch {
        if (!cancelled) setPhase({ kind: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aulaQuery]);

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
        const pos = playback.pos.slice();
        pos[playback.li] = playback.t < total ? playback.t : 0;
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
    setSaveError('');
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

  async function setCompleted(index: number, completed: boolean): Promise<boolean> {
    if (phase.kind !== 'ready') return false;
    const lesson = phase.lessons[index];
    if (!lesson) return false;
    try {
      await api().putLessonProgress(lesson.id, completed);
    } catch {
      setSaveError('Não foi possível salvar o progresso. Tente de novo.');
      return false;
    }
    setSaveError('');
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

  async function finishAndAdvance() {
    if (phase.kind !== 'ready') return;
    const index = phase.playback.li;
    const last = index >= phase.lessons.length - 1;
    const saved = await setCompleted(index, true);
    if (!saved) return;
    if (last) closeLesson();
    else openLesson(index + 1, true);
  }

  return (
    <div className="aula">
      <Shell>
        {phase.kind === 'loading' && <p className="aula-lede">Carregando aulas…</p>}
        {phase.kind === 'error' && (
          <div className="aula-empty">
            <p className="aula-error">Não foi possível carregar as aulas.</p>
            <a className="aula-back" href="/family/dashboard">Voltar ao painel</a>
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
            onToggleDone={() => void setCompleted(phase.playback.li, !phase.playback.done[phase.playback.li])}
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
        <a className="aula-brand" href="/family/dashboard">
          <span className="aula-mark" />
          Yield2Pay
        </a>
        <a className="aula-back" href="/family/dashboard">← Painel da família</a>
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
          onProgress={onProgress}
          onToggleDone={onToggleDone}
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
  onProgress,
  onToggleDone,
  onNext,
  onOpenRead,
}: {
  lesson: PresentedLesson;
  index: number;
  totalLessons: number;
  done: boolean;
  startAt: number;
  saveError: string;
  onProgress: (seconds: number) => void;
  onToggleDone: () => void;
  onNext: () => void;
  onOpenRead: (file: string) => void;
}) {
  return (
    <article className="aula-lesson">
      <div className="aula-kicker">Aula {index + 1} de {totalLessons}</div>
      <h2>{lesson.title}</h2>
      <p className="aula-lede">{lesson.desc}</p>
      <video
        key={lesson.id}
        className="aula-video"
        controls
        playsInline
        preload="metadata"
        poster={lesson.posterUrl}
        src={lesson.videoUrl}
        aria-label="Vídeo da aula"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (startAt > 1 && startAt < video.duration) video.currentTime = startAt;
        }}
        onTimeUpdate={(event) => onProgress(event.currentTarget.currentTime)}
      />
      {lesson.readUrl && <LessonReading url={lesson.readUrl} onOpenRead={onOpenRead} />}
      <div className="aula-foot">
        <span />
        <div className="aula-foot-actions">
          <button type="button" className="aula-done" onClick={onToggleDone}>
            {done ? 'Concluída ✓' : 'Marcar como concluída'}
          </button>
          <button type="button" className="aula-next aula-primary" onClick={onNext}>
            {index === totalLessons - 1 ? 'Concluir trilha' : 'Próxima aula'}
          </button>
        </div>
      </div>
      {saveError && <p className="aula-error">{saveError}</p>}
    </article>
  );
}

function LessonReading({ url, onOpenRead }: { url: string; onOpenRead: (file: string) => void }) {
  const openRef = useRef(onOpenRead);
  openRef.current = onOpenRead;
  const [markup, setMarkup] = useState<{ css: string; html: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMarkup(null);
    fetch(url)
      .then((response) => (response.ok ? response.text() : Promise.reject(new Error('aula'))))
      .then((source) => {
        if (cancelled) return;
        setMarkup(prepareLessonMarkup(source));
      })
      .catch(() => {
        if (!cancelled) setMarkup(null);
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  function onArticleClick(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    const question = button?.closest('.q');
    if (button && question instanceof HTMLElement) {
      const answer = Number(question.getAttribute('data-answer'));
      question.querySelectorAll<HTMLButtonElement>('button').forEach((option) => {
        const choice = Number(option.getAttribute('data-i'));
        option.classList.toggle('ok', choice === answer);
        option.classList.toggle('no', choice !== answer);
        option.setAttribute('aria-pressed', String(option === button));
      });
      question.classList.add('done');
    }
    const link = target.closest('a');
    if (link instanceof HTMLAnchorElement && (link.getAttribute('href') ?? '').endsWith('.html')) {
      event.preventDefault();
      openRef.current(link.getAttribute('href') ?? '');
    }
  }

  if (!markup) return null;
  return (
    <div className="aula-texto" onClick={onArticleClick}>
      <style>{markup.css}</style>
      <div dangerouslySetInnerHTML={{ __html: markup.html }} />
    </div>
  );
}

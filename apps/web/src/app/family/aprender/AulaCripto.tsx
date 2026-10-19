'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useSearchParams } from 'next/navigation';
import { isPrivyConfigured } from '@/providers/PrivyProviderWrapper';
import { createHouseholdApi } from '../_lib/householdApi';
import {
  CRIPTO_LESSONS,
  lessonsForTrack,
  trackCopy,
  type PresentedLesson,
} from './lesson-content';
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

function lessonPosition(playback: Playback, index: number, sceneCount: number): number {
  const total = lessonDuration(sceneCount);
  const raw = index === playback.li ? playback.t : playback.pos[index] ?? 0;
  return raw > 0 && raw < total ? raw : 0;
}

export default function AulaCripto() {
  if (!isPrivyConfigured) {
    return <AulaScreen getToken={async () => null} />;
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
        const profile = await client.getProfile();
        if (cancelled) return;
        if (profile.cryptoExperience === 'declined') {
          setPhase({ kind: 'interest' });
          return;
        }
        const track: Track = profile.cryptoExperience === 'fund' ? 'fund' : 'beginner';
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
        const total = lessonDuration(lessons[saved.li]?.scenes.length ?? 0);
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
        const total = lessonDuration(current.lessons[playback.li]?.scenes.length ?? 0);
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
    const total = lessonDuration(lessons[playback.li]?.scenes.length ?? 0);
    pos[playback.li] = playback.t < total ? playback.t : 0;
    return pos;
  }

  function openLesson(index: number, play: boolean) {
    setSaveError('');
    patchPlayback((playback, lessons) => {
      const pos = rememberPosition(playback, lessons);
      const total = lessonDuration(lessons[index]?.scenes.length ?? 0);
      const saved = pos[index] ?? 0;
      const restart = play && playback.done[index];
      return {
        ...playback,
        pos,
        li: index,
        expanded: index,
        t: restart || saved >= total ? 0 : saved,
        open: true,
        playing: play,
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
      const total = lessonDuration(lessons[playback.li]?.scenes.length ?? 0);
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
}) {
  const { lessons, playback, track } = phase;
  const copy = trackCopy(track);
  const current = firstOpenIndex(playback.done);
  const allDone = playback.done.length > 0 && playback.done.every(Boolean);
  const lesson = lessons[playback.li];
  const scenes = lesson?.scenes ?? [];
  const total = lessonDuration(scenes.length);
  const sceneAt = sceneIndex(playback.t, scenes.length);
  const scene = scenes[sceneAt];

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
      <section className="aula-track" aria-label="Aulas">
        {lessons.map((item, index) => {
          const itemTotal = lessonDuration(item.scenes.length);
          const watched = lessonPosition(playback, index, item.scenes.length);
          const started = watched > 0;
          const done = playback.done[index];
          const isCurrent = index === current && !allDone;
          const expanded = index === playback.expanded;
          const status = done ? 'concluída' : formatClock(itemTotal);
          return (
            <div className="aula-row" key={item.id}>
              <div className="aula-rail">
                <span className={done ? 'aula-node is-done' : isCurrent ? 'aula-node is-current' : 'aula-node is-todo'}>
                  {done ? '✓' : index + 1}
                </span>
                {index < lessons.length - 1 && <span className={done ? 'aula-line is-on' : 'aula-line'} />}
              </div>
              {expanded ? (
                <article className="aula-card">
                  <div className="aula-card-kicker">
                    Aula {index + 1} · {isCurrent ? 'você está aqui' : done ? 'concluída' : `${formatClock(itemTotal)} · ${item.scenes.length} passos`}
                  </div>
                  <h2>{item.title}</h2>
                  <p>{item.desc}</p>
                  {started && (
                    <div className="aula-meter">
                      <span className="aula-meter-track"><b style={{ width: `${(watched / itemTotal) * 100}%` }} /></span>
                      <span className="aula-meter-time">{formatClock(watched)} / {formatClock(itemTotal)}</span>
                    </div>
                  )}
                  <div className="aula-actions">
                    <button type="button" className="aula-primary" onClick={() => onStart(index)}>
                      ▶ {done ? 'Assistir de novo' : started ? 'Continuar aula' : 'Assistir aula'}
                    </button>
                    <button type="button" className="aula-ghost" onClick={() => onRead(index)}>Ler passo a passo</button>
                  </div>
                </article>
              ) : (
                <button type="button" className="aula-collapsed" onClick={() => onExpand(index)}>
                  <div className="aula-status">Aula {index + 1} · {status}</div>
                  <div className={done ? 'aula-collapsed-title is-done' : 'aula-collapsed-title is-open'}>{item.title}</div>
                </button>
              )}
            </div>
          );
        })}
      </section>
      {playback.open && lesson && scene && (
        <div
          className="aula-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Aula"
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <div className="aula-dialog">
            <div className="aula-dialog-head">
              <div>
                <div className="aula-kicker">Aula {playback.li + 1} de {lessons.length} · {copy.title}</div>
                <h2>{lesson.title}</h2>
              </div>
              <button type="button" className="aula-close" aria-label="Fechar" onClick={onClose}>×</button>
            </div>
            <div className="aula-stage-wrap" ref={playerRef}>
              <div className="aula-stage">
                <div className="aula-screen" onClick={onToggle}>
                  {scenes.map((item, index) => {
                    const local = Math.min(1, Math.max(0, (playback.t - index * 8) / 8));
                    const active = index === sceneAt;
                    const scale = index < sceneAt ? 1.06 : active ? 1 + 0.06 * local : 1;
                    return (
                      <div key={item.kicker} className="aula-scene" style={{ opacity: active ? 1 : 0 }}>
                        <div className="aula-scene-inner" style={{ transform: `scale(${scale})` }}>
                          {item.img ? (
                            <img src={item.img} alt={item.kicker} />
                          ) : (
                            <div className="aula-placeholder">
                              <small>{String(index + 1).padStart(2, '0')} · {item.kicker}</small>
                              <div className="aula-fig">{item.fig}</div>
                              <p>{item.sub}</p>
                              <div className="aula-chips">
                                {item.chips.map((chip, chipIndex) => (
                                  <span className="aula-chip" key={`${chip}-${chipIndex}`}>{chip}</span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {playback.cc && (
                    <div className="aula-caption"><span>{scene.cap}</span></div>
                  )}
                  {!playback.playing && (
                    <div className="aula-paused"><span>▶</span></div>
                  )}
                </div>
                <div className="aula-controls">
                  <div className="aula-segs">
                    {scenes.map((item, index) => (
                      <button key={item.kicker} type="button" className="aula-seg" aria-label={`Ir para ${item.kicker}`} onClick={() => onSeek(index)}>
                        <span><b style={{ width: `${segmentFill(playback.t, index, scenes.length)}%` }} /></span>
                      </button>
                    ))}
                  </div>
                  <div className="aula-control-row">
                    <button type="button" className="aula-play" aria-label={playback.playing ? 'Pausar' : 'Reproduzir'} onClick={onToggle}>
                      {playback.playing ? '❚❚' : playback.t >= total ? '↺' : '▶'}
                    </button>
                    <span className="aula-time">{formatClock(playback.t)} / {formatClock(total)}</span>
                    <span className="aula-scene-label">{String(sceneAt + 1).padStart(2, '0')} · {scene.kicker}</span>
                    <button type="button" className="aula-icon" aria-label="Ilustração anterior" onClick={() => onStep(-1)}>‹</button>
                    <button type="button" className="aula-icon" aria-label="Próxima ilustração" onClick={() => onStep(1)}>›</button>
                    <button type="button" className="aula-pill" onClick={onSpeed}>{playback.speed}×</button>
                    <button type="button" className={playback.cc ? 'aula-pill is-on' : 'aula-pill'} aria-pressed={playback.cc} onClick={onCaption}>
                      {playback.cc ? 'Legenda on' : 'Legenda off'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="aula-steps-head" ref={stepsRef}>
              <div className="aula-steps-label">Prefere ler? A aula em passos</div>
              <span className="aula-count">{scenes.length} ilustrações · {formatClock(total)}</span>
            </div>
            <div className="aula-steps">
              {scenes.map((item, index) => {
                const active = index === sceneAt;
                const state = active
                  ? playback.playing ? 'tocando agora' : 'no vídeo agora'
                  : index < sceneAt ? 'vista' : `em ${formatClock(index * 8)}`;
                const figure = (
                  <div className="aula-step-fig">
                    {item.img ? <img src={item.img} alt={item.kicker} /> : <em>Ilustração {String(index + 1).padStart(2, '0')}</em>}
                    <i><b style={{ width: `${segmentFill(playback.t, index, scenes.length)}%` }} /></i>
                  </div>
                );
                const copyBlock = (
                  <div className="aula-step-copy">
                    <span className="aula-num">{String(index + 1).padStart(2, '0')}</span>
                    <div className="aula-status">{state}</div>
                    <h3>{item.kicker}</h3>
                    <p>{item.cap}</p>
                    <button type="button" className="aula-jump" onClick={() => onWatch(index)}>
                      ▶ Ver no vídeo · {formatClock(index * 8)}
                    </button>
                  </div>
                );
                const flipped = index % 2 === 1;
                return (
                  <article
                    key={item.kicker}
                    className={flipped ? 'aula-step is-flip' : 'aula-step'}
                    style={{ opacity: active || !playback.playing ? 1 : 0.55 }}
                  >
                    {flipped ? copyBlock : figure}
                    {flipped ? figure : copyBlock}
                  </article>
                );
              })}
            </div>
            <div className="aula-foot">
              <button type="button" className="aula-later" onClick={onClose}>Ver depois</button>
              <div className="aula-foot-actions">
                <button type="button" className="aula-done" onClick={onToggleDone}>
                  {playback.done[playback.li] ? 'Concluída ✓' : 'Marcar como concluída'}
                </button>
                <button type="button" className="aula-next aula-primary" onClick={onNext}>
                  {playback.li === lessons.length - 1 ? 'Concluir trilha' : 'Próxima aula'}
                </button>
              </div>
            </div>
            {saveError && <p className="aula-error" style={{ padding: '0 24px 18px' }}>{saveError}</p>}
          </div>
        </div>
      )}
    </>
  );
}

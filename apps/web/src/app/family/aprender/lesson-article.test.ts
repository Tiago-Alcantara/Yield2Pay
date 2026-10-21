import { readFileSync } from 'node:fs';
import { prepareLessonMarkup } from './lesson-article';

const page = `<!doctype html><html><head><style>
html.leitura .video{display:none}
:root{--ink:#fff}
body{margin:0}
h1,h2{margin:0}
@media (max-width:860px){.hero .wrap{grid-template-columns:1fr}}
@keyframes sweepX{0%{opacity:0}100%{opacity:1}}
</style></head><body>
<header class="top">menu</header>
<div class="hero"><h1>O que é criptomoeda?</h1></div>
<main><p>Dinheiro que nasceu digital</p></main>
<div class="video">Assista à versão em vídeo</div>
<footer>rodapé</footer>
</body></html>`;

it('coloca o texto da aula na página e tira o que não é leitura', () => {
  const markup = prepareLessonMarkup(page);
  expect(markup).not.toBeNull();
  expect(markup?.html).toContain('Dinheiro que nasceu digital');
  expect(markup?.html).toContain('O que é criptomoeda?');
  expect(markup?.html).not.toContain('Assista à versão em vídeo');
  expect(markup?.html).not.toContain('menu');
  expect(markup?.html).not.toContain('rodapé');
  expect(markup?.css).toContain('.aula-texto{--ink:#fff}');
  expect(markup?.css).toContain('.aula-texto h1,.aula-texto h2{margin:0}');
  expect(markup?.css).toContain('@media (max-width:860px){.aula-texto .hero .wrap{grid-template-columns:1fr}}');
  expect(markup?.css).toContain('@keyframes sweepX{0%{opacity:0}100%{opacity:1}}');
  expect(markup?.css).not.toContain('.leitura');
});

it('ignora um arquivo que não é aula', () => {
  expect(prepareLessonMarkup('<p>oi</p>')).toBeNull();
});

it('prepara a aula publicada', () => {
  const source = readFileSync('public/aulas-cripto/aula-01-o-que-e-criptomoeda.html', 'utf8');
  const markup = prepareLessonMarkup(source);
  expect(markup?.html).toContain('nasceu digital');
  expect(markup?.html).not.toContain('Assista à versão em vídeo');
  expect(markup?.html).not.toContain('querySelectorAll');
  expect(markup?.css.startsWith('.aula-texto')).toBe(true);
});

/**
 * Módulo: lesson-article
 * Criado em: 2026-10-21
 * Última atualização: 2026-10-22
 * Intuito: O HTML da aula vira texto de leitura, na ordem publicada, com o gabarito.
 * Sequência: coloca o texto da aula na página e tira o que não é leitura; ignora um arquivo que não é aula; prepara a aula publicada; numera as seis aulas e mantém o gabarito publicado.
 */
import { readFileSync } from "node:fs";
import { LESSON_QUIZ_ANSWERS } from "@yield2pay/shared";
import { prepareLessonMarkup } from "./lesson-article";

const PUBLISHED: Record<string, string> = {
  "beginner-1": "aula-01-o-que-e-criptomoeda.html",
  "beginner-2": "aula-02-blockchain.html",
  "beginner-3": "aula-03-carteira-cripto.html",
  "beginner-4": "aula-04-chaves-e-frase-de-recuperacao.html",
  "beginner-5": "aula-05-enviar-e-receber.html",
  "beginner-6": "aula-06-seguranca-e-golpes.html",
};

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

describe("lesson-article", () => {
  it("coloca o texto da aula na página e tira o que não é leitura", () => {
    const markup = prepareLessonMarkup(page);
    expect(markup).not.toBeNull();
    expect(markup?.html).toContain("Dinheiro que nasceu digital");
    expect(markup?.html).toContain("O que é criptomoeda?");
    expect(markup?.html).not.toContain("Assista à versão em vídeo");
    expect(markup?.html).not.toContain("menu");
    expect(markup?.html).not.toContain("rodapé");
    expect(markup?.css).toContain(".aula-texto{--ink:#fff}");
    expect(markup?.css).toContain(".aula-texto h1,.aula-texto h2{margin:0}");
    expect(markup?.css).toContain(
      "@media (max-width:860px){.aula-texto .hero .wrap{grid-template-columns:1fr}}",
    );
    expect(markup?.css).toContain(
      "@keyframes sweepX{0%{opacity:0}100%{opacity:1}}",
    );
    expect(markup?.css).not.toContain(".leitura");
  });

  it("ignora um arquivo que não é aula", () => {
    expect(prepareLessonMarkup("<p>oi</p>")).toBeNull();
  });

  it("prepara a aula publicada", () => {
    const source = readFileSync(
      "public/aulas-cripto/aula-01-o-que-e-criptomoeda.html",
      "utf8",
    );
    const markup = prepareLessonMarkup(source);
    expect(markup?.html).toContain("nasceu digital");
    expect(markup?.html).not.toContain("Assista à versão em vídeo");
    expect(markup?.html).not.toContain("querySelectorAll");
    expect(markup?.html).not.toContain("data-answer");
    expect(markup?.quiz.map((question) => question.answer)).toEqual([1, 0, 2]);
    expect(markup?.css.startsWith(".aula-texto")).toBe(true);
  });

  it("numera as seis aulas e mantém o gabarito publicado", () => {
    for (const [id, file] of Object.entries(PUBLISHED)) {
      const source = readFileSync(`public/aulas-cripto/${file}`, "utf8");
      const markup = prepareLessonMarkup(source);
      expect(source).not.toContain("de 07");
      expect(source).toContain(`Aula ${file.slice(5, 7)} de 06`);
      expect(source).toContain('kind="captions"');
      expect(source).not.toContain("aula-07-vault-defindex.html");
      expect(markup?.quiz.map((question) => question.answer)).toEqual([
        ...LESSON_QUIZ_ANSWERS[id],
      ]);
    }
  });
});

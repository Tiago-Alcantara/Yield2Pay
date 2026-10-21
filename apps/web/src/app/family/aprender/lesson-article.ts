const SCOPE = '.aula-texto';

export function prepareLessonMarkup(source: string): { css: string; html: string } | null {
  const doc = new DOMParser().parseFromString(source, 'text/html');
  if (!doc.querySelector('main') && !doc.querySelector('.hero')) return null;
  doc.querySelector('header.top')?.remove();
  doc.querySelector('footer')?.remove();
  doc.querySelector('.video')?.remove();
  doc.querySelectorAll('script').forEach((node) => node.remove());
  const style = doc.querySelector('style')?.textContent ?? '';
  const html = [...doc.body.children].map((node) => node.outerHTML).join('');
  return { css: scopeLessonCss(style), html };
}

export function scopeLessonCss(css: string): string {
  let index = 0;
  let out = '';
  while (index < css.length) {
    while (index < css.length && /\s/.test(css[index] ?? '')) index += 1;
    if (index >= css.length) break;
    if (css.startsWith('@keyframes', index) || css.startsWith('@-webkit-keyframes', index)) {
      const end = matchingBrace(css, css.indexOf('{', index));
      out += css.slice(index, end + 1);
      index = end + 1;
      continue;
    }
    if (css.startsWith('@media', index) || css.startsWith('@supports', index)) {
      const open = css.indexOf('{', index);
      const end = matchingBrace(css, open);
      out += `${css.slice(index, open + 1)}${scopeLessonCss(css.slice(open + 1, end))}}`;
      index = end + 1;
      continue;
    }
    const open = css.indexOf('{', index);
    if (open === -1) break;
    const end = matchingBrace(css, open);
    const selectors = css
      .slice(index, open)
      .split(',')
      .map((selector) => prefixSelector(selector.trim()))
      .filter((selector): selector is string => selector != null);
    if (selectors.length > 0) out += `${selectors.join(',')}${css.slice(open, end + 1)}`;
    index = end + 1;
  }
  return out;
}

function prefixSelector(selector: string): string | null {
  if (!selector || selector.includes('.leitura')) return null;
  if (selector === ':root' || selector === 'html' || selector === 'body') return SCOPE;
  if (selector.startsWith(':root')) return SCOPE + selector.slice(':root'.length);
  if (selector.startsWith('html')) return SCOPE + selector.slice('html'.length);
  if (selector.startsWith('body')) return SCOPE + selector.slice('body'.length);
  return `${SCOPE} ${selector}`;
}

function matchingBrace(css: string, open: number): number {
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return css.length - 1;
}

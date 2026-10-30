/**
 * Temas de aparência das telas da família.
 *
 * Valores copiados de design (tema.js). O tema "escuro" é o original e não
 * sobrescreve nenhum token; os demais têm um bloco em themes.css.
 */
export interface ThemeDef {
  id: string;
  name: string;
  desc: string;
  dark: boolean;
  bg: string;
  card: string;
  s2: string;
  b: string;
  hero: string;
}

export const THEMES: readonly ThemeDef[] = [
  {
    "id": "escuro",
    "name": "Escuro",
    "desc": "O original: grafite metálico.",
    "dark": true,
    "bg": "#0c0d0f",
    "card": "#1a1c1f",
    "s2": "#16181b",
    "b": "#2a2d31",
    "hero": "linear-gradient(135deg, #3c3f44 0%, #26282c 26%, #16181b 52%, #303338 74%, #1b1d21 100%)"
  },
  {
    "id": "cloud-teal",
    "name": "Cloud Dancer",
    "desc": "Branco suave com cartão teal.",
    "dark": false,
    "bg": "#f0eee9",
    "card": "#fdfcfa",
    "s2": "#e6e3dc",
    "b": "#dbd7ce",
    "hero": "linear-gradient(135deg, #2f5a5a 0%, #1d4142 26%, #123031 52%, #285051 74%, #163738 100%)"
  },
  {
    "id": "gelo-marinho",
    "name": "Gelo",
    "desc": "Azul-gelo com cartão marinho.",
    "dark": false,
    "bg": "#e9eef4",
    "card": "#fbfcfe",
    "s2": "#dce4ee",
    "b": "#ccd8e5",
    "hero": "linear-gradient(135deg, #2e3f5f 0%, #1e2c47 26%, #121c31 52%, #283a58 74%, #16223a 100%)"
  },
  {
    "id": "salvia-floresta",
    "name": "Sálvia",
    "desc": "Verde-sálvia com cartão floresta.",
    "dark": false,
    "bg": "#e8ece4",
    "card": "#fbfcf9",
    "s2": "#dce3d6",
    "b": "#ced7c6",
    "hero": "linear-gradient(135deg, #3e5640 0%, #2a3e2c 26%, #1b2b1d 52%, #354b37 74%, #203222 100%)"
  },
  {
    "id": "zinco-grafite",
    "name": "Zinco",
    "desc": "Neutro frio com cartão grafite.",
    "dark": false,
    "bg": "#eff0f2",
    "card": "#ffffff",
    "s2": "#e4e5e8",
    "b": "#d8dadf",
    "hero": "linear-gradient(135deg, #3c3f44 0%, #26282c 26%, #16181b 52%, #303338 74%, #1b1d21 100%)"
  },
  {
    "id": "meia-noite",
    "name": "Meia-noite",
    "desc": "Grafite azulado, cartão marinho.",
    "dark": true,
    "bg": "#0a0d13",
    "card": "#161b25",
    "s2": "#141922",
    "b": "#242b39",
    "hero": "linear-gradient(135deg, #33476b 0%, #22324f 26%, #152038 52%, #2c3f61 74%, #192640 100%)"
  },
  {
    "id": "petroleo",
    "name": "Petróleo",
    "desc": "Verde-azulado escuro, cartão teal.",
    "dark": true,
    "bg": "#091011",
    "card": "#152022",
    "s2": "#121c1d",
    "b": "#223234",
    "hero": "linear-gradient(135deg, #2f5e5d 0%, #1e4444 26%, #123030 52%, #295454 74%, #163a3a 100%)"
  },
  {
    "id": "floresta",
    "name": "Floresta",
    "desc": "Verde escuro, cartão esmeralda.",
    "dark": true,
    "bg": "#0a0f0b",
    "card": "#162017",
    "s2": "#131b14",
    "b": "#233225",
    "hero": "linear-gradient(135deg, #2b5e47 0%, #1c4433 26%, #112f23 52%, #26543f 74%, #15392a 100%)"
  },
  {
    "id": "espresso",
    "name": "Espresso",
    "desc": "Marrom café, cartão cobreado.",
    "dark": true,
    "bg": "#100c0a",
    "card": "#201914",
    "s2": "#1c1612",
    "b": "#33281f",
    "hero": "linear-gradient(135deg, #634a37 0%, #463326 26%, #2e2119 52%, #56402f 74%, #35261c 100%)"
  },
  {
    "id": "ameixa-escuro",
    "name": "Ameixa",
    "desc": "Preto arroxeado, cartão ameixa.",
    "dark": true,
    "bg": "#0f0b11",
    "card": "#1f1822",
    "s2": "#1b151d",
    "b": "#312736",
    "hero": "linear-gradient(135deg, #5b3f62 0%, #412c47 26%, #2b1c30 52%, #503758 74%, #312136 100%)"
  },
  {
    "id": "bordo",
    "name": "Bordô",
    "desc": "Preto avinhado, cartão bordô.",
    "dark": true,
    "bg": "#110a0b",
    "card": "#221718",
    "s2": "#1e1415",
    "b": "#362526",
    "hero": "linear-gradient(135deg, #6a3439 0%, #4c2428 26%, #33171a 52%, #5d2d32 74%, #3a1c1f 100%)"
  },
  {
    "id": "oliva-noite",
    "name": "Oliva noite",
    "desc": "Preto terroso, cartão oliva.",
    "dark": true,
    "bg": "#0e0e09",
    "card": "#1e1e15",
    "s2": "#1a1a12",
    "b": "#2f2f22",
    "hero": "linear-gradient(135deg, #5a5833 0%, #403f23 26%, #2b2a17 52%, #4f4d2c 74%, #31301b 100%)"
  },
  {
    "id": "grafite-quente",
    "name": "Grafite quente",
    "desc": "Grafite bege, cartão metal.",
    "dark": true,
    "bg": "#0e0d0c",
    "card": "#1e1c1a",
    "s2": "#1a1816",
    "b": "#2e2b28",
    "hero": "linear-gradient(135deg, #3c3f44 0%, #26282c 26%, #16181b 52%, #303338 74%, #1b1d21 100%)"
  },
  {
    "id": "oled",
    "name": "OLED",
    "desc": "Preto puro, cartão metal.",
    "dark": true,
    "bg": "#000000",
    "card": "#111113",
    "s2": "#0e0e10",
    "b": "#222326",
    "hero": "linear-gradient(135deg, #3c3f44 0%, #26282c 26%, #16181b 52%, #303338 74%, #1b1d21 100%)"
  },
  {
    "id": "ardosia",
    "name": "Ardósia",
    "desc": "Slate frio, cartão ardósia.",
    "dark": true,
    "bg": "#0c0e12",
    "card": "#191d24",
    "s2": "#161a20",
    "b": "#272c35",
    "hero": "linear-gradient(135deg, #414a5a 0%, #2c3340 26%, #1b2029 52%, #3a4251 74%, #20252f 100%)"
  }
];

export const DEFAULT_THEME = 'escuro';
export const THEME_STORAGE_KEY = 'y2p-tema';

export function isThemeId(value: string | null | undefined): value is string {
  return !!value && THEMES.some((t) => t.id === value);
}

/**
 * Script inline que aplica o tema salvo antes do primeiro paint (evita flash).
 * Roda no layout raiz; fora da vertical de famílias (/b2b, /login) não aplica.
 */
export const THEME_BOOT_SCRIPT = `try{var p=location.pathname;if(!/^\\/(b2b|login)(\\/|$)/.test(p)){var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t)document.documentElement.dataset.theme=t}}catch(e){}`;

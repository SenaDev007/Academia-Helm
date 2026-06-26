import json
import re

with open('/home/z/my-project/scratch/themes-light.json') as f:
    raw = f.read()
data = json.loads(raw)
if isinstance(data, str):
    data = json.loads(data)

def slugify(name):
    s = name.lower().strip()
    s = re.sub(r'[^a-z0-9\s-]', '', s)
    s = re.sub(r'[\s-]+', '-', s).strip('-')
    return s

DESCRIPTIONS = {
    'Amber Minimal': 'Minimaliste ambré — épuré, accent chaleureux',
    'Amethyst Haze': 'Violet brumeux — doux et mystérieux',
    'Bold Tech': 'Tech moderne — bleu électrique vif',
    'Bubblegum': 'Rose bonbon — ludique et joyeux',
    'Caffeine': 'Chaleureux — crème et accents oranges',
    'Candyland': 'Rose pastel — féerique et doux',
    'Catppuccin': 'Palette pastel culte — douceur et repos',
    'Claude': 'Beige chaleureux — sobriété élégante',
    'Claymorphism': 'Argile 3D — formes douces et tactiles',
    'Clean Slate': 'Bleu minimaliste — pro et épuré',
    'Cosmic Night': 'Bleu nuit cosmique — profondeur stellaire',
    'Default': 'shadcn par défaut — neutre universel',
    'Doom 64': 'Rétro sombre néon — ambiance arcade',
    'Elegant Luxury': 'Or sur noir — luxe et prestige',
    'Graphite': 'Gris minimaliste — élégance discrète',
    'Kodama Grove': 'Vert forêt japonais — sérinité naturelle',
    'Midnight Bloom': 'Bleu nuit floral — mystérieux et raffiné',
    'Mocha Mousse': 'Marron café — chaleureux et réconfortant',
    'Modern Minimal': 'Noir épuré — minimalisme absolu',
    'Mono': 'Monochrome — pureté du noir et blanc',
    'Nature': 'Vert nature — fraîcheur et vitalité',
    'Neo Brutalism': 'Brutalisme — couleurs vives et contrastes',
    'Northern Lights': 'Aurores boréales — magie polaire',
    'Notebook': 'Cahier annoté — ambiance scolaire',
    'Ocean Breeze': 'Bleu océan — fraîcheur marine',
    'Origin UI': 'Origin Labs — design tech moderne',
    'Pastel Dreams': 'Rêves pastel — douceur onirique',
    'Perpetuity': 'Bleu perpétuel — sobriété intemporelle',
    'Quantum Rose': 'Rose quantum néon — futuriste',
    'Retro Arcade': 'Cyan rétro — ambiance années 80',
    'Soft Pop': 'Pop art doux — moderne et accueillant',
    'Solar Dusk': 'Coucher de soleil — chaleur dorée',
    'Starry Night': 'Nuit étoilée — poésie céleste',
    'Sunset Horizon': 'Horizon couchant — dégradés chaleureux',
    'Supabase': 'Vert Supabase — tech et moderne',
    'T3 Chat': 'Violet T3 — interface chat moderne',
    'Tangerine': 'Orange mandarine — énergie et vitalité',
    'Twitter': 'Noir Twitter/X — minimalisme social',
    'Vintage Paper': 'Papier vintage — nostalgie littéraire',
    'Violet Bloom': 'Violet floral — élégance botanique',
}

def generate_light(dark_vars):
    light = dict(dark_vars)
    light['--background'] = dark_vars.get('--foreground', '0 0% 100%')
    light['--foreground'] = dark_vars.get('--background', '0 0% 9%')
    light['--card'] = '0 0% 100%'
    light['--card-foreground'] = dark_vars.get('--background', '0 0% 9%')
    light['--popover'] = '0 0% 100%'
    light['--popover-foreground'] = dark_vars.get('--background', '0 0% 9%')
    light['--muted'] = '0 0% 96%'
    light['--muted-foreground'] = '0 0% 40%'
    light['--secondary'] = '0 0% 96%'
    light['--secondary-foreground'] = dark_vars.get('--foreground', '0 0% 9%')
    light['--border'] = '0 0% 90%'
    light['--input'] = '0 0% 90%'
    light['--sidebar'] = '0 0% 98%'
    light['--sidebar-foreground'] = dark_vars.get('--background', '0 0% 9%')
    light['--sidebar-border'] = '0 0% 90%'
    return light

# Build the themes array
themes_code = []

HEADER = '''/**
 * ============================================================================
 * themes.config.ts — 40 thèmes officiels 21st.dev + variantes light auto-générées
 * ============================================================================
 *
 * Sources :
 *   - Mode dark  : extrait directement de https://21st.dev/community/themes
 *   - Mode light : généré automatiquement (inversion des couleurs neutres,
 *                  conservation des couleurs d'accent)
 *
 * Chaque thème expose ~32 variables CSS (shadcn/ui standard) :
 *   - background, foreground, card, popover, primary, secondary, muted, accent,
 *     destructive, border, input, ring (+ leurs -foreground)
 *   - sidebar, sidebar-foreground, sidebar-primary, sidebar-accent, sidebar-border
 *   - chart-1 à chart-5
 *   - radius, font-sans, font-serif, font-mono
 *
 * Appliquer un thème = injecter ces variables sur <html> via ThemeApplier.
 * ============================================================================
 */

// === Types ===

export type ThemeMode = 'light' | 'dark' | 'auto';

export interface ThemeColors {
  background: string;       // HSL: 'H S% L%'
  foreground: string;
  card: string;
  cardForeground: string;
  popover: string;
  popoverForeground: string;
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  muted: string;
  mutedForeground: string;
  accent: string;
  accentForeground: string;
  destructive: string;
  destructiveForeground: string;
  border: string;
  input: string;
  ring: string;
  // Sidebar
  sidebar: string;
  sidebarForeground: string;
  sidebarPrimary: string;
  sidebarPrimaryForeground: string;
  sidebarAccent: string;
  sidebarAccentForeground: string;
  sidebarBorder: string;
  sidebarRing: string;
  // Charts
  chart1: string;
  chart2: string;
  chart3: string;
  chart4: string;
  chart5: string;
}

export interface ThemeTypography {
  fontSans: string;
  fontSerif: string;
  fontMono: string;
  letterSpacing: string;
}

export interface ThemeVariant {
  colors: ThemeColors;
  typography: ThemeTypography;
  radius: string;
}

export interface Theme {
  id: string;              // ex: 'ocean-breeze'
  name: string;            // ex: 'Ocean Breeze'
  description: string;     // ex: 'Bleu océan — fraîcheur marine'
  source: '21st-dev';     // origine du thème
  light: ThemeVariant;
  dark: ThemeVariant;
}

// === Helpers ===

/**
 * Convertit un triplet HSL 'H S% L%' en code hex (#rrggbb).
 * Utilisé pour les previews (color swatches).
 */
export function hslToHex(hsl: string): string {
  const parts = hsl.trim().split(/\\s+/);
  if (parts.length < 3) return '#000000';
  const h = parseFloat(parts[0]);
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h / 60) % 2 - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (0 <= h && h < 60) { r = c; g = x; b = 0; }
  else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
  else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
  else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
  else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Récupère un thème par son ID.
 */
export function getThemeById(id: string): Theme | undefined {
  if (!id) return undefined;
  if (id === 'academia-helm-default') return DEFAULT_ACADEMIA_HELM_THEME;
  return THEMES.find((t) => t.id === id);
}

/**
 * Récupère la variante (light ou dark) d'un thème.
 * Si mode='auto', suit l'OS (mode préféré du visiteur).
 */
export function resolveThemeVariant(theme: Theme, mode: ThemeMode): ThemeVariant {
  if (mode === 'auto') {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return theme.dark;
    }
    return theme.light;
  }
  return mode === 'dark' ? theme.dark : theme.light;
}

// === Liste des 40 thèmes ===

export const THEMES: Theme[] = [
'''

FOOTER = '''];

// === Thème par défaut Academia Helm (palette Navy/Blue/Gold) ===
// Utilisé tant que l'utilisateur n'a pas choisi de thème.
export const DEFAULT_ACADEMIA_HELM_THEME: Theme = {
  id: 'academia-helm-default',
  name: 'Academia Helm (par défaut)',
  description: "Palette officielle Navy / Bleu / Doré — utilisée tant qu'aucun thème n'est choisi",
  source: '21st-dev',
  dark: {
    colors: {
      background: '222 47% 11%',       // #0b1d3a
      foreground: '210 40% 98%',
      card: '222 47% 14%',
      cardForeground: '210 40% 98%',
      popover: '222 47% 14%',
      popoverForeground: '210 40% 98%',
      primary: '217 91% 60%',          // #1d4fa5
      primaryForeground: '222 47% 11%',
      secondary: '217 32% 17%',
      secondaryForeground: '210 40% 98%',
      muted: '217 32% 17%',
      mutedForeground: '215 20% 65%',
      accent: '42 92% 56%',            // #f5b335 (Gold)
      accentForeground: '222 47% 11%',
      destructive: '0 84% 60%',
      destructiveForeground: '210 40% 98%',
      border: '217 32% 20%',
      input: '217 32% 20%',
      ring: '217 91% 60%',
      sidebar: '222 47% 8%',
      sidebarForeground: '210 40% 98%',
      sidebarPrimary: '42 92% 56%',
      sidebarPrimaryForeground: '222 47% 11%',
      sidebarAccent: '217 32% 17%',
      sidebarAccentForeground: '210 40% 98%',
      sidebarBorder: '217 32% 17%',
      sidebarRing: '42 92% 56%',
      chart1: '42 92% 56%',
      chart2: '217 91% 60%',
      chart3: '197 71% 50%',
      chart4: '250 65% 60%',
      chart5: '180 60% 45%',
    },
    typography: {
      fontSans: 'Inter, sans-serif',
      fontSerif: 'Playfair Display, serif',
      fontMono: 'JetBrains Mono, monospace',
      letterSpacing: '0em',
    },
    radius: '0.5rem',
  },
  light: {
    colors: {
      background: '0 0% 100%',
      foreground: '222 47% 11%',
      card: '0 0% 100%',
      cardForeground: '222 47% 11%',
      popover: '0 0% 100%',
      popoverForeground: '222 47% 11%',
      primary: '217 91% 35%',          // Navy foncé
      primaryForeground: '0 0% 100%',
      secondary: '210 40% 96%',
      secondaryForeground: '222 47% 11%',
      muted: '210 40% 96%',
      mutedForeground: '215 16% 47%',
      accent: '42 92% 56%',            // Gold
      accentForeground: '222 47% 11%',
      destructive: '0 84% 60%',
      destructiveForeground: '0 0% 100%',
      border: '214 32% 91%',
      input: '214 32% 91%',
      ring: '217 91% 35%',
      sidebar: '210 40% 98%',
      sidebarForeground: '222 47% 11%',
      sidebarPrimary: '217 91% 35%',
      sidebarPrimaryForeground: '0 0% 100%',
      sidebarAccent: '210 40% 96%',
      sidebarAccentForeground: '222 47% 11%',
      sidebarBorder: '214 32% 91%',
      sidebarRing: '42 92% 56%',
      chart1: '42 92% 56%',
      chart2: '217 91% 50%',
      chart3: '197 71% 50%',
      chart4: '250 65% 60%',
      chart5: '180 60% 45%',
    },
    typography: {
      fontSans: 'Inter, sans-serif',
      fontSerif: 'Playfair Display, serif',
      fontMono: 'JetBrains Mono, monospace',
      letterSpacing: '0em',
    },
    radius: '0.5rem',
  },
};

/**
 * Tous les thèmes disponibles incluant le défaut Academia Helm.
 * Le thème par défaut est toujours en première position.
 */
export const ALL_THEMES: Theme[] = [DEFAULT_ACADEMIA_HELM_THEME, ...THEMES];
'''

# Generate each theme
theme_entries = []
for t in data:
    name = t['name'].strip()
    if not name:
        continue
    slug = slugify(name)
    desc = DESCRIPTIONS.get(name, 'Theme ' + name).replace("'", "\\'")
    vars_dict = t['cssVars']
    
    def g(key):
        v = vars_dict.get(key, '0 0% 0%')
        return v.replace("'", "\\'")
    
    light_vars = generate_light(vars_dict)
    def gl(key):
        v = light_vars.get(key, vars_dict.get(key, '0 0% 0%'))
        return v.replace("'", "\\'")
    
    # Escape quotes in font values
    def escape_font(v):
        v = vars_dict.get(v, 'sans-serif')
        # Replace inner double quotes with single
        return v.replace('"', "'").replace("'", "\\'")
    
    def escape_font_light(key):
        v = light_vars.get(key, vars_dict.get('--' + key.replace('font', '--font'), 'sans-serif'))
        return v.replace('"', "'").replace("'", "\\'")
    
    entry = """  {
    id: '""" + slug + """',
    name: '""" + name.replace("'", "\\'") + """',
    description: '""" + desc + """',
    source: '21st-dev',
    dark: {
      colors: {
        background: '""" + g('--background') + """',
        foreground: '""" + g('--foreground') + """',
        card: '""" + g('--card') + """',
        cardForeground: '""" + g('--card-foreground') + """',
        popover: '""" + g('--popover') + """',
        popoverForeground: '""" + g('--popover-foreground') + """',
        primary: '""" + g('--primary') + """',
        primaryForeground: '""" + g('--primary-foreground') + """',
        secondary: '""" + g('--secondary') + """',
        secondaryForeground: '""" + g('--secondary-foreground') + """',
        muted: '""" + g('--muted') + """',
        mutedForeground: '""" + g('--muted-foreground') + """',
        accent: '""" + g('--accent') + """',
        accentForeground: '""" + g('--accent-foreground') + """',
        destructive: '""" + g('--destructive') + """',
        destructiveForeground: '""" + g('--destructive-foreground') + """',
        border: '""" + g('--border') + """',
        input: '""" + g('--input') + """',
        ring: '""" + g('--ring') + """',
        sidebar: '""" + g('--sidebar') + """',
        sidebarForeground: '""" + g('--sidebar-foreground') + """',
        sidebarPrimary: '""" + g('--sidebar-primary') + """',
        sidebarPrimaryForeground: '""" + g('--sidebar-primary-foreground') + """',
        sidebarAccent: '""" + g('--sidebar-accent') + """',
        sidebarAccentForeground: '""" + g('--sidebar-accent-foreground') + """',
        sidebarBorder: '""" + g('--sidebar-border') + """',
        sidebarRing: '""" + g('--sidebar-ring') + """',
        chart1: '""" + g('--chart-1') + """',
        chart2: '""" + g('--chart-2') + """',
        chart3: '""" + g('--chart-3') + """',
        chart4: '""" + g('--chart-4') + """',
        chart5: '""" + g('--chart-5') + """',
      },
      typography: {
        fontSans: '""" + escape_font('--font-sans') + """',
        fontSerif: '""" + escape_font('--font-serif') + """',
        fontMono: '""" + escape_font('--font-mono') + """',
        letterSpacing: '""" + g('--letter-spacing') + """',
      },
      radius: '""" + g('--radius') + """',
    },
    light: {
      colors: {
        background: '""" + gl('--background') + """',
        foreground: '""" + gl('--foreground') + """',
        card: '""" + gl('--card') + """',
        cardForeground: '""" + gl('--card-foreground') + """',
        popover: '""" + gl('--popover') + """',
        popoverForeground: '""" + gl('--popover-foreground') + """',
        primary: '""" + gl('--primary') + """',
        primaryForeground: '""" + gl('--primary-foreground') + """',
        secondary: '""" + gl('--secondary') + """',
        secondaryForeground: '""" + gl('--secondary-foreground') + """',
        muted: '""" + gl('--muted') + """',
        mutedForeground: '""" + gl('--muted-foreground') + """',
        accent: '""" + gl('--accent') + """',
        accentForeground: '""" + gl('--accent-foreground') + """',
        destructive: '""" + gl('--destructive') + """',
        destructiveForeground: '""" + gl('--destructive-foreground') + """',
        border: '""" + gl('--border') + """',
        input: '""" + gl('--input') + """',
        ring: '""" + gl('--ring') + """',
        sidebar: '""" + gl('--sidebar') + """',
        sidebarForeground: '""" + gl('--sidebar-foreground') + """',
        sidebarPrimary: '""" + gl('--sidebar-primary') + """',
        sidebarPrimaryForeground: '""" + gl('--sidebar-primary-foreground') + """',
        sidebarAccent: '""" + gl('--sidebar-accent') + """',
        sidebarAccentForeground: '""" + gl('--sidebar-accent-foreground') + """',
        sidebarBorder: '""" + gl('--sidebar-border') + """',
        sidebarRing: '""" + gl('--sidebar-ring') + """',
        chart1: '""" + gl('--chart-1') + """',
        chart2: '""" + gl('--chart-2') + """',
        chart3: '""" + gl('--chart-3') + """',
        chart4: '""" + gl('--chart-4') + """',
        chart5: '""" + gl('--chart-5') + """',
      },
      typography: {
        fontSans: '""" + escape_font('--font-sans') + """',
        fontSerif: '""" + escape_font('--font-serif') + """',
        fontMono: '""" + escape_font('--font-mono') + """',
        letterSpacing: '""" + gl('--letter-spacing') + """',
      },
      radius: '""" + gl('--radius') + """',
    },
  },"""
    theme_entries.append(entry)

output = HEADER + '\n'.join(theme_entries) + '\n' + FOOTER

with open('/home/z/my-project/apps/web-app/src/lib/themes/themes.config.ts', 'w') as f:
    f.write(output)

print('Themes config written')
print('Themes count:', len(theme_entries))

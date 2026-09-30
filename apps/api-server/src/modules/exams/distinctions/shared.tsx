import type { CSSProperties, ReactNode } from 'react';
import { Icon } from './icons.js';
import { DEFAULT_SIGNERS } from './themes.js';
import { fmtDate } from './format.js';
import type { IconName, Level, Palette, PreparedDistinction, SchoolInfo, Theme } from './types.js';

export interface CertProps { d: PreparedDistinction; theme: Theme }

export function vars(p: Palette): CSSProperties {
  return {
    '--primary': p.primary, '--accent': p.accent, '--tint': p.tint, '--ink': p.ink, '--soft': p.soft,
  } as CSSProperties;
}

export function SchoolHeader({ school }: { school: SchoolInfo }) {
  return (
    <div className="school">
      {school.logoUrl ? <img src={school.logoUrl} alt="" /> : null}
      <span>{school.name}</span>
    </div>
  );
}

export function Signature({ label, name, img }: { label: string; name?: string; img?: string }) {
  return (
    <div className="sig">
      <div className="simg">{img ? <img src={img} alt="" /> : null}</div>
      <div className="line" />
      <div className="lbl">{label}</div>
      {name ? <div className="nm">{name}</div> : null}
    </div>
  );
}

export function VerifyBlock({ d, withPlace = true }: { d: PreparedDistinction; withPlace?: boolean }) {
  const place = d.school.city ? `Fait à ${d.school.city}, le ${fmtDate(d.period.issuedOn)}` : `Le ${fmtDate(d.period.issuedOn)}`;
  return (
    <div className="verify">
      <div className="qr" dangerouslySetInnerHTML={{ __html: d.qrSvg }} />
      <div className="vcode">{d.verification.code}</div>
      {withPlace ? <div className="place">{place}</div> : null}
    </div>
  );
}

export function Footer({ d, level, center }: { d: PreparedDistinction; level: Level; center?: ReactNode }) {
  const defaults = DEFAULT_SIGNERS[level];
  return (
    <div className="footer">
      <Signature label={d.school.directorTitle ?? defaults.director} name={d.school.directorName} img={d.school.directorSignatureUrl} />
      {center ?? <VerifyBlock d={d} />}
      <Signature label={d.school.teacherTitle ?? defaults.teacher} name={d.school.teacherName} img={d.school.teacherSignatureUrl} />
    </div>
  );
}

const MAT_SPOTS: [number, number, number, number][] = [
  [70, 70, 54, -14], [190, 46, 38, 10], [62, 210, 40, 12], [900, 62, 50, 14], [1010, 176, 38, -10], [836, 44, 36, 8],
  [70, 520, 48, 10], [182, 604, 38, -12], [952, 530, 52, -10], [1022, 614, 38, 12],
];
const BUBBLES: [number, number, number][] = [
  [-60, -60, 240], [930, -90, 260], [-80, 600, 260], [940, 590, 250], [560, -40, 90], [480, 720, 110],
];

/** Décor et cadre propres à chaque niveau, partagés entre certificats et tableaux collectifs */
export function LevelFrame({ level, pattern, watermark }: { level: Level; pattern: IconName[]; watermark: IconName }) {
  if (level === 'maternel') {
    return (
      <div className="fr">
        {BUBBLES.map(([l, t, s], i) => (
          <div key={i} className="bubble" style={{ left: l, top: t, width: s, height: s }} />
        ))}
        {MAT_SPOTS.map(([l, t, s, r], i) => (
          <div key={i} className="deco" style={{ left: l, top: t, transform: `rotate(${r}deg)` }}>
            <Icon name={pattern[i % pattern.length]} size={s} stroke={2.2} />
          </div>
        ))}
        <div className="frame" />
      </div>
    );
  }
  if (level === 'primaire') {
    const left = pattern.slice(0, 5);
    const right = [...pattern].reverse().slice(0, 5);
    return (
      <div className="fr">
        <div className="panel" />
        <div className="wm"><Icon name={watermark} size={460} stroke={1} /></div>
        <div className="side l">{left.map((n, i) => <Icon key={i} name={n} size={38} stroke={1.8} />)}</div>
        <div className="side r">{right.map((n, i) => <Icon key={i} name={n} size={38} stroke={1.8} />)}</div>
        <div className="corner tl" /><div className="corner tr" /><div className="corner bl" /><div className="corner br" />
      </div>
    );
  }
  return (
    <div className="fr">
      <svg className="guil" viewBox="0 0 1123 794" width="1123" height="794" aria-hidden="true">
        {Array.from({ length: 34 }, (_, i) => {
          const r = 44 + i * 9;
          return <circle key={i} cx="561.5" cy="413" r={r} fill="none" stroke="var(--accent)" strokeWidth="0.9" strokeOpacity={Math.max(0.03, 0.26 * (1 - r / 360))} />;
        })}
      </svg>
      <div className="wm"><Icon name={watermark} size={440} stroke={0.8} /></div>
      <div className="f1" /><div className="f2" /><div className="f3" />
      <div className="orn" style={{ left: 29.5, top: 29.5 }} />
      <div className="orn" style={{ right: 29.5, top: 29.5 }} />
      <div className="orn" style={{ left: 29.5, bottom: 29.5 }} />
      <div className="orn" style={{ right: 29.5, bottom: 29.5 }} />
    </div>
  );
}

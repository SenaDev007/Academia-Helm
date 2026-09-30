import type { CSSProperties } from 'react';
import { Icon } from './icons.js';
import { BOARD_BASE, BOARD_TITLE, THEMES } from './themes.js';
import { fmtAverage, fmtPct } from './format.js';
import type { BoardInput, BoardRow, IconName, Level } from './types.js';
import { LevelFrame, vars } from './shared.js';

const CLS: Record<Level, string> = { maternel: 'mat', primaire: 'pri', secondaire: 'sec' };
const TOP: { icon: IconName; color: string }[] = [
  { icon: 'Trophy', color: '#C9A227' }, { icon: 'Medal', color: '#94A3B8' }, { icon: 'Award', color: '#B7791F' },
];

export const ROWS_PER_PAGE = 9;

export function chunk<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out.length ? out : [[]];
}

export function Board({ b }: { b: BoardInput }) {
  const base = THEMES[BOARD_BASE[b.level]];
  const pages = chunk<BoardRow>(b.rows, ROWS_PER_PAGE);
  const numHead = b.level === 'maternel' ? 'Acquis' : 'Moyenne';

  return (
    <>
      {pages.map((rows, pi) => (
        <section key={pi} className={`page board ${CLS[b.level]}`} style={vars(base.palette)}>
          <LevelFrame level={b.level} pattern={base.pattern} watermark={base.icon} />
          <div className="content">
            <div className="head">
              <h1>{BOARD_TITLE[b.level]}</h1>
              <div className="sub2">
                {b.className}, {b.period.label}, année scolaire {b.period.schoolYear}
                {pages.length > 1 ? `  (page ${pi + 1}/${pages.length})` : ''}
              </div>
            </div>
            <table>
              <thead>
                <tr><th>Rang</th><th>Élève</th><th className="num">{numHead}</th><th>Mention</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const t = THEMES[r.code];
                  const top = r.rank <= 3 ? TOP[r.rank - 1] : undefined;
                  return (
                    <tr key={`${r.rank}-${r.fullName}`}>
                      <td className="rk">
                        {top ? <Icon name={top.icon} size={26} color={top.color} stroke={2.2} /> : r.rank}
                      </td>
                      <td>{r.fullName}</td>
                      <td className="num">{b.level === 'maternel' ? fmtPct(r.average, b.base) : fmtAverage(r.average, b.base)}</td>
                      <td>
                        <span className="pill" style={{ '--pc': t.palette.primary } as CSSProperties}>
                          <Icon name={t.icon} size={16} stroke={2.4} />{t.shortLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="foot">{b.school.name}, généré par Academia Helm</div>
          </div>
        </section>
      ))}
    </>
  );
}

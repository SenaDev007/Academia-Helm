import { Icon } from './icons.js';
import { fill, fitFont, fmtAverage, fmtRank } from './format.js';
import { Footer, LevelFrame, SchoolHeader, vars, type CertProps } from './shared.js';

export function Primaire({ d, theme }: CertProps) {
  const vals = { periode: d.period.label.toLowerCase(), annee: d.period.schoolYear };
  const r = d.results;
  const name = d.student.fullName;
  const isGrad = d.code === 'PRI_GRAD';

  return (
    <section className="page pri" style={vars(theme.palette)}>
      <LevelFrame level="primaire" pattern={theme.pattern} watermark={theme.icon} />
      <div className="content">
        <SchoolHeader school={d.school} />
        <div className="medal"><Icon name={theme.icon} size={56} stroke={2.2} /></div>
        <div className="tails"><div className="tail" /><div className="tail" /></div>
        <div className="banner" style={{ fontSize: fitFont(theme.title, 620, 38, 0.66, 24) }}>{theme.title}</div>
        {theme.subtitle ? <div className="sub">{theme.subtitle}</div> : null}
        <div className="given">{fill(theme.given, vals)}</div>
        <div className="name" style={{ fontSize: fitFont(name, 780, 50, 0.6, 30) }}>{name}</div>
        <div className="class">
          {isGrad ? `${d.student.className}, année scolaire ${d.period.schoolYear}` : `${d.student.className}, ${d.period.label}, année scolaire ${d.period.schoolYear}`}
        </div>
        <div className="chips">
          {d.statOverride ? (
            <div className="chip"><Icon name="Star" size={18} />{d.statOverride}</div>
          ) : (
            <>
              {r?.average != null ? (
                <div className="chip"><Icon name="Calculator" size={18} />{isGrad ? 'Moyenne annuelle' : 'Moyenne'} : {fmtAverage(r.average, r.base)}</div>
              ) : null}
              {r?.rank != null ? (
                <div className="chip"><Icon name="Hash" size={18} />Rang : {fmtRank(r.rank, r.classSize)}</div>
              ) : null}
            </>
          )}
        </div>
        <p className="msg">{d.customMessage ?? fill(theme.message, vals)}</p>
        <Footer d={d} level="primaire" />
      </div>
    </section>
  );
}

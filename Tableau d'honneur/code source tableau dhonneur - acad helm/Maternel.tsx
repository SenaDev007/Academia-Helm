import { Icon } from '../icons.js';
import { fill, fitFont, fmtPct } from '../format.js';
import { Footer, LevelFrame, SchoolHeader, vars, type CertProps } from './shared.js';

export function Maternel({ d, theme }: CertProps) {
  const vals = { periode: d.period.label.toLowerCase(), annee: d.period.schoolYear };
  const r = d.results;
  const stat = d.statOverride ?? (r?.average != null ? `Acquis de la période : ${fmtPct(r.average, r.base)}` : undefined);
  const isGrad = d.code === 'MAT_GRAD';
  const name = d.student.fullName;

  return (
    <section className="page mat" style={vars(theme.palette)}>
      <LevelFrame level="maternel" pattern={theme.pattern} watermark={theme.icon} />
      {d.student.photoUrl ? (
        <>
          <img className="photo" src={d.student.photoUrl} alt="" />
          <div className="mascot"><Icon name={theme.pattern[0]} size={72} stroke={2} /></div>
        </>
      ) : null}
      <div className="content">
        <SchoolHeader school={d.school} />
        <div className="badge-wrap">
          <div className="badge"><Icon name={theme.icon} size={74} stroke={2.2} /></div>
          <span className="spark" style={{ left: -54, top: 4 }}><Icon name="Sparkles" size={34} /></span>
          <span className="spark" style={{ right: -52, top: 0 }}><Icon name="Star" size={30} stroke={2.4} /></span>
          <span className="spark" style={{ left: -84, top: 62 }}><Icon name="Star" size={20} stroke={2.4} /></span>
          <span className="spark" style={{ right: -80, top: 66 }}><Icon name="Sparkles" size={24} /></span>
        </div>
        {theme.kicker ? <div className="kicker">{theme.kicker}</div> : null}
        <h1 style={{ fontSize: fitFont(theme.title, 820, 60, 0.6, 40) }}>{theme.title}</h1>
        <div className="given">{fill(theme.given, vals)}</div>
        <div className="name" style={{ fontSize: fitFont(name, 780, 50, 0.56, 30) }}>{name}</div>
        <div className="class">
          {isGrad ? `${d.student.className}, année scolaire ${d.period.schoolYear}` : `${d.student.className}, ${d.period.label}, année scolaire ${d.period.schoolYear}`}
        </div>
        <p className="msg">{d.customMessage ?? fill(theme.message, vals)}</p>
        {stat ? (
          <div className="score"><Icon name="Star" size={18} stroke={2.4} />{stat}</div>
        ) : isGrad ? (
          <div className="score"><Icon name="GraduationCap" size={18} stroke={2.4} />Passage en classe de CI</div>
        ) : null}
        <Footer d={d} level="maternel" />
      </div>
    </section>
  );
}

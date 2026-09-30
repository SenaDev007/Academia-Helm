import { Icon } from './icons.js';
import { fill, fitFont, fmtAverage, fmtDate, fmtNumber, fmtRank } from './format.js';
import { Footer, LevelFrame, SchoolHeader, VerifyBlock, vars, type CertProps } from './shared.js';

export function Secondaire({ d, theme }: CertProps) {
  const vals = { periode: d.period.label.toLowerCase(), annee: d.period.schoolYear };
  const r = d.results;
  const name = d.student.fullName;
  const isGrad = d.code === 'SEC_GRAD';

  let stat = d.statOverride;
  if (!stat && r?.average != null) {
    if (d.code === 'SEC_PROGRES' && r.previousAverage != null) {
      const gain = (r.average - r.previousAverage) / r.base * 20;
      stat = `${r.previousLabel ?? 'Période précédente'} : ${fmtAverage(r.previousAverage, r.base)}   |   ${d.period.label} : ${fmtAverage(r.average, r.base)}   |   +${fmtNumber(gain, 1)} pts sur 20`;
    } else if (isGrad) {
      stat = `Moyenne annuelle : ${fmtAverage(r.average, r.base)}`;
    } else {
      stat = `Moyenne générale : ${fmtAverage(r.average, r.base)}` + (r.rank != null ? `   |   Rang : ${fmtRank(r.rank, r.classSize)}` : '');
    }
  }

  return (
    <section className="page sec" style={vars(theme.palette)}>
      <LevelFrame level="secondaire" pattern={theme.pattern} watermark={theme.icon} />
      <div className="content">
        <SchoolHeader school={d.school} />
        <div className="year">Année scolaire {d.period.schoolYear}</div>
        <div className="div"><i /><b /><i /></div>
        <h1 style={{ fontSize: fitFont(theme.title, 900, 52, 0.76, 28) }}>{theme.title}</h1>
        {theme.subtitle ? <div className="sub">{theme.subtitle}</div> : null}
        <div className="div" style={{ width: 460 }}><i /><b /><i /></div>
        <div className="given">{fill(theme.given, vals)}</div>
        <div className="name" style={{ fontSize: fitFont(name, 820, 50, 0.6, 30) }}>{name}</div>
        <div className="class">Élève de {d.student.className}</div>
        <p className="msg">{d.customMessage ?? fill(theme.message, vals)}</p>
        {stat ? <div className="stat">{stat}</div> : null}
        <Footer
          d={d}
          level="secondaire"
          center={
            <div className="verify">
              <div className="seal"><Icon name={theme.icon} size={50} stroke={1.8} /></div>
              <div className="place">{d.school.city ? `Fait à ${d.school.city}, le ${fmtDate(d.period.issuedOn)}` : `Le ${fmtDate(d.period.issuedOn)}`}</div>
            </div>
          }
        />
        <div className="qrcorner"><VerifyBlock d={d} withPlace={false} /></div>
      </div>
    </section>
  );
}

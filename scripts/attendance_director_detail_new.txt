function AttendanceRegisterDirectorDetail({ register, userId, onBack, onValidated }: { register: any; userId: string; onBack: () => void; onValidated: () => void; }) {
  const [saving, setSaving] = useState(false);
  const [directorSignature, setDirectorSignature] = useState<string | null>(register.directorSignature || null);

  // Parser studentsData
  let students: any[] = [];
  if (register.studentsData) {
    if (typeof register.studentsData === "string") {
      try { const p = JSON.parse(register.studentsData); students = Array.isArray(p) ? p : (p?.data || []); } catch { students = []; }
    } else if (Array.isArray(register.studentsData)) { students = register.studentsData; }
    else if (typeof register.studentsData === "object") {
      const d = register.studentsData;
      students = Array.isArray(d) ? d : (d?.data || d?.students || []);
    }
  }

  // Parser holidays
  let holidays: string[] = [];
  if (register.holidays) {
    try { const h = typeof register.holidays === "string" ? JSON.parse(register.holidays) : register.holidays; holidays = Array.isArray(h) ? h : []; } catch { holidays = []; }
  }

  const isAlreadyValidated = register.status === "VALIDATED";
  const isAlreadyRejected = register.status === "REJECTED";
  const selectedMonth = register.month || 1;
  const selectedYear = register.year || new Date().getFullYear();

  const WEEKS = [1, 2, 3, 4, 5];
  const DAYS = [{ num: 1, label: "L" }, { num: 2, label: "M" }, { num: 3, label: "M" }, { num: 4, label: "J" }, { num: 5, label: "V" }];
  const MONTH_NAMES = ["", "Janvier", "F\u00e9vrier", "Mars", "Avril", "Mai", "Juin", "Juillet", "Ao\u00fbt", "Septembre", "Octobre", "Novembre", "D\u00e9cembre"];

  function getCellDate(week: number, dayNum: number) {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    let currentWeek = 1; let lastDow = -1;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth - 1, day);
      const dow = d.getDay();
      if (dow < 1 || dow > 5) continue;
      if (lastDow === 5 && dow === 1) currentWeek++;
      if (currentWeek > 5) continue;
      if (currentWeek === week && dow === dayNum) {
        return { date: d, inMonth: true, dateStr: `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}` };
      }
      lastDow = dow;
    }
    return { date: null, inMonth: false, dateStr: "" };
  }

  function getWeekDateRange(week: number) {
    const days: number[] = [];
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    let currentWeek = 1; let lastDow = -1;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth - 1, day);
      const dow = d.getDay();
      if (dow < 1 || dow > 5) continue;
      if (lastDow === 5 && dow === 1) currentWeek++;
      if (currentWeek > 5) continue;
      if (currentWeek === week) days.push(day);
      lastDow = dow;
    }
    if (days.length === 0) return "";
    return `${days[0]}/${String(selectedMonth).padStart(2,"0")} \u2192 ${days[days.length-1]}/${String(selectedMonth).padStart(2,"0")}`;
  }

  function getAbsence(student: any, week: number, day: number): string {
    const a = (student.absences || []).find((x: any) => x.week === week && x.day === day);
    return a?.marked || "";
  }

  function calculateDemiJourneesMois(): number {
    const DEMI: Record<number, number> = { 1: 2, 2: 2, 3: 1, 4: 2, 5: 2 };
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    let total = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(selectedYear, selectedMonth - 1, day);
      const dow = d.getDay();
      if (dow < 1 || dow > 5) continue;
      const dateStr = `${selectedYear}-${String(selectedMonth).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      if (holidays.includes(dateStr)) continue;
      total += DEMI[dow] || 0;
    }
    return total;
  }

  const demiJourneeMois = calculateDemiJourneesMois();
  const boysCount = students.filter((s: any) => (s.sexe || "").toUpperCase() === "M").length;
  const girlsCount = students.filter((s: any) => (s.sexe || "").toUpperCase() === "F").length;

  const handleValidate = async (action: "VALIDATED" | "REJECTED") => {
    if (action === "VALIDATED" && !directorSignature) { toast.error("Signature obligatoire"); return; }
    if (!window.confirm(action === "VALIDATED" ? "Valider ce registre + \u00e9valuation ?" : "Rejeter ?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/pedagogy-space/director/attendance-registers/${register.id}/director-update`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include",
        body: JSON.stringify({ directorSignature, action, validatedBy: userId }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(action === "VALIDATED" ? "Registre + \u00e9valuation valid\u00e9s" : "Rejet\u00e9s");
      onValidated();
    } catch (err: any) { toast.error("Erreur", { description: err.message }); } finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">
      {/* Action bar */}
      <div className="flex flex-wrap justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100 gap-3">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 rounded-lg">
          <ChevronRight className="w-4 h-4 rotate-180" /> Retour \u00e0 la liste
        </button>
        <div className="flex items-center gap-2">
          {isAlreadyValidated && <span className="px-3 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-bold">Valid\u00e9</span>}
          {isAlreadyRejected && <span className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-bold">Rejet\u00e9</span>}
          {!isAlreadyValidated && !isAlreadyRejected && (<>
            <button onClick={() => handleValidate("REJECTED")} disabled={saving} className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Rejeter</button>
            <button onClick={() => handleValidate("VALIDATED")} disabled={saving || !directorSignature} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} {directorSignature ? "Valider" : "Signature requise"}</button>
          </>)}
        </div>
      </div>

      {/* En-t\u00eate registre */}
      <div className="bg-white border-2 border-slate-800 rounded-xl p-4 text-center">
        <h2 className="text-lg font-bold text-slate-900">REGISTRE D'APPEL{register.schoolLevelCode === "MATERNELLE" ? " MATERNELLE" : ""}</h2>
        <div className="text-sm text-slate-600 mt-1 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span>Mois de <strong>{MONTH_NAMES[selectedMonth]}</strong> {selectedYear}</span>
            <span className="text-slate-300">|</span>
            <span>Nombre de demi-journ\u00e9es : <strong className="text-blue-600">{demiJourneeMois}</strong></span>
          </div>
          <div className="text-slate-700">Classe : <strong>{register.classNameResolved || "\u2014"}</strong> \u2014 Effectif : {students.length} \u00e9l\u00e8ves ({boysCount} G, {girlsCount} F)</div>
        </div>
      </div>

      {/* Tableau complet 25 colonnes (identique \u00e0 l'enseignant) */}
      <div className="bg-white border-2 border-slate-800 rounded-xl p-4">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs" style={{ minWidth: "1600px" }}>
            <thead>
              <tr className="bg-slate-100">
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">N\u00b0</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "180px" }}>Nom et pr\u00e9nom</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase w-12">Sexe</th>
                <th colSpan={25} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase text-center">Indication des absences pour chaque jour de classe (5 semaines \u00d7 5 jours)</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "120px" }}>Motif des absences</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>T. Poss.</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>T. Abs.</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "80px" }}>T. Eff.</th>
                <th rowSpan={3} className="border border-slate-300 px-2 py-2 font-bold text-slate-700 uppercase" style={{ minWidth: "100px" }}>Observation</th>
              </tr>
              <tr className="bg-slate-50">
                {WEEKS.map(w => {
                  const range = getWeekDateRange(w);
                  return <th key={w} colSpan={5} className="border border-slate-300 px-2 py-1 font-bold text-slate-600 text-[11px] uppercase" style={{ minWidth: "225px" }}>S{w} {range && <span className="font-normal text-slate-400 normal-case text-[9px] block">{range}</span>}</th>;
                })}
              </tr>
              <tr className="bg-slate-50">
                {WEEKS.map(w => DAYS.map(d => {
                  const cell = getCellDate(w, d.num);
                  return <th key={`${w}-${d.num}`} className={cn("border border-slate-300 px-1 py-1 font-bold text-[10px] uppercase", cell.inMonth ? "text-slate-500" : "text-slate-300 bg-slate-100")} style={{ minWidth: "45px", width: "45px" }}>{d.label}{cell.inMonth && cell.date && <div className="text-[8px] font-normal text-slate-400">{cell.date.getDate()}</div>}</th>;
                }))}
              </tr>
            </thead>
            <tbody>
              {[...students].sort((a, b) => {
                const aN = `${a.nom || ""} ${a.prenom || ""}`; const bN = `${b.nom || ""} ${b.prenom || ""}`;
                return aN.localeCompare(bN, "fr");
              }).map((student, idx) => (
                <tr key={student.studentId || idx} className={cn("hover:bg-slate-50", idx % 2 === 1 && "bg-slate-50/50")}>
                  <td className="border border-slate-300 px-2 py-1 text-center font-semibold">{idx + 1}</td>
                  <td className="border border-slate-300 px-2 py-1 font-medium">{student.nom} {student.prenom}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center">{student.sexe}</td>
                  {WEEKS.map(w => DAYS.map(d => {
                    const marked = getAbsence(student, w, d.num);
                    const cell = getCellDate(w, d.num);
                    if (!cell.inMonth) return <td key={`${w}-${d.num}`} className="border border-slate-300 p-0 bg-slate-100" style={{ minWidth: "45px", width: "45px" }}><div className="w-full h-9 flex items-center justify-center text-slate-300 text-xs">\u2014</div></td>;
                    const isHoliday = holidays.includes(cell.dateStr);
                    if (isHoliday) return <td key={`${w}-${d.num}`} className="border border-slate-300 p-0 bg-red-50" style={{ minWidth: "45px", width: "45px" }}><div className="w-full h-9 flex items-center justify-center text-base" title="Jour f\u00e9ri\u00e9">\ud83c\udf89</div></td>;
                    return <td key={`${w}-${d.num}`} className="border border-slate-300 p-0" style={{ minWidth: "45px", width: "45px" }}><div className={cn("w-full h-9 flex items-center justify-center text-base font-bold", marked === "-" && "bg-amber-100 text-amber-700", marked === "|" && "bg-amber-100 text-amber-700", marked === "+" && "bg-red-100 text-red-700", !marked && "bg-transparent text-slate-300")}>{marked === "-" ? "\u2212" : marked === "|" ? "\u2502" : marked === "+" ? "+" : "\u00b7"}</div></td>;
                  }))}
                  <td className="border border-slate-300 px-2 py-1 text-[10px]">{student.motif || "\u2014"}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-semibold bg-slate-50">{student.totalPresencesPossibles || 0}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-red-600">{student.totalAbsences || 0}</td>
                  <td className="border border-slate-300 px-2 py-1 text-center font-bold text-emerald-600">{student.totalPresenceEffectif || 0}</td>
                  <td className="border border-slate-300 px-2 py-1 text-[10px] text-slate-500">{student.observation || "\u2014"}</td>
                </tr>
              ))}
              {students.length === 0 && <tr><td colSpan={33} className="border border-slate-300 px-4 py-8 text-center text-slate-400 text-sm">Aucun \u00e9l\u00e8ve dans ce registre.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* R\u00e9capitulatif */}
      <div className="bg-white border-2 border-slate-300 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase">R\u00e9capitulatif du mois</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div className="bg-slate-50 p-3 rounded-lg"><div className="text-xs text-slate-500">Demi-journ\u00e9es du mois</div><div className="text-lg font-bold text-slate-700">{demiJourneeMois}</div></div>
          <div className="bg-slate-50 p-3 rounded-lg"><div className="text-xs text-slate-500">Pr\u00e9sences possibles</div><div className="text-lg font-bold text-slate-700">{register.presencePossibleMois ?? "\u2014"}</div></div>
          <div className="bg-red-50 p-3 rounded-lg"><div className="text-xs text-red-500">Total absences</div><div className="text-lg font-bold text-red-700">{register.totalAbsencesMois ?? "\u2014"}</div></div>
          <div className="bg-emerald-50 p-3 rounded-lg"><div className="text-xs text-emerald-500">Pr\u00e9sences effectives</div><div className="text-lg font-bold text-emerald-700">{register.totalPresencesEffectivesMois ?? "\u2014"}</div></div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-blue-50 p-3 rounded-lg"><div className="text-xs text-blue-500">% Pr\u00e9sences</div><div className="text-lg font-bold text-blue-700">{register.pourcentagePresences ?? "\u2014"}%</div></div>
          <div className="bg-amber-50 p-3 rounded-lg"><div className="text-xs text-amber-500">% Absences</div><div className="text-lg font-bold text-amber-700">{register.pourcentageAbsences ?? "\u2014"}%</div></div>
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t-2 border-slate-300">
        <div className="space-y-2"><div className="text-sm font-bold text-slate-800">Le Titulaire de la classe</div><div className="text-xs text-slate-500">Signature</div>{register.teacherSignature ? <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2"><img src={register.teacherSignature} alt="Sig" className="max-h-24 mx-auto" /></div> : <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center text-xs text-slate-400 italic">Non sign\u00e9</div>}</div>
        <div className="space-y-2"><div className="flex items-center justify-between"><div><div className="text-sm font-bold text-slate-800">Le Directeur / La Directrice</div><div className="text-xs text-slate-500">{isAlreadyValidated ? "" : "(obligatoire)"}</div></div>{directorSignature && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-full">Sign\u00e9</span>}</div>{directorSignature ? <div className="border-2 border-emerald-300 bg-emerald-50/30 rounded-xl p-2 relative"><img src={directorSignature} alt="Sig" className="max-h-24 mx-auto" />{!isAlreadyValidated && <button type="button" onClick={() => setDirectorSignature(null)} className="absolute top-1 right-1 text-xs text-red-500">Effacer</button>}</div> : <SignatureCanvas width={400} height={120} disabled={saving || isAlreadyValidated} placeholder="Signature (obligatoire)" onSignatureChange={(data) => setDirectorSignature(data)} />}</div>
      </div>
    </div>
  );
}

# ORION Bilingual Analysis - Documentation

## 📋 Vue d'Ensemble

Service ORION dédié à l'analyse des performances bilingues (FR vs EN) avec génération d'alertes pédagogiques, stratégiques et financières.

## 🎯 Principe Fondamental

**ORION est en lecture seule** :
- Ne modifie jamais les données
- Analyses factuelles uniquement
- Alertes basées sur des seuils configurables
- Ton institutionnel et neutre

## 🔄 Endpoints API

### Comparaison des Moyennes

```typescript
GET /api/orion/bilingual/comparison

// Réponse
{
  "frAverage": 12.8,
  "enAverage": 10.9,
  "gap": 1.9,
  "gapPercentage": 14.8
}
```

### Statistiques par Track

```typescript
GET /api/orion/bilingual/statistics

// Réponse
{
  "fr": {
    "trackCode": "FR",
    "totalStudents": 150,
    "totalExams": 450,
    "averageScore": 12.8,
    "successRate": 75.5,
    "classesCount": 12
  },
  "en": {
    "trackCode": "EN",
    "totalStudents": 45,
    "totalExams": 135,
    "averageScore": 10.9,
    "successRate": 65.2,
    "classesCount": 4
  }
}
```

### Écarts par Classe

```typescript
GET /api/orion/bilingual/class-gaps

// Réponse
[
  {
    "classId": "uuid",
    "className": "CP1",
    "frAverage": 13.2,
    "enAverage": 11.5,
    "gap": 1.7
  }
]
```

### Alertes

```typescript
GET /api/orion/bilingual/alerts

// Réponse
[
  {
    "type": "PEDAGOGICAL",
    "severity": "MEDIUM",
    "title": "Écart de performance FR/EN significatif",
    "message": "L'écart entre les moyennes FR (12.8) et EN (10.9) est de 14.8%",
    "data": { ... }
  }
]
```

### Rapport Complet

```typescript
GET /api/orion/bilingual/report

// Réponse
{
  "comparison": { ... },
  "frStats": { ... },
  "enStats": { ... },
  "classGaps": [ ... ],
  "alerts": [ ... ]
}
```

## 🔔 Types d'Alertes

### Alertes Pédagogiques

1. **Écart moyen FR/EN > 20%**
   - Severity: MEDIUM (20-30%) ou HIGH (>30%)
   - Message: Écart de performance significatif

2. **Baisse continue des résultats EN (2 périodes)**
   - À implémenter avec historique

3. **Classe EN sans évaluation depuis X jours**
   - À implémenter avec dates d'examens

### Alertes Stratégiques

1. **Déséquilibre fort FR vs EN**
   - Ratio EN/FR < 33%
   - Severity: MEDIUM

2. **Surcharge pédagogique**
   - Double track actif avec peu d'élèves EN
   - Severity: LOW

3. **Sous-utilisation du track EN**
   - < 5 élèves après activation
   - Severity: LOW

### Alertes Financières

1. **Option bilingue activée sans paiement régularisé**
   - À implémenter avec système de paiement

2. **Faible ROI pédagogique du bilingue**
   - À implémenter avec métriques ROI

## 📊 Requêtes SQL Utilisées

### Moyenne générale par track

```sql
SELECT
  AVG(grade.score) AS average_score
FROM grades grade
JOIN exams exam ON exam.id = grade.exam_id
WHERE grade.tenant_id = :tenantId
  AND exam.academic_track_id = :trackId
```

### Taux de réussite par track

```sql
SELECT
  COUNT(*) FILTER (WHERE grade.score >= 10) * 100.0 / COUNT(*) AS success_rate
FROM grades grade
JOIN exams exam ON exam.id = grade.exam_id
WHERE grade.tenant_id = :tenantId
  AND exam.academic_track_id = :trackId
```

### Répartition des élèves par track

```sql
SELECT
  COUNT(DISTINCT student_id) AS total_students
FROM student_academic_tracks
WHERE tenant_id = :tenantId
  AND academic_track_id = :trackId
```

## 🎨 Intégration Frontend

### Composant Dashboard Comparatif

```typescript
// BilingualComparisonDashboard.tsx
'use client';

import { useEffect, useState } from 'react';

export function BilingualComparisonDashboard() {
  const [report, setReport] = useState(null);

  useEffect(() => {
    fetch('/api/orion/bilingual/report')
      .then(res => res.json())
      .then(setReport);
  }, []);

  if (!report) return <div>Chargement...</div>;

  return (
    <div>
      <h2>Comparatif FR vs EN</h2>
      
      <div className="stats">
        <div>
          <h3>Moyenne FR</h3>
          <p>{report.frStats.averageScore.toFixed(2)} / 20</p>
        </div>
        <div>
          <h3>Moyenne EN</h3>
          <p>{report.enStats.averageScore.toFixed(2)} / 20</p>
        </div>
        <div>
          <h3>Écart</h3>
          <p>{report.comparison.gap.toFixed(2)}</p>
        </div>
      </div>

      <div className="alerts">
        {report.alerts.map(alert => (
          <div key={alert.title} className={`alert alert-${alert.severity.toLowerCase()}`}>
            <h4>{alert.title}</h4>
            <p>{alert.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 📝 Checklist d'Implémentation

- [x] Service `BilingualAnalysisService`
- [x] Controller `OrionBilingualController`
- [x] Module `OrionBilingualModule`
- [x] Endpoints API
- [x] Alertes pédagogiques (partielles)
- [x] Alertes stratégiques (partielles)
- [ ] Alertes financières (à compléter avec paiement)
- [ ] Historique des périodes (pour baisse continue)
- [ ] Dashboard frontend
- [ ] Tests unitaires

## 🎯 Objectifs Atteints

- ✅ Analyse comparative FR vs EN
- ✅ Statistiques par track
- ✅ Écarts par classe
- ✅ Génération d'alertes
- ✅ Rapport complet
- ✅ API REST complète


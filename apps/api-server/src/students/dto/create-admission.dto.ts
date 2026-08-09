import { IsString, IsOptional, IsIn, IsDateString, IsBoolean, IsNumber, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ValidBeninPhone } from '../../common/validators/phone.validator';

/**
 * DTO pour la création d'une admission.
 *
 * ⚠️ Tous les champs collectés par le formulaire frontend (AdmissionForm.tsx)
 * doivent être déclarés ici — sinon le ValidationPipe global avec
 * forbidNonWhitelisted=true rejette la requête avec "property X should not exist".
 *
 * Le service AdmissionService.create() persiste TOUS ces champs (depuis
 * la migration 20260701080000_extend_admissions_table).
 */
export class CreateAdmissionDto {
  @IsString()
  academicYearId: string;

  @IsString()
  schoolLevelId: string;

  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsOptional() @IsIn(['M', 'F'])
  gender?: string;

  @IsOptional() @IsDateString()
  dateOfBirth?: string;

  // ─── Identité élève ──────────────────────────────────────────────────────
  @IsOptional() @IsString()
  birthPlace?: string;

  @IsOptional() @IsString()
  nationality?: string;

  @IsOptional() @IsString()
  address?: string;

  // ─── Vœux académiques ────────────────────────────────────────────────────
  @IsOptional() @IsString()
  requestedClassId?: string;

  // ⭐ Classe OFFICIELLE souhaitée (AcademicClass UUID) — distinct de requestedClassId
  //    qui représente une classe physique. Permet à l'élève d'exprimer son vœu
  //    sur la classe officielle (ex: "6ème A" plutôt que "CI A section 1").
  @IsOptional() @IsString()
  requestedAcademicClassId?: string;

  @IsOptional() @IsString()
  requestedSeriesId?: string;

  @IsOptional() @IsBoolean()
  wantsBilingual?: boolean;

  @IsOptional() @IsString()
  previousSchool?: string;

  @IsOptional() @IsString()
  previousLevel?: string;

  @IsOptional() @IsString()
  changeReason?: string;

  // ─── Arriérés antérieurs (onboarding nouveaux clients) ──────────────────
  /** Montant des arriérés antérieurs (sur papier) à injecter dans le
   *  compte financier de l'élève. Permet aux nouveaux clients de saisir
   *  les arriérés existants au moment de l'admission. */
  @IsOptional() @IsNumber()
  previousArrears?: number;

  // ─── Statut élève (nouveau vs ancien) ────────────────────────────────────
  /** true = nouvel élève (paie frais d'INSCRIPTION)
   *  false = ancien élève (paie frais de RÉINSCRIPTION)
   *  Détermine le type de frais à appliquer lors de la conversion. */
  @IsOptional() @IsBoolean()
  isNewStudent?: boolean;

  // ─── Responsable légal ───────────────────────────────────────────────────
  @IsOptional() @IsString()
  mainGuardianName?: string;

  @IsOptional()
  @ValidBeninPhone()
  mainGuardianPhone?: string;

  @IsOptional() @IsString()
  mainGuardianEmail?: string;

  @IsOptional() @IsString()
  mainGuardianRelationship?: string;

  @IsOptional() @IsString()
  mainGuardianAddress?: string;

  @IsOptional() @IsString()
  mainGuardianProfession?: string;

  // ─── Divers ──────────────────────────────────────────────────────────────
  @IsOptional() @IsString()
  notes?: string;

  /** Frontend peut envoyer tenantId — ignoré (résolu server-side) */
  @IsOptional() @IsString()
  tenantId?: string;
}

/**
 * Type-safe helpers for tables whose generated types need
 * narrower enums or branded fields on the frontend.
 *
 * These re-export the auto-generated Row / Insert / Update shapes
 * and layer on stricter literals where needed.
 */

import type { Database } from './types';

/* ------------------------------------------------------------------ */
/*  diagnostic_config_templates                                       */
/* ------------------------------------------------------------------ */

type TemplateRow = Database['public']['Tables']['diagnostic_config_templates']['Row'];
type TemplateInsert = Database['public']['Tables']['diagnostic_config_templates']['Insert'];
type TemplateUpdate = Database['public']['Tables']['diagnostic_config_templates']['Update'];

/** Status stored in DB as `text`, but business-logic only allows these values. */
export type DiagnosticConfigTemplateStatus = 'draft' | 'approved' | 'archived';

/** Row type with narrowed `status` field. */
export type DiagnosticConfigTemplateRow = Omit<TemplateRow, 'status'> & {
  status: DiagnosticConfigTemplateStatus;
};

/** Insert payload – status narrowed. */
export type DiagnosticConfigTemplateInsert = Omit<TemplateInsert, 'status'> & {
  status?: DiagnosticConfigTemplateStatus;
};

/** Partial update payload – status narrowed. */
export type DiagnosticConfigTemplateUpdate = Omit<TemplateUpdate, 'status'> & {
  status?: DiagnosticConfigTemplateStatus;
};

/* ------------------------------------------------------------------ */
/*  template_scale_labels                                              */
/* ------------------------------------------------------------------ */

type LabelRow = Database['public']['Tables']['template_scale_labels']['Row'];
type LabelInsert = Database['public']['Tables']['template_scale_labels']['Insert'];
type LabelUpdate = Database['public']['Tables']['template_scale_labels']['Update'];

export type TemplateScaleLabelSkillType = 'hard' | 'soft';

export type TemplateScaleLabelRow = Omit<LabelRow, 'skill_type'> & {
  skill_type: TemplateScaleLabelSkillType;
};

export type TemplateScaleLabelInsert = Omit<LabelInsert, 'skill_type'> & {
  skill_type: TemplateScaleLabelSkillType;
};

export type TemplateScaleLabelUpdate = Omit<LabelUpdate, 'skill_type'> & {
  skill_type?: TemplateScaleLabelSkillType;
};

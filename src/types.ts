/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RiskLabel = "Safe" | "Adjust Dosage" | "Toxic" | "Ineffective" | "Unknown";
export type Severity = "none" | "low" | "moderate" | "high" | "critical";
export type Phenotype = "PM" | "IM" | "NM" | "RM" | "URM" | "Unknown";
export type EvidenceStrength = "Strong" | "Moderate" | "Weak";
export type CPICLevel = "A" | "B" | "C";

export interface DetectedVariant {
  rsid: string;
  gene: string;
  genotype: string;
  star_allele?: string;
  frequency?: number; // Population frequency
}

export interface RiskAssessment {
  risk_label: RiskLabel;
  confidence_score: number;
  severity: Severity;
}

export interface PhenotypeProbability {
  PM: number;
  IM: number;
  NM: number;
  RM: number;
  URM: number;
}

export interface PharmacogenomicProfile {
  primary_gene: string;
  diplotype: string;
  phenotype: Phenotype;
  detected_variants: DetectedVariant[];
  phenotype_probability: PhenotypeProbability;
  variant_rarity_score: number;
}

export interface CPICAlignment {
  guideline_level: CPICLevel;
  source: string;
  evidence_strength: EvidenceStrength;
}

export interface MultiGeneInteraction {
  genes_involved: string[];
  interaction_effect: string;
  composite_score: number;
}

export interface ClinicalRecommendation {
  action: string;
  dosage_adjustment?: string;
  alternatives?: string[];
  guideline_reference: string;
}

export interface LLMGeneratedExplanation {
  summary: string;
  biological_mechanism: string;
  variant_citations: string[];
  confidence_reasoning: string;
  counterfactual_analysis: string;
}

export interface QualityMetrics {
  vcf_parsing_success: boolean;
  variants_found: number;
  processing_time_ms: number;
  llm_hallucination_check: "passed" | "failed";
}

export interface PGxResult {
  patient_id: string;
  drug: string;
  timestamp: string;
  risk_assessment: RiskAssessment;
  pharmacogenomic_profile: PharmacogenomicProfile;
  cpic_alignment: CPICAlignment;
  multi_gene_interaction: MultiGeneInteraction;
  clinical_recommendation: ClinicalRecommendation;
  llm_generated_explanation: LLMGeneratedExplanation;
  quality_metrics: QualityMetrics;
}

export const SUPPORTED_DRUGS = [
  "CODEINE",
  "WARFARIN",
  "CLOPIDOGREL",
  "SIMVASTATIN",
  "AZATHIOPRINE",
  "FLUOROURACIL"
] as const;

export type SupportedDrug = typeof SUPPORTED_DRUGS[number];

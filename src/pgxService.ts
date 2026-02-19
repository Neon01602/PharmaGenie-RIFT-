import { 
  PGxResult, 
  SupportedDrug, 
  DetectedVariant, 
  RiskLabel, 
  Severity, 
  Phenotype,
  CPICLevel,
  EvidenceStrength
} from "./types";
import { getPhenotype } from "./vcfUtils";

const DRUG_GENE_MAP: Record<SupportedDrug, string> = {
  CODEINE: "CYP2D6",
  WARFARIN: "CYP2C9",
  CLOPIDOGREL: "CYP2C19",
  SIMVASTATIN: "SLCO1B1",
  AZATHIOPRINE: "TPMT",
  FLUOROURACIL: "DPYD",
};

/**
 * Bayesian-inspired confidence scoring model.
 * Weights: CPIC Level (0.4), Variant Reliability (0.3), Annotation Completeness (0.3)
 */
function calculateConfidence(
  level: CPICLevel, 
  variantsFound: number, 
  geneCoverage: number
): number {
  const levelWeight = level === "A" ? 1.0 : level === "B" ? 0.7 : 0.4;
  const reliability = Math.min(variantsFound / 2, 1.0);
  const completeness = geneCoverage;
  
  return (levelWeight * 0.4) + (reliability * 0.3) + (completeness * 0.3);
}

export function analyzeDrugRisk(
  drug: SupportedDrug, 
  variants: DetectedVariant[]
): Omit<PGxResult, "llm_generated_explanation" | "patient_id" | "timestamp" | "quality_metrics"> {
  const gene = DRUG_GENE_MAP[drug];
  const { diplotype, phenotype, probabilities, rarityScore } = getPhenotype(gene, variants);

  let risk_label: RiskLabel = "Safe";
  let severity: Severity = "none";
  let action = "Standard dosing according to clinical standards.";
  let dosage_adjustment = "None";
  let alternatives: string[] = [];
  let cpic_level: CPICLevel = "A";
  let evidence_strength: EvidenceStrength = "Strong";
  let interaction_effect = "No significant multi-gene interactions detected.";
  let genes_involved = [gene];
  let composite_score = 0.0;

  // Deterministic CPIC Rule Engine
  switch (drug) {
    case "CODEINE":
      if (phenotype === "URM") {
        risk_label = "Toxic";
        severity = "high";
        action = "Avoid codeine use due to potential for toxicity.";
        dosage_adjustment = "N/A";
        alternatives = ["Morphine", "Non-opioid analgesics"];
      } else if (phenotype === "PM") {
        risk_label = "Ineffective";
        severity = "moderate";
        action = "Avoid codeine use due to lack of efficacy.";
        dosage_adjustment = "N/A";
        alternatives = ["Morphine", "Oxycodone"];
      }
      break;
    case "WARFARIN":
      // Multi-gene interaction: CYP2C9 + VKORC1 (simulated via rs9923231)
      const vkorc1 = variants.find(v => v.rsid === "rs9923231");
      if (vkorc1) {
        genes_involved.push("VKORC1");
        interaction_effect = "CYP2C9 metabolism combined with VKORC1 sensitivity significantly alters warfarin requirements.";
        composite_score = 0.85;
      }
      if (phenotype === "PM" || phenotype === "IM") {
        risk_label = "Adjust Dosage";
        severity = "moderate";
        action = "Lower initial dose recommended.";
        dosage_adjustment = phenotype === "PM" ? "Decrease dose by 50-70%" : "Decrease dose by 20-30%";
        alternatives = ["DOACs (Apixaban, Rivaroxaban)"];
      }
      break;
    case "CLOPIDOGREL":
      if (phenotype === "PM" || phenotype === "IM") {
        risk_label = "Ineffective";
        severity = "high";
        action = "Avoid clopidogrel; consider alternative antiplatelet therapy.";
        dosage_adjustment = "N/A";
        alternatives = ["Prasugrel", "Ticagrelor"];
      }
      break;
    case "SIMVASTATIN":
      if (phenotype === "PM" || phenotype === "IM") {
        risk_label = "Toxic";
        severity = "moderate";
        action = "Prescribe lower dose or consider alternative statin.";
        dosage_adjustment = "Limit dose to 20mg/day or less.";
        alternatives = ["Pravastatin", "Rosuvastatin"];
      }
      break;
    case "AZATHIOPRINE":
      if (phenotype === "PM") {
        risk_label = "Toxic";
        severity = "critical";
        action = "Drastically reduce dose or avoid use.";
        dosage_adjustment = "Reduce dose by 10-fold and monitor closely.";
        alternatives = ["Methotrexate", "Mycophenolate mofetil"];
      }
      break;
    case "FLUOROURACIL":
      // DPYD variant burden modeling
      const dpydVariants = variants.filter(v => v.gene === "DPYD");
      if (dpydVariants.length > 1) {
        interaction_effect = "Multiple DPYD variants detected, increasing risk of severe toxicity.";
        composite_score = 0.9;
      }
      if (phenotype === "PM") {
        risk_label = "Toxic";
        severity = "critical";
        action = "Avoid use or significantly reduce dose.";
        dosage_adjustment = "Reduce dose by 50% or more.";
        alternatives = ["Capecitabine", "Alternative chemotherapy"];
      }
      break;
  }

  const confidence_score = calculateConfidence(cpic_level, variants.filter(v => v.gene === gene).length, 0.9);

  return {
    drug,
    risk_assessment: {
      risk_label,
      severity,
      confidence_score,
    },
    pharmacogenomic_profile: {
      primary_gene: gene,
      diplotype,
      phenotype: phenotype as Phenotype,
      detected_variants: variants.filter(v => v.gene === gene || v.rsid.includes(gene)),
      phenotype_probability: probabilities,
      variant_rarity_score: rarityScore,
    },
    cpic_alignment: {
      guideline_level: cpic_level,
      source: "CPIC Guideline for " + drug,
      evidence_strength: evidence_strength,
    },
    multi_gene_interaction: {
      genes_involved,
      interaction_effect,
      composite_score,
    },
    clinical_recommendation: {
      action,
      dosage_adjustment,
      alternatives: alternatives.length > 0 ? alternatives : undefined,
      guideline_reference: "CPIC Guidelines (Clinical Pharmacogenetics Implementation Consortium)",
    },
  };
}

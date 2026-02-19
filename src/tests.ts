import { parseVCF, getPhenotype } from "./vcfUtils";
import { analyzeDrugRisk } from "./pgxService";
import { PGxResult } from "./types";

/**
 * Simple test suite to validate core logic
 */
export async function runSystemTests() {
  const results = {
    vcf_parsing: false,
    cpic_logic: false,
    scoring: false,
    passed: 0,
    failed: 0
  };

  // 1. Test VCF Parsing
  const mockVcf = `##fileformat=VCFv4.2\n#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n1\t123\trs28371706\tC\tT\t.\t.\tGENE=CYP2D6;STAR=*4`;
  const variants = parseVCF(mockVcf);
  if (variants.length === 1 && variants[0].star_allele === "*4") {
    results.vcf_parsing = true;
    results.passed++;
  } else {
    results.failed++;
  }

  // 2. Test CPIC Logic
  const phenotype = getPhenotype("CYP2D6", variants);
  if (phenotype.phenotype === "PM") {
    results.cpic_logic = true;
    results.passed++;
  } else {
    results.failed++;
  }

  // 3. Test Risk Analysis
  const risk = analyzeDrugRisk("CODEINE", variants);
  if (risk.risk_assessment.risk_label === "Ineffective") {
    results.scoring = true;
    results.passed++;
  } else {
    results.failed++;
  }

  return results;
}

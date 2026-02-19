import { DetectedVariant } from "./types";

/**
 * Simulated population frequencies for common PGx variants
 */
const VARIANT_FREQUENCIES: Record<string, number> = {
  "rs9923231": 0.35, // VKORC1 (Warfarin)
  "rs4149056": 0.15, // SLCO1B1 (Simvastatin)
  "rs12248560": 0.18, // CYP2C19*17
  "rs28371706": 0.01, // CYP2D6*4
  "rs1057910": 0.07, // CYP2C9*3
  "rs1799853": 0.12, // CYP2C9*2
};

/**
 * A robust VCF parser that looks for specific pharmacogenomic variants.
 */
export function parseVCF(content: string): DetectedVariant[] {
  const lines = content.split("\n");
  const variants: DetectedVariant[] = [];

  for (const line of lines) {
    if (line.startsWith("#") || !line.trim()) continue;

    const parts = line.split("\t");
    if (parts.length < 8) continue;

    const [chrom, pos, id, ref, alt, qual, filter, info] = parts;

    // Look for RSID in the ID column or INFO column
    let rsid = id !== "." ? id : "";
    if (!rsid) {
      const rsMatch = info.match(/RS=(rs\d+)/);
      if (rsMatch) rsid = rsMatch[1];
    }

    // Look for Gene and Star Allele in INFO
    const geneMatch = info.match(/GENE=([^;]+)/);
    const starMatch = info.match(/STAR=([^;]+)/);

    if (rsid || geneMatch || starMatch) {
      const detectedRsid = rsid || "unknown";
      variants.push({
        rsid: detectedRsid,
        gene: geneMatch ? geneMatch[1] : "Unknown",
        genotype: `${ref}/${alt}`,
        star_allele: starMatch ? starMatch[1] : undefined,
        frequency: VARIANT_FREQUENCIES[detectedRsid] || 0.05, // Default low frequency for unknown
      });
    }
  }

  return variants;
}

/**
 * Maps variants to a phenotype for a specific gene.
 * Enhanced with probability modeling.
 */
export function getPhenotype(gene: string, variants: DetectedVariant[]): { 
  diplotype: string; 
  phenotype: any;
  probabilities: any;
  rarityScore: number;
} {
  const geneVariants = variants.filter(v => v.gene === gene || v.rsid.includes(gene));
  
  // Default values
  let diplotype = "*1/*1";
  let phenotype = "NM";
  let probabilities = { PM: 0.05, IM: 0.15, NM: 0.70, RM: 0.05, URM: 0.05 };
  let rarityScore = 0.0;

  // Calculate rarity score (average of inverse frequencies)
  if (geneVariants.length > 0) {
    rarityScore = 1 - (geneVariants.reduce((acc, v) => acc + (v.frequency || 0.5), 0) / geneVariants.length);
  }

  if (gene === "CYP2D6") {
    if (geneVariants.some(v => v.star_allele === "*4")) {
      diplotype = "*4/*4";
      phenotype = "PM";
      probabilities = { PM: 0.90, IM: 0.08, NM: 0.02, RM: 0.0, URM: 0.0 };
    } else if (geneVariants.some(v => v.star_allele === "*1xN")) {
      diplotype = "*1/*1xN";
      phenotype = "URM";
      probabilities = { PM: 0.0, IM: 0.0, NM: 0.10, RM: 0.20, URM: 0.70 };
    }
  } else if (gene === "CYP2C19") {
    if (geneVariants.some(v => v.star_allele === "*2")) {
      diplotype = "*2/*2";
      phenotype = "PM";
      probabilities = { PM: 0.85, IM: 0.10, NM: 0.05, RM: 0.0, URM: 0.0 };
    } else if (geneVariants.some(v => v.star_allele === "*17")) {
      diplotype = "*17/*17";
      phenotype = "RM";
      probabilities = { PM: 0.0, IM: 0.0, NM: 0.15, RM: 0.80, URM: 0.05 };
    }
  } else if (gene === "CYP2C9") {
    if (geneVariants.some(v => v.star_allele === "*3")) {
      diplotype = "*3/*3";
      phenotype = "PM";
      probabilities = { PM: 0.95, IM: 0.04, NM: 0.01, RM: 0.0, URM: 0.0 };
    } else if (geneVariants.some(v => v.star_allele === "*2")) {
      diplotype = "*2/*2";
      phenotype = "IM";
      probabilities = { PM: 0.10, IM: 0.80, NM: 0.10, RM: 0.0, URM: 0.0 };
    }
  } else if (gene === "SLCO1B1") {
    if (geneVariants.some(v => v.rsid === "rs4149056" && v.genotype.includes("C"))) {
      diplotype = "T/C";
      phenotype = "IM";
      probabilities = { PM: 0.10, IM: 0.85, NM: 0.05, RM: 0.0, URM: 0.0 };
      if (geneVariants.some(v => v.genotype === "C/C")) {
        diplotype = "C/C";
        phenotype = "PM";
        probabilities = { PM: 0.95, IM: 0.05, NM: 0.0, RM: 0.0, URM: 0.0 };
      }
    }
  } else if (gene === "TPMT") {
    if (geneVariants.some(v => v.star_allele === "*3A")) {
      diplotype = "*3A/*3A";
      phenotype = "PM";
      probabilities = { PM: 0.98, IM: 0.02, NM: 0.0, RM: 0.0, URM: 0.0 };
    }
  } else if (gene === "DPYD") {
    if (geneVariants.some(v => v.star_allele === "*2A")) {
      diplotype = "*2A/*2A";
      phenotype = "PM";
      probabilities = { PM: 0.99, IM: 0.01, NM: 0.0, RM: 0.0, URM: 0.0 };
    }
  }

  return { diplotype, phenotype, probabilities, rarityScore };
}

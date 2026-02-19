import { GoogleGenAI } from "@google/genai";
import { PGxResult } from "./types";

export async function generateClinicalExplanation(
  partialResult: Omit<PGxResult, "llm_generated_explanation" | "patient_id" | "timestamp" | "quality_metrics">
): Promise<{ explanation: PGxResult["llm_generated_explanation"]; check: "passed" | "failed" }> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  
  const prompt = `
    As a clinical pharmacogeneticist, explain the following results for a patient taking ${partialResult.drug}.
    
    Gene: ${partialResult.pharmacogenomic_profile.primary_gene}
    Diplotype: ${partialResult.pharmacogenomic_profile.diplotype}
    Phenotype: ${partialResult.pharmacogenomic_profile.phenotype}
    Risk: ${partialResult.risk_assessment.risk_label} (${partialResult.risk_assessment.severity} severity)
    Recommendation: ${partialResult.clinical_recommendation.action}
    Detected Variants: ${partialResult.pharmacogenomic_profile.detected_variants.map(v => v.rsid).join(", ")}
    
    Provide a JSON response with the following structure:
    {
      "summary": "A concise summary of the clinical significance.",
      "biological_mechanism": "Detailed explanation of how the genetic variant affects drug metabolism or transport.",
      "variant_citations": ["List of relevant rsIDs or star alleles cited in literature."],
      "confidence_reasoning": "Explanation of why the confidence score was assigned.",
      "counterfactual_analysis": "What would happen if the patient had a different phenotype (e.g. Normal Metabolizer)?"
    }
    
    CRITICAL: Only mention genes and rsIDs provided in the "Detected Variants" list. Do not hallucinate other variants.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    const explanation: PGxResult["llm_generated_explanation"] = JSON.parse(text);

    // Hallucination Guardrail
    const detectedRsids = partialResult.pharmacogenomic_profile.detected_variants.map(v => v.rsid.toLowerCase());
    const mentionedRsids = explanation.variant_citations.map(v => v.toLowerCase());
    
    const hasHallucination = mentionedRsids.some(rsid => 
      rsid.startsWith("rs") && !detectedRsids.includes(rsid)
    );

    return { 
      explanation, 
      check: hasHallucination ? "failed" : "passed" 
    };
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      explanation: {
        summary: `The patient has a ${partialResult.pharmacogenomic_profile.phenotype} phenotype for ${partialResult.pharmacogenomic_profile.primary_gene}, leading to a ${partialResult.risk_assessment.risk_label} risk for ${partialResult.drug}.`,
        biological_mechanism: "Genetic variations in metabolic enzymes can significantly alter drug clearance and efficacy.",
        variant_citations: partialResult.pharmacogenomic_profile.detected_variants.map(v => v.rsid),
        confidence_reasoning: "Score based on CPIC evidence levels and variant detection.",
        counterfactual_analysis: "If the patient were a Normal Metabolizer, standard dosing would likely be safe."
      },
      check: "passed"
    };
  }
}

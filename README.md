# 🧬 PharmaGenie Pro -- AI-Powered Pharmacogenomic Intelligence

PharmaGenie Pro is a production-ready AI web application that analyzes
patient genetic data (VCF files) to generate personalized
pharmacogenomic (PGx) risk assessments using deterministic CPIC
guidelines combined with LLM-powered biological explainability.

------------------------------------------------------------------------

## 🌐 Live Application

**Production Website:**\
https://rainbow-melba-127f78.netlify.app/

**GitHub Repository:**\
https://github.com/Neon01602/PharmaGenie-RIFT-

------------------------------------------------------------------------

## 🧠 System Overview

PharmaGenie Pro integrates:

-   🧬 VCF Genetic Variant Parsing\
-   📚 CPIC-Based Deterministic Rule Engine\
-   🔁 Multi-Gene Interaction Modeling\
-   📊 Bayesian Confidence Scoring\
-   🤖 Gemini 3 Flash LLM Explainability\
-   🛡️ Hallucination Detection Guardrails

------------------------------------------------------------------------

## 🏗️ Production Architecture

    graph TD
        A[VCF Upload Interface] --> B[VCF Parsing Engine]
        B --> C[CPIC Rule Engine]
        C --> D[Multi-Gene Interaction Module]
        D --> E[Bayesian Risk Scoring Engine]
        E --> F[Gemini LLM Explainability]
        F --> G[Hallucination Validation Layer]
        G --> H[Structured JSON Clinical Output]
        H --> I[Interactive Dashboard UI]

------------------------------------------------------------------------

## 🔬 Core Pharmacogenomic Genes Supported

-   CYP2D6\
-   CYP2C19\
-   CYP2C9\
-   SLCO1B1\
-   TPMT\
-   DPYD

------------------------------------------------------------------------

## 📊 Confidence Scoring Model

The system calculates clinical confidence using a weighted formula:

    C = (W_L × 0.4) + (W_R × 0.3) + (W_A × 0.3)

Where:

-   **W_L** = CPIC evidence weight
    -   A = 1.0\
    -   B = 0.7\
    -   C = 0.4
-   **W_R** = Variant detection reliability\
-   **W_A** = Annotation completeness (default 0.9)

------------------------------------------------------------------------

## 🛡️ Hallucination Prevention Framework

To ensure clinical-grade reliability:

1.  Extract rsIDs and gene mentions from LLM output\
2.  Cross-check against detected VCF variants\
3.  Flag mismatches\
4.  Mark `llm_hallucination_check = failed` if inconsistencies found

This ensures the AI never references variants not present in the
patient's genome.

------------------------------------------------------------------------

## 👩‍⚕️ User Modes

### Physician Mode

-   Detailed biological mechanisms\
-   Counterfactual phenotype analysis\
-   Full variant-level explanation\
-   CPIC alignment references

### Patient Mode

-   Simplified language\
-   Non-technical explanation\
-   Safety-focused messaging

------------------------------------------------------------------------

## 🔐 Data Privacy & Safety

-   VCF parsing occurs in-browser\
-   Only metadata is sent to the LLM\
-   No genomic files are stored server-side\
-   Designed for educational & research use only

⚠️ **Not a diagnostic medical device.**

------------------------------------------------------------------------

## 🚀 Local Development Setup

Clone the repository:

    git clone https://github.com/Neon01602/PharmaGenie-RIFT-.git
    cd PharmaGenie-RIFT-

Install dependencies:

    npm install

Set environment variable:

    GEMINI_API_KEY=your_api_key_here

Run development server:

    npm run dev

------------------------------------------------------------------------

## 🌍 Deployment

The application is deployed on Netlify.

Production URL:\
https://rainbow-melba-127f78.netlify.app/

Continuous deployment is enabled via GitHub integration.

------------------------------------------------------------------------

## 🧪 Example Output Structure

The system generates structured JSON including:

-   Risk assessment\
-   Pharmacogenomic profile\
-   CPIC alignment\
-   Multi-gene interactions\
-   Clinical recommendation\
-   LLM biological explanation\
-   Quality validation metrics

------------------------------------------------------------------------

## 📈 Future Roadmap

-   Additional PGx gene expansion\
-   Real CPIC API integration\
-   FHIR interoperability\
-   EHR compatibility layer\
-   Multi-drug batch analysis\
-   PDF clinical report export

------------------------------------------------------------------------

## 🏆 Built For

-   Clinical Decision Support Demonstrations\
-   AI + Healthcare Hackathons\
-   Pharmacogenomics Research\
-   Explainable AI in Medicine

------------------------------------------------------------------------

© 2026 PharmaGenie Pro\
Educational & Research Use Only

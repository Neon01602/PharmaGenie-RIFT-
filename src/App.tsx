/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useMemo } from 'react';
import { 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Dna, 
  Pill, 
  ChevronDown, 
  ChevronUp, 
  Download, 
  Copy,
  Loader2,
  ExternalLink,
  Stethoscope,
  User,
  Settings2,
  Activity,
  ShieldAlert,
  Info,
  RefreshCcw,
  Layers,
  BarChart3
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { 
  PGxResult, 
  SUPPORTED_DRUGS, 
  SupportedDrug, 
  DetectedVariant,
  Phenotype
} from './types';
import { parseVCF, getPhenotype } from './vcfUtils';
import { analyzeDrugRisk } from './pgxService';
import { generateClinicalExplanation } from './geminiService';
import ReactMarkdown from 'react-markdown';

import { runSystemTests } from './tests';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type UserMode = 'physician' | 'patient';

export default function App() {
  const [files, setFiles] = useState<{ name: string; content: string }[]>([]);
  const [selectedDrugs, setSelectedDrugs] = useState<SupportedDrug[]>([]);
  const [results, setResults] = useState<PGxResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);
  const [userMode, setUserMode] = useState<UserMode>('physician');
  
  // Simulation state
  const [simulationMode, setSimulationMode] = useState(false);
  const [simulatedPhenotype, setSimulatedPhenotype] = useState<Phenotype>('NM');

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (selectedFiles.length > 0) {
      const validFiles = selectedFiles.filter(f => f.name.endsWith('.vcf') && f.size <= 5 * 1024 * 1024);
      if (validFiles.length < selectedFiles.length) {
        setError("Some files were rejected (must be .vcf and < 5MB).");
      } else {
        setError(null);
      }

      const filePromises = validFiles.map(f => {
        return new Promise<{ name: string; content: string }>((resolve) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            resolve({ name: f.name, content: event.target?.result as string });
          };
          reader.readAsText(f);
        });
      });

      Promise.all(filePromises).then(newFiles => {
        setFiles(prev => [...prev, ...newFiles]);
      });
    }
  };

  const toggleDrug = (drug: SupportedDrug) => {
    setSelectedDrugs(prev => 
      prev.includes(drug) 
        ? prev.filter(d => d !== drug) 
        : [...prev, drug]
    );
  };

  const processAnalysis = async () => {
    if (files.length === 0 || selectedDrugs.length === 0) {
      setError("Please upload at least one VCF file and select at least one drug.");
      return;
    }

    setIsProcessing(true);
    setError(null);
    const startTime = Date.now();

    try {
      const allResults: PGxResult[] = [];

      for (const fileData of files) {
        const variants = parseVCF(fileData.content);
        
        for (const drug of selectedDrugs) {
          const partial = analyzeDrugRisk(drug, variants);
          const { explanation, check } = await generateClinicalExplanation(partial);
          
          allResults.push({
            ...partial,
            patient_id: fileData.name.replace('.vcf', '').toUpperCase(),
            timestamp: new Date().toISOString(),
            llm_generated_explanation: explanation,
            quality_metrics: {
              vcf_parsing_success: true,
              variants_found: variants.length,
              processing_time_ms: Date.now() - startTime,
              llm_hallucination_check: check
            }
          });
        }
      }

      setResults(allResults);
      setExpandedIndex(0);
    } catch (err) {
      console.error(err);
      setError("An error occurred during processing. Please check your VCF format.");
    } finally {
      setIsProcessing(false);
    }
  };

  const updateSimulation = (idx: number, newPhenotype: Phenotype) => {
    const target = results[idx];
    const variants = target.pharmacogenomic_profile.detected_variants;
    
    // In simulation mode, we override the phenotype but keep the variants for context
    // This is a simplified simulation
    const updatedPartial = analyzeDrugRisk(target.drug as SupportedDrug, variants);
    
    // Manually override the phenotype and diplotype for the simulation
    updatedPartial.pharmacogenomic_profile.phenotype = newPhenotype;
    updatedPartial.pharmacogenomic_profile.diplotype = "SIMULATED";
    
    // Recalculate risk based on new phenotype (simplified)
    if (newPhenotype === 'PM') {
      updatedPartial.risk_assessment.risk_label = 'Toxic';
      updatedPartial.risk_assessment.severity = 'high';
    } else if (newPhenotype === 'NM') {
      updatedPartial.risk_assessment.risk_label = 'Safe';
      updatedPartial.risk_assessment.severity = 'none';
    }

    const updatedResults = [...results];
    updatedResults[idx] = {
      ...target,
      ...updatedPartial,
      timestamp: new Date().toISOString() + " (Simulated)"
    };
    setResults(updatedResults);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadJSON = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRiskColor = (label: string) => {
    switch (label) {
      case 'Safe': return 'text-emerald-600 bg-emerald-50 border-emerald-200';
      case 'Adjust Dosage': return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'Toxic': return 'text-rose-600 bg-rose-50 border-rose-200';
      case 'Ineffective': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-rose-600 text-white';
      case 'high': return 'bg-rose-500 text-white';
      case 'moderate': return 'bg-amber-500 text-white';
      case 'low': return 'bg-blue-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F7F9] text-slate-900 font-sans selection:bg-indigo-100">
      {/* Clinical Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <Dna className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="font-extrabold text-2xl tracking-tight text-slate-800">PharmaGenie <span className="text-indigo-600 font-light">Pro</span></h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Precision Medicine Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* User Mode Toggle */}
            <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
              <button 
                onClick={() => setUserMode('physician')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  userMode === 'physician' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Stethoscope className="w-3.5 h-3.5" />
                PHYSICIAN
              </button>
              <button 
                onClick={() => setUserMode('patient')}
                className={cn(
                  "px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
                  userMode === 'patient' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                <User className="w-3.5 h-3.5" />
                PATIENT
              </button>
            </div>

            <div className="h-8 w-px bg-slate-200 mx-2" />
            
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-slate-700">Clinical Portal</p>
                <p className="text-[10px] text-emerald-500 font-medium flex items-center justify-end gap-1">
                  <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                  System Active
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto px-6 py-10">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
          
          {/* Left Sidebar: Controls */}
          <div className="xl:col-span-4 space-y-8">
            
            {/* System Health Check */}
            <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">System Integrity</h2>
                </div>
                <button 
                  onClick={async () => {
                    const testResults = await runSystemTests();
                    alert(`System Check: ${testResults.passed} passed, ${testResults.failed} failed.`);
                  }}
                  className="text-[10px] font-bold text-indigo-600 hover:underline"
                >
                  RUN DIAGNOSTICS
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                  <p className="text-[8px] font-bold text-emerald-600 uppercase">Parser</p>
                  <p className="text-[10px] font-black text-emerald-700">ACTIVE</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                  <p className="text-[8px] font-bold text-emerald-600 uppercase">Engine</p>
                  <p className="text-[10px] font-black text-emerald-700">ACTIVE</p>
                </div>
                <div className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 text-center">
                  <p className="text-[8px] font-bold text-emerald-600 uppercase">AI Guard</p>
                  <p className="text-[10px] font-black text-emerald-700">ACTIVE</p>
                </div>
              </div>
            </section>

            {/* Batch Upload */}
            <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Batch Genomic Input</h2>
                </div>
                <span className="text-[10px] font-bold text-slate-400">{files.length} FILES</span>
              </div>
              
              <div className={cn(
                "relative border-2 border-dashed rounded-2xl p-8 transition-all duration-200 flex flex-col items-center justify-center text-center",
                files.length > 0 ? "border-indigo-200 bg-indigo-50/20" : "border-slate-200 hover:border-indigo-300 bg-slate-50/50"
              )}>
                <input 
                  type="file" 
                  accept=".vcf" 
                  multiple
                  onChange={onFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-12 h-12 bg-white rounded-2xl shadow-sm flex items-center justify-center mb-4">
                  <Upload className="text-indigo-600 w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 text-sm">Upload VCF Files</p>
                <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider">Drag & Drop or Click to Browse</p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                  {files.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 text-slate-400" />
                        <span className="text-xs font-bold text-slate-600 truncate max-w-[150px]">{f.name}</span>
                      </div>
                      <button onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500">
                        <RefreshCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Drug Selection */}
            <section className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-5">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-indigo-600" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">Medication Panel</h2>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {SUPPORTED_DRUGS.map(drug => (
                  <button
                    key={drug}
                    onClick={() => toggleDrug(drug)}
                    className={cn(
                      "px-4 py-4 rounded-2xl text-[11px] font-bold border transition-all duration-200 text-left flex items-center justify-between group",
                      selectedDrugs.includes(drug)
                        ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100"
                        : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/30"
                    )}
                  >
                    {drug}
                    <div className={cn(
                      "w-4 h-4 rounded-full border flex items-center justify-center transition-all",
                      selectedDrugs.includes(drug) ? "bg-white border-white" : "border-slate-300 group-hover:border-indigo-400"
                    )}>
                      {selectedDrugs.includes(drug) && <CheckCircle2 className="w-3 h-3 text-indigo-600" />}
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <button
              onClick={processAnalysis}
              disabled={isProcessing || files.length === 0 || selectedDrugs.length === 0}
              className="w-full py-5 bg-slate-900 text-white rounded-3xl font-bold shadow-2xl shadow-slate-200 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-3 group"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  ANALYZING GENOME...
                </>
              ) : (
                <>
                  <Activity className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  GENERATE CLINICAL REPORT
                </>
              )}
            </button>

            {error && (
              <div className="flex items-center gap-3 text-rose-600 bg-rose-50 p-4 rounded-2xl border border-rose-100 text-xs font-bold">
                <ShieldAlert className="w-5 h-5 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Right Content: Analysis & Heatmap */}
          <div className="xl:col-span-8 space-y-8">
            
            {results.length > 0 && (
              <section className="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-3">
                    <BarChart3 className="w-5 h-5 text-indigo-600" />
                    <h2 className="text-lg font-extrabold text-slate-800">Comparative Risk Matrix</h2>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest mr-4">
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-emerald-500 rounded-full" /> Safe</div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-amber-500 rounded-full" /> Adjust</div>
                      <div className="flex items-center gap-1.5"><div className="w-2 h-2 bg-rose-500 rounded-full" /> Toxic</div>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="text-left pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Patient ID</th>
                        {selectedDrugs.map(d => (
                          <th key={d} className="text-center pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from(new Set(results.map(r => r.patient_id))).map(pid => (
                        <tr key={pid} className="border-t border-slate-50">
                          <td className="py-4 text-xs font-bold text-slate-700">{pid}</td>
                          {selectedDrugs.map(d => {
                            const res = results.find(r => r.patient_id === pid && r.drug === d);
                            if (!res) return <td key={d} className="py-4 text-center">-</td>;
                            const color = res.risk_assessment.risk_label === 'Safe' ? 'bg-emerald-500' : 
                                          res.risk_assessment.risk_label === 'Adjust Dosage' ? 'bg-amber-500' : 'bg-rose-500';
                            return (
                              <td key={d} className="py-4 text-center">
                                <div className={cn("w-6 h-6 rounded-lg mx-auto shadow-sm", color)} title={res.risk_assessment.risk_label} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-800">Clinical Reports</h2>
              {results.length > 0 && (
                <button 
                  onClick={() => downloadJSON(results, 'pgx_full_report.json')}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-all"
                >
                  <Download className="w-4 h-4" />
                  EXPORT ALL DATA
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-[40px] p-20 flex flex-col items-center justify-center text-center space-y-6">
                <div className="w-24 h-24 bg-slate-50 rounded-[32px] flex items-center justify-center shadow-inner">
                  <Activity className="text-slate-200 w-12 h-12" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-slate-700">Awaiting Genomic Data</h3>
                  <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">Please upload patient VCF files and select target medications to generate precision reports.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {results.map((res, idx) => (
                  <motion.div 
                    key={`${res.patient_id}-${res.drug}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300"
                  >
                    {/* Alert Banner for High Risk */}
                    {(res.risk_assessment.risk_label === 'Toxic' || res.risk_assessment.risk_label === 'Ineffective') && (
                      <div className="bg-rose-600 px-8 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3 text-white">
                          <ShieldAlert className="w-5 h-5" />
                          <span className="text-xs font-black uppercase tracking-widest">Critical Clinical Alert: {res.risk_assessment.risk_label.toUpperCase()}</span>
                        </div>
                        <div className="text-[10px] font-bold text-rose-100 uppercase tracking-widest">Action Required</div>
                      </div>
                    )}

                    <div className="p-8">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                        <div className="flex items-center gap-5">
                          <div className={cn(
                            "w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm",
                            res.risk_assessment.risk_label === 'Safe' ? "bg-emerald-50 text-emerald-600" : 
                            res.risk_assessment.risk_label === 'Adjust Dosage' ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                          )}>
                            <Pill className="w-8 h-8" />
                          </div>
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="text-2xl font-black text-slate-800">{res.drug}</h3>
                              <span className="px-3 py-1 bg-slate-100 rounded-full text-[10px] font-bold text-slate-500 uppercase tracking-widest">{res.patient_id}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5" />
                                {res.pharmacogenomic_profile.primary_gene} Phenotype: <span className="text-slate-700">{res.pharmacogenomic_profile.phenotype}</span>
                              </p>
                              <div className="w-1 h-1 bg-slate-300 rounded-full" />
                              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Diplotype: <span className="text-slate-700">{res.pharmacogenomic_profile.diplotype}</span></p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <div className={cn(
                            "px-6 py-2 rounded-2xl text-xs font-black border uppercase tracking-[0.15em] shadow-sm",
                            getRiskColor(res.risk_assessment.risk_label)
                          )}>
                            {res.risk_assessment.risk_label}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Bayesian Confidence</span>
                            <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${res.risk_assessment.confidence_score * 100}%` }} />
                            </div>
                            <span className="text-[10px] font-black text-slate-700">{(res.risk_assessment.confidence_score * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Main Recommendation */}
                        <div className="lg:col-span-2 space-y-8">
                          <div className="bg-slate-50 rounded-3xl p-8 border border-slate-100 space-y-6">
                            <div className="flex items-center gap-2">
                              <Settings2 className="w-4 h-4 text-indigo-600" />
                              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical Recommendation Engine</h4>
                            </div>
                            
                            <div className="space-y-6">
                              <div>
                                <p className="text-lg font-bold text-slate-800 leading-snug">{res.clinical_recommendation.action}</p>
                              </div>
                              
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200/50">
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Dosage Adjustment</label>
                                  <p className="text-sm font-bold text-slate-700">{res.clinical_recommendation.dosage_adjustment || "Standard Dosing"}</p>
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Evidence Level</label>
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black">{res.cpic_alignment.guideline_level}</span>
                                    <span className="text-xs font-bold text-slate-700">{res.cpic_alignment.evidence_strength} Evidence</span>
                                  </div>
                                </div>
                              </div>

                              {res.clinical_recommendation.alternatives && (
                                <div className="pt-4 border-t border-slate-200/50">
                                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-3">Alternative Therapies</label>
                                  <div className="flex flex-wrap gap-2">
                                    {res.clinical_recommendation.alternatives.map(alt => (
                                      <span key={alt} className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 shadow-sm">{alt}</span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* AI Explanation Section */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Info className="w-4 h-4 text-indigo-600" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Explainable AI (XAI) Insight</h4>
                              </div>
                              <div className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold",
                                res.quality_metrics.llm_hallucination_check === 'passed' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                              )}>
                                <ShieldAlert className="w-3 h-3" />
                                Hallucination Check: {res.quality_metrics.llm_hallucination_check.toUpperCase()}
                              </div>
                            </div>

                            <div className="prose prose-slate prose-sm max-w-none bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                              <div className="space-y-6">
                                <div>
                                  <h5 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-2">Clinical Summary</h5>
                                  <div className="text-slate-600 leading-relaxed font-medium">
                                    <ReactMarkdown>{userMode === 'physician' ? res.llm_generated_explanation.summary : "This medication may not work as expected or could cause side effects based on your genetic markers. Your doctor should review these results before making any changes."}</ReactMarkdown>
                                  </div>
                                </div>
                                
                                {userMode === 'physician' && (
                                  <>
                                    <div>
                                      <h5 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-2">Biological Mechanism</h5>
                                      <div className="text-slate-600 leading-relaxed italic">
                                        <ReactMarkdown>{res.llm_generated_explanation.biological_mechanism}</ReactMarkdown>
                                      </div>
                                    </div>
                                    <div>
                                      <h5 className="text-xs font-black uppercase tracking-widest text-slate-800 mb-2">Counterfactual Analysis</h5>
                                      <p className="text-xs text-slate-500 font-medium bg-slate-50 p-3 rounded-xl border border-slate-100">
                                        {res.llm_generated_explanation.counterfactual_analysis}
                                      </p>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Technical Details & Simulation */}
                        <div className="space-y-8">
                          {/* Simulation Mode */}
                          <div className="bg-indigo-50/50 rounded-3xl p-6 border border-indigo-100 space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <RefreshCcw className="w-4 h-4 text-indigo-600" />
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">Simulation Mode</h4>
                              </div>
                              <div className="w-8 h-4 bg-indigo-200 rounded-full relative cursor-pointer" onClick={() => setSimulationMode(!simulationMode)}>
                                <div className={cn("absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all", simulationMode ? "left-4.5" : "left-0.5")} />
                              </div>
                            </div>
                            
                            {simulationMode ? (
                              <div className="space-y-3">
                                <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">Override Phenotype</p>
                                <div className="grid grid-cols-3 gap-2">
                                  {['PM', 'IM', 'NM', 'RM', 'URM'].map(p => (
                                    <button 
                                      key={p} 
                                      onClick={() => updateSimulation(idx, p as Phenotype)}
                                      className={cn(
                                        "px-2 py-1.5 rounded-lg text-[10px] font-black border transition-all",
                                        res.pharmacogenomic_profile.phenotype === p ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-100"
                                      )}
                                    >
                                      {p}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : (
                              <p className="text-[10px] font-medium text-indigo-400 leading-relaxed">Enable simulation mode to manually test different genetic outcomes and see real-time risk updates.</p>
                            )}
                          </div>

                          {/* Multi-gene Interaction */}
                          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Multi-Gene Interaction</h4>
                            <div className="space-y-3">
                              <div className="flex flex-wrap gap-2">
                                {res.multi_gene_interaction.genes_involved.map(g => (
                                  <span key={g} className="px-2 py-1 bg-slate-100 rounded text-[10px] font-black text-slate-600">{g}</span>
                                ))}
                              </div>
                              <p className="text-[11px] font-medium text-slate-500 leading-relaxed">{res.multi_gene_interaction.interaction_effect}</p>
                              <div className="pt-2">
                                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mb-1">
                                  <span>BURDEN SCORE</span>
                                  <span>{(res.multi_gene_interaction.composite_score * 10).toFixed(1)}/10</span>
                                </div>
                                <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                                  <div className="h-full bg-slate-300 rounded-full" style={{ width: `${res.multi_gene_interaction.composite_score * 100}%` }} />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Phenotype Probabilities */}
                          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phenotype Probability</h4>
                            <div className="space-y-3">
                              {Object.entries(res.pharmacogenomic_profile.phenotype_probability).map(([p, prob]) => (
                                <div key={p} className="space-y-1">
                                  <div className="flex items-center justify-between text-[10px] font-bold">
                                    <span className={cn(res.pharmacogenomic_profile.phenotype === p ? "text-indigo-600" : "text-slate-400")}>{p}</span>
                                    <span className="text-slate-700">{(prob * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="w-full h-1 bg-slate-50 rounded-full overflow-hidden">
                                    <div className={cn("h-full rounded-full", res.pharmacogenomic_profile.phenotype === p ? "bg-indigo-500" : "bg-slate-200")} style={{ width: `${prob * 100}%` }} />
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Detected Variants */}
                          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Detected Variants</h4>
                            <div className="space-y-2">
                              {res.pharmacogenomic_profile.detected_variants.map(v => (
                                <div key={v.rsid} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                  <span className="text-[10px] font-black text-slate-700">{v.rsid}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{v.genotype}</span>
                                </div>
                              ))}
                              <div className="pt-2 flex items-center justify-between">
                                <span className="text-[10px] font-bold text-slate-400">RARITY SCORE</span>
                                <span className="text-[10px] font-black text-indigo-600">{(res.pharmacogenomic_profile.variant_rarity_score * 100).toFixed(1)}%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Footer Actions */}
                      <div className="flex items-center justify-between mt-10 pt-6 border-t border-slate-100">
                        <div className="flex items-center gap-6">
                          <button 
                            onClick={() => copyToClipboard(JSON.stringify(res, null, 2))}
                            className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Copy JSON
                          </button>
                          <button 
                            onClick={() => downloadJSON(res, `pgx_${res.drug.toLowerCase()}.json`)}
                            className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-widest"
                          >
                            <Download className="w-3.5 h-3.5" />
                            Export Report
                          </button>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Ref: {res.cpic_alignment.source}</span>
                          <a 
                            href="https://cpicpgx.org/guidelines/" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black text-indigo-600 hover:bg-indigo-100 transition-all uppercase tracking-widest"
                          >
                            CPIC GUIDELINES
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      
      {/* Background Decor */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-50/30 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-50/30 rounded-full blur-[120px]" />
      </div>
    </div>
  );
}

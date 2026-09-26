"use client";

import { useState } from "react";
import { fetchRotationPlan } from "@/lib/api";
import { RecommendationRequest, RecommendationResponse } from "@/types/api";
import { Leaf, Map, History as HistoryIcon, Beaker } from "lucide-react";

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<RecommendationResponse | null>(null);

  const handleTestApi = async () => {
    setLoading(true);
    try {
      const payload: RecommendationRequest = {
        location: { latitude: 31.52, longitude: 74.35 },
        region_id: "punjab_pk_demo_v1",
        assessment_end: "2025-10-15",
        slots: [
          { slot_id: "rabi_2025", start_date: "2025-11-01", end_date: "2026-03-31" }
        ],
        crop_history: [
          { crop_id: "maize", start_date: "2025-05-01", end_date: "2025-09-30", residue_management: "retained" }
        ],
        irrigation: "rainfed",
        data_mode: "fixture",
        top_k: 3
      };
      const data = await fetchRotationPlan(payload);
      console.log("Mock API Response:", data);
      setResponse(data);
    } catch (err) {
      console.error(err);
      alert("Failed to fetch from API. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center shadow-sm">
        <Leaf className="text-emerald-600 mr-3 h-6 w-6" />
        <h1 className="text-xl font-bold tracking-tight text-slate-800">Field Shift - NASA Earth Observation Crop Decision Engine</h1>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left Column: Map/Input Controls Placeholder */}
          <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center">
                <Map className="text-slate-500 mr-2 h-5 w-5" />
                <h2 className="font-semibold text-slate-700">Location & Parameters</h2>
              </div>
              <div className="p-6 flex-grow flex flex-col items-center justify-center min-h-[300px] text-center border-dashed border-2 border-slate-100 m-4 rounded-lg bg-slate-50">
                <p className="text-slate-500 mb-4 text-sm">Map and parameter selection will appear here.</p>
                <button 
                  onClick={handleTestApi} 
                  disabled={loading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-6 rounded-lg transition-colors flex items-center"
                >
                  {loading ? "Fetching..." : "Test Rotation Plan API"}
                </button>
              </div>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
              <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center">
                <HistoryIcon className="text-slate-500 mr-2 h-5 w-5" />
                <h2 className="font-semibold text-slate-700">Crop History & Soil</h2>
              </div>
              <div className="p-6 flex-grow flex flex-col items-center justify-center min-h-[200px] text-center border-dashed border-2 border-slate-100 m-4 rounded-lg bg-slate-50">
                 <Beaker className="text-slate-300 h-8 w-8 mb-2" />
                 <p className="text-slate-400 text-sm">Farmer inputs configuration</p>
              </div>
            </div>
          </div>

          {/* Right Column: Timeline Cards Placeholder */}
          <div className="w-full lg:w-2/3">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 h-full overflow-hidden flex flex-col">
              <div className="bg-slate-100 p-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="font-semibold text-slate-700">Recommended Rotation Paths</h2>
                {response && <span className="bg-emerald-100 text-emerald-800 text-xs px-2 py-1 rounded-full font-medium">{response.status.toUpperCase()}</span>}
              </div>
              
              <div className="p-6 flex-grow">
                {response ? (
                  <div className="space-y-4">
                    {response.recommendations.map((rec) => (
                      <div key={rec.rotation_id} className="border border-emerald-100 bg-emerald-50/30 rounded-lg p-4">
                        <div className="flex justify-between items-center mb-3">
                          <h3 className="font-bold text-lg text-emerald-900">Rank #{rec.rank} - Score: {rec.score.toFixed(1)}</h3>
                        </div>
                        <div className="space-y-2">
                          {rec.slots.map(slot => (
                            <div key={slot.slot_id} className="bg-white p-3 rounded border border-slate-100 shadow-sm flex items-center justify-between">
                              <div>
                                <span className="font-semibold text-slate-800">{slot.crop_name}</span>
                                <span className="text-slate-500 text-sm ml-2">({slot.start_date} to {slot.end_date})</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 text-sm text-slate-600 bg-white p-3 rounded border border-slate-100">
                          <span className="font-semibold">Reasons:</span>
                          <ul className="list-disc pl-5 mt-1 space-y-1">
                            {rec.reasons.map((r, i) => (
                              <li key={i}>{r.message}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                    
                    <div className="mt-6 pt-4 border-t border-slate-100">
                       <h4 className="text-sm font-semibold text-slate-700 mb-2">Raw API Response Context:</h4>
                       <pre className="bg-slate-800 text-emerald-400 p-4 rounded text-xs overflow-auto max-h-[300px]">
                         {JSON.stringify(response, null, 2)}
                       </pre>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center border-dashed border-2 border-slate-200 rounded-lg bg-slate-50/50 p-12">
                    <Leaf className="text-slate-300 h-12 w-12 mb-4" />
                    <h3 className="text-lg font-medium text-slate-600 mb-2">No Plans Generated Yet</h3>
                    <p className="text-slate-500 text-center max-w-md">
                      Configure your location, target seasons, and historical data on the left to generate NASA data-backed crop rotation pathways.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

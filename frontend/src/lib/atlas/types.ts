export type StrategyId = 'baseline' | 'cover' | 'diverse' | 'forage';
export type CropId = 'maize' | 'soybean' | 'wheat' | 'oats' | 'alfalfa' | 'rye' | 'clover';
export type Confirmation = boolean | null;
export type Feasibility = 'pass' | 'fail' | 'unknown';
export interface HistoryWindow {
  id:string;start:string;end:string;status:'uncertain'|'farmer-confirmed';
  cover:'unknown'|'bare-soil'|'residue-present'|'living-cover'|'mixed';
  note:string;observationIds:string[];updatedAt:string;
}
export interface ManagementRecord {
  id:string;date:string;operation:'plant'|'harvest'|'tillage'|'termination'|'residue-retained'|'residue-removed';
  crop:string;note:string;updatedAt:string;
}
export interface FieldHistory {
  schemaVersion:'field-history-v1';boundary:[number,number][]|null;
  start:string;end:string;lowNdvi:number;maxGapDays:number;rainThresholdMm:number;heatThresholdC:number;
  windows:HistoryWindow[];management:ManagementRecord[];
}
export interface WeatherDay { date: string; rain: number | null; tmin: number | null; tmax: number | null; rh: number | null; wind: number | null; solar: number | null }
export interface EvidenceSeries { schemaVersion: string; id: string; retrievedAt: string; latitude: number; longitude: number; elevationM: number; start: string; end: string; timeStandard: string; kind: string; provider: string; spatialSupport: string; missingDays: number; weather: WeatherDay[]; sources: { id: string; url: string; sha256: string; raw_file: string; provider_header: Record<string, unknown> }[]; satellites: { id: string; status: string; support: string; reason: string }[] }
export interface FieldContext {
  name: string; latitude: number; longitude: number; boundary: [number, number][];
  boundaryConfirmed: Confirmation; baselineConfirmed: Confirmation;
  soilCapacity: number | null; soilSource: 'demo-assumption' | 'farmer-entry' | 'soil-survey';
  irrigation: Confirmation; irrigationLimit: number | null; irrigationEfficiency: number | null;
  forageBuyer: Confirmation; forageEquipment: Confirmation; forageSuitable: Confirmation;
  smallGrainBuyer: Confirmation; smallGrainEquipment: Confirmation; smallGrainSuitable: Confirmation;
  coverEquipment: Confirmation; laborAvailable: Confirmation;
  residueRetained: boolean; budget: number | null;
  baseline: 'maize-soybean' | 'soybean-maize';
}
export interface EnterpriseCropOverride {
  price: number | null;
  cost: number | null;
}
export interface EnterpriseInputs {
  schemaVersion: 'enterprise-inputs-v1';
  source: 'catalog-default' | 'farmer-entry';
  reviewed: boolean;
  note: string;
  crops: Partial<Record<CropId, EnterpriseCropOverride>>;
  cloverCreditKgN: [number, number];
  nitrogenCreditUsdPerKg: number;
}
export interface ScenarioRequest {
  field: FieldContext;
  horizon: { startYear: 2027; years: 4 };
  initialState: { storageFraction: number | null; snowMm: number | null; residueCover: number | null; source: 'assumption' | 'farmer-entry' };
  calendar: { maize: [number, number]; soybean: [number, number]; ryeSow: number };
  rainfall: number; warming: number; price: number; terminationDay: number;
  weights: { soil: number; water: number; economy: number };
  showScores: boolean;
  decision: { selection: StrategyId | 'defer' | null; notes: string; reviewed: boolean };
  history:FieldHistory;
  enterprise: EnterpriseInputs;
}
export interface Crop { id: CropId; name: string; color: string; family: string; root: number; kc: [number, number, number]; yieldT: number; price: number; cost: number; fertilizerN: number; removalN: number; fixation: number; ky: number; source: string; assumption: string; }
export interface YearResult { year: number; weatherYear: number; crop: CropId; demand: number; deficit: number; irrigation: number; withdrawal: number; et: number; coverDays: number; sensitiveStressDays: number; heatDays: number; margin: number; revenue: number; cost: number; fertilizer: number; fixation: number; removal: number; credit: number; creditLow: number; creditHigh: number; yieldT: number; }
export interface DailyResult { date: string; planningYear: number; crop: CropId | null; living: boolean; rain: number; et0: number; demand: number; actual: number; deficit: number; irrigation: number; withdrawal: number; applicationLoss: number; runoff: number; drainage: number; storage: number; snow: number; residueCover: number; events: string[]; residual: number; }
export interface ConstraintCheck { id: string; label: string; status: Feasibility; detail: string }
export interface DistributionSummary { unit: string; direction: 'min' | 'max'; mean: number; min: number; max: number; q10: number; q90: number; values: number[] }
export type ObjectiveId = 'deficit' | 'coverDays' | 'margin';
export interface MemberResult {
  id: string; weatherStart: number; weatherEnd: number;
  initialStorage: number; initialSnow: number; initialResidue: number;
  terminal: { storage: number; snow: number; residueCover: number; crop: CropId | null };
  totals: { deficit: number; coverDays: number; margin: number; et: number; irrigation: number; withdrawal: number };
  delta: { deficit: number; coverDays: number; margin: number };
  years: YearResult[]; maxWaterResidual: number;
}
export interface StrategyRationale {
  windowConnections:import('./history-opportunities').StrategyWindowConnection[];
  method: 'strategy-rationale-v1';
  strategyId: StrategyId;
  templateBasis: string;
  question: string;
  mechanisms: { id: string; title: string; description: string; claimLimit: string }[];
  observedContext: {
    id: string;
    source: 'power-forcing' | 'farmer-history' | 'farmer-management' | 'landsat' | 'seasonal-regional' | 'ecostress' | 'grace' | 'template';
    role: 'observed-context' | 'withheld' | 'management-assumption';
    applicability: 'matching' | 'mismatched' | 'unavailable' | 'regional-only' | 'not-used';
    period: string | null;
    summary: string;
    claimLimit: string;
  }[];
  contraryOrMissing: string[];
  localReviewQuestions: string[];
  projectedBenefitsNote: string;
  scoringUnaffected: true;
}
export interface StrategyResult {
  id: StrategyId; name: string; sequence: string; years: YearResult[]; daily: DailyResult[];
  members: MemberResult[]; objectives: Record<ObjectiveId, DistributionSummary>;
  pairedDifferences: Record<ObjectiveId, DistributionSummary>;
  constraints: ConstraintCheck[]; feasibility: Feasibility;
  demand: number; deficit: number; irrigation: number; withdrawal: number; et: number; coverDays: number;
  sensitiveStressDays: number; heatDays: number; margin: number; economicResilience: number;
  marginRange: [number, number]; nitrogenBalance: number; nitrogenCredit: [number, number];
  fertilizer: number; fixation: number; removal: number; transition: number;
  eligible: boolean; issues: string[]; reviewFlags: string[]; dominated: boolean;
  pareto: 'nondominated' | 'dominated' | 'not-assessed'; match: number | null;
  scoreRange: [number, number] | null;
  delta: { margin: number; deficit: number; coverDays: number };
  unavailable: { soilCarbonChange: null; soilLoss: null; pestReduction: null; probabilityBetter: null };
  rationale?: StrategyRationale;
}
export interface ComparisonResult {
  version: string; status: 'ready' | 'insufficient-information'; reason?: string;
  evidenceId: string; assumptions: string[]; strategies: StrategyResult[]; preferred: StrategyId | null;
  horizon?: { startYear: number; years: number }; normalizationVersion?: string;
  memberIds?: string[]; fieldAreaHa?: number; reviewFlags?: string[];
}
export interface SensitivityPoint { value: number; preferred: StrategyId | null; margin: number | null; }
export interface SensitivityResult { reference: StrategyId | null; tested: number; favored: Record<StrategyId, number>; ranges: Record<StrategyId, [number, number]>; sweeps: { rainfall: SensitivityPoint[]; price: SensitivityPoint[]; soil: SensitivityPoint[] }; changes: { variable: string; value: number; preferred: StrategyId | null }[]; nextObservation: string; }

import type { ComparisonResult, EvidenceSeries, ScenarioRequest, SensitivityResult, StrategyResult } from './types';
import { validateRequest } from './engine';

export const STORAGE_KEY = 'rotation-atlas-decision-v1';
export type ReportFormat = 'json' | 'excel' | 'word';

export interface SavedDecision {
  schema: 1;
  updatedAt: string;
  request: ScenarioRequest;
  pending: boolean;
}

export interface ReportPayload {
  title: string;
  createdAt: string;
  request: ScenarioRequest;
  result: unknown;
  evidence: Omit<EvidenceSeries, 'weather'> & { weather?: undefined };
  reviewQuestions: string[];
  notice: string;
}

export function saveDecision(request: ScenarioRequest): SavedDecision {
  validateRequest(request);
  const value: SavedDecision = {
    schema: 1,
    updatedAt: new Date().toISOString(),
    request,
    pending: true,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  return value;
}

export function loadDecision(): SavedDecision | null {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (value?.schema !== 1) return null;
    validateRequest(value.request);
    return value;
  } catch {
    return null;
  }
}

export async function syncDecision(value: SavedDecision): Promise<boolean> {
  // One opaque per-device key; no public listing or account-based sharing.
  try {
    let key = localStorage.getItem('rotation-atlas-device');
    if (!key) {
      key = crypto.randomUUID();
      localStorage.setItem('rotation-atlas-device', key);
    }
    const response = await fetch('/api/atlas/decisions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Atlas-Device': key },
      body: JSON.stringify(value),
    });
    if (!response.ok) return false;
    const result = await response.json();
    if (result.status !== 'saved' || result.updatedAt !== value.updatedAt) return false;
    const latest = loadDecision();
    if (latest?.updatedAt === value.updatedAt) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...value, pending: false }));
    }
    return true;
  } catch {
    return false;
  }
}

function buildPayload(
  request: ScenarioRequest,
  result: unknown,
  evidence: EvidenceSeries,
): ReportPayload {
  return {
    title: 'Rotation Atlas decision report',
    createdAt: new Date().toISOString(),
    request,
    result,
    evidence: { ...evidence, weather: undefined },
    reviewQuestions: [
      'Are these planting windows suitable for the cultivar and farm?',
      'Is available water capacity measured or assumed?',
      'Are buyers and machinery confirmed?',
      'Do local costs and nitrogen credits match these assumptions?',
    ],
    notice:
      'Illustrative decision support, not a forecast or fertilizer prescription. AI-assisted software; observations are unmodified NASA POWER responses.',
  };
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function strategiesFromResult(result: unknown): StrategyResult[] {
  if (!result || typeof result !== 'object') return [];
  const strategies = (result as ComparisonResult).strategies;
  return Array.isArray(strategies) ? strategies : [];
}

function preferredFromResult(result: unknown): string {
  if (!result || typeof result !== 'object') return '—';
  return (result as ComparisonResult).preferred ?? '—';
}

function sensitivityNote(result: unknown): string {
  if (!result || typeof result !== 'object') return 'Not run';
  const sensitivity = (result as { sensitivity?: SensitivityResult | null }).sensitivity;
  if (!sensitivity) return 'Not run';
  return `${sensitivity.tested} cases tested`;
}

function excelXml(payload: ReportPayload): string {
  const strategies = strategiesFromResult(payload.result);
  const rows = [
    ['Strategy', 'Sequence', 'Eligible', 'Margin USD/ha/yr', 'Water shortfall mm/yr', 'Living cover days/yr', 'Match score'],
    ...strategies.map((s) => [
      s.name,
      s.sequence,
      s.eligible ? 'yes' : 'no',
      String(Math.round(s.margin)),
      String(Math.round(s.deficit)),
      String(Math.round(s.coverDays)),
      String(Math.round(s.match)),
    ]),
  ];
  const meta = [
    ['Title', payload.title],
    ['Created', payload.createdAt],
    ['Field', payload.request.field.name],
    ['Preferred', preferredFromResult(payload.result)],
    ['Sensitivity', sensitivityNote(payload.result)],
    ['Notice', payload.notice],
  ];
  const cell = (value: string, type: 'String' | 'Number' = 'String') =>
    `<Cell><Data ss:Type="${type}">${escapeXml(value)}</Data></Cell>`;
  const sheet = (name: string, tableRows: string[][]) => `
 <Worksheet ss:Name="${escapeXml(name)}">
  <Table>
${tableRows
  .map(
    (row) =>
      `   <Row>${row
        .map((value) => cell(value, /^-?\d+(\.\d+)?$/.test(value) ? 'Number' : 'String'))
        .join('')}</Row>`,
  )
  .join('\n')}
  </Table>
 </Worksheet>`;
  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheet('Summary', meta)}
${sheet('Strategies', rows)}
 <Worksheet ss:Name="Review">
  <Table>
${payload.reviewQuestions.map((q) => `   <Row>${cell(q)}</Row>`).join('\n')}
  </Table>
 </Worksheet>
</Workbook>`;
}

function wordHtml(payload: ReportPayload): string {
  const strategies = strategiesFromResult(payload.result);
  const strategyRows = strategies
    .map(
      (s) => `<tr>
  <td>${escapeXml(s.name)}</td>
  <td>${escapeXml(s.sequence)}</td>
  <td>${s.eligible ? 'Yes' : 'No'}</td>
  <td>${Math.round(s.margin)}</td>
  <td>${Math.round(s.deficit)}</td>
  <td>${Math.round(s.coverDays)}</td>
</tr>`,
    )
    .join('');
  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
<head>
<meta charset="utf-8" />
<title>${escapeXml(payload.title)}</title>
<style>
  body{font-family:Calibri,Arial,sans-serif;color:#243b30;line-height:1.45}
  h1{font-size:22pt} h2{font-size:14pt;margin-top:24px}
  table{border-collapse:collapse;width:100%;margin:12px 0}
  th,td{border:1px solid #c9d2bf;padding:8px;text-align:left;font-size:10pt}
  th{background:#edf0e5}
  .note{color:#5f6f60;font-size:10pt}
</style>
</head>
<body>
  <h1>${escapeXml(payload.title)}</h1>
  <p class="note">Created ${escapeXml(payload.createdAt)}</p>
  <p><strong>Field:</strong> ${escapeXml(payload.request.field.name)} ·
     <strong>Preferred:</strong> ${escapeXml(preferredFromResult(payload.result))} ·
     <strong>Sensitivity:</strong> ${escapeXml(sensitivityNote(payload.result))}</p>
  <h2>Rotation comparison</h2>
  <table>
    <thead><tr><th>Strategy</th><th>Sequence</th><th>Eligible</th><th>Margin (USD/ha/yr)</th><th>Water shortfall (mm/yr)</th><th>Living cover (days/yr)</th></tr></thead>
    <tbody>${strategyRows}</tbody>
  </table>
  <h2>Review before acting</h2>
  <ol>${payload.reviewQuestions.map((q) => `<li>${escapeXml(q)}</li>`).join('')}</ol>
  <p class="note">${escapeXml(payload.notice)}</p>
</body>
</html>`;
}

export function downloadReport(
  request: ScenarioRequest,
  result: unknown,
  evidence: EvidenceSeries,
  format: ReportFormat = 'json',
): void {
  const payload = buildPayload(request, result, evidence);
  if (format === 'json') {
    triggerDownload(
      new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
      'rotation-atlas-decision.json',
    );
    return;
  }
  if (format === 'excel') {
    triggerDownload(
      new Blob([excelXml(payload)], { type: 'application/vnd.ms-excel' }),
      'rotation-atlas-decision.xls',
    );
    return;
  }
  triggerDownload(
    new Blob([wordHtml(payload)], { type: 'application/msword' }),
    'rotation-atlas-decision.doc',
  );
}

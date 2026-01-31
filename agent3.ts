import fs from 'fs/promises';
import { createObjectCsvWriter } from 'csv-writer';
import { generateContent, type AIProviderConfig } from './aiProvider.js';

export interface ActivityDuration {
  min: number;
  max: number;
  unit: string;
}

export interface ProcessActivity {
  id: string;
  name: string;
  type: 'task' | 'decision' | 'parallel' | 'approval';
  performer: string;
  duration: ActivityDuration;
  cost: number;
  resources: number;
  probability: number;
}

export interface ProcessFlow {
  from: string;
  to: string;
  condition: string | null;
  probability: number;
}

export interface ProcessResource {
  role: string;
  capacity: number;
  costPerHour: number;
}

export interface ProcessStructure {
  processName: string;
  activities: ProcessActivity[];
  flows: ProcessFlow[];
  resources: ProcessResource[];
}

export interface ScenarioModification {
  id: string;
  duration?: ActivityDuration;
  cost?: number;
  resources?: number;
}

export interface Scenario {
  scenarioName: string;
  description?: string;
  modifications?: {
    activities?: ScenarioModification[];
    resources?: ProcessResource[];
  };
}

export interface SimulationEvent {
  caseId: number;
  activity: string;
  activityId: string;
  event: 'start' | 'complete';
  timestamp: Date;
  resource: string;
  cost: number;
  duration?: number;
}

export interface ThroughputMetrics {
  avg: number;
  min: number;
  max: number;
  median: number;
}

export interface CostMetrics {
  avg: number;
  total: number;
}

export interface PerformanceMetrics {
  throughput: ThroughputMetrics;
  cost: CostMetrics;
  waitingTime: Record<string, number>;
  utilization: Record<string, number>;
  casesCompleted: number;
}

export interface SimulationResult {
  scenario: string;
  metrics: PerformanceMetrics;
  events: SimulationEvent[];
}

export interface Bottleneck {
  activityId: string;
  activityName: string;
  severity: 'high' | 'medium' | 'low';
  reason: string;
  impact: string;
  metrics: {
    utilization: number;
    waitingTime: number;
    frequency: number;
  };
}

export interface AntiPattern {
  pattern: string;
  location: string;
  description: string;
}

export interface BottleneckAnalysis {
  bottlenecks: Bottleneck[];
  antiPatterns: AntiPattern[];
}

export interface ExpectedImpact {
  throughputReduction: string;
  costChange: string;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface Recommendation {
  id: string;
  title: string;
  type: 'parallelize' | 'aggregate' | 'remove' | 'automate' | 'reallocate';
  description: string;
  affectedActivities: string[];
  expectedImpact: ExpectedImpact;
  implementation: string;
}

export interface ToBeModel {
  activities: ProcessActivity[];
  flows: ProcessFlow[];
  changes: string;
}

export interface Improvements {
  recommendations: Recommendation[];
  toBeModel: ToBeModel;
  tradeoffAnalysis: {
    costVsTime: string;
    costVsRisk: string;
    timeVsRisk: string;
  };
}

export interface TradeoffAnalysis {
  paretoFrontier: string[];
  recommendations: {
    costOptimal: string;
    timeOptimal: string;
    balanced: string;
  };
  analysis: string;
}

export interface OptimizationResults {
  processStructure: ProcessStructure;
  scenarios: Scenario[];
  simulationResults: SimulationResult[];
  bottleneckAnalysis: BottleneckAnalysis;
  improvements: Improvements;
  tradeoffAnalysis: TradeoffAnalysis;
}

// API Response types
export interface Agent3AnalyzeResponse {
  decision: string;
  explanation: string;
  processStructure: ProcessStructure;
}

export interface Agent3ScenariosResponse {
  decision: string;
  explanation: string;
  scenarios: Scenario[];
}

export interface Agent3SimulateResponse {
  decision: string;
  explanation: string;
  simulationResults: SimulationResult[];
}

export interface Agent3OptimizeResponse {
  decision: string;
  explanation: string;
  bottleneckAnalysis: BottleneckAnalysis;
  improvements: Improvements;
  tradeoffAnalysis: TradeoffAnalysis;
}

export interface Agent3FullAnalysisResponse {
  decision: string;
  explanation: string;
  results: OptimizationResults;
  report: string;
}

class BPMNOptimizationAgent {
  private providerConfig: AIProviderConfig;

  constructor(providerConfig?: AIProviderConfig) {
    this.providerConfig = providerConfig || { model: 'gemini', apiKey: '' };
  }

  private async generateAIContent(prompt: string): Promise<string> {
    const result = await generateContent(
      this.providerConfig,
      prompt,
      {
        systemInstruction: 'You are a BPMN process optimization expert. Respond only with valid JSON.',
        temperature: 1.0,
        responseFormat: 'json',
      }
    );
    return result.text;
  }

  // 1. Ekstrakcija strukture procesa iz opisa
  async extractProcessStructure(processDescription, bpmnDiagram = null) {
    const prompt = `Analiziraj naslednji poslovni proces in ekstrahiraj strukturirane podatke.

${bpmnDiagram ? `BPMN Diagram:\n${bpmnDiagram}\n\n` : ''}

Opis procesa:
${processDescription}

Vrni JSON s sledečo strukturo:
{
  "processName": "Ime procesa",
  "activities": [
    {
      "id": "A1",
      "name": "Ime aktivnosti",
      "type": "task|decision|parallel|approval",
      "performer": "Vloga",
      "duration": {"min": 5, "max": 10, "unit": "minutes"},
      "cost": 50,
      "resources": 1,
      "probability": 1.0
    }
  ],
  "flows": [
    {"from": "A1", "to": "A2", "condition": null, "probability": 1.0}
  ],
  "resources": [
    {"role": "Delavec", "capacity": 5, "costPerHour": 25}
  ]
}

Identificiraj vse aktivnosti, odločitvene točke, paralelne tokove in odobritve.`;

    const text = await this.generateAIContent(prompt);
    console.log(text)
    return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
  }

  // 2. Generiranje simulacijskih scenarijev
  async generateScenarios(processStructure) {
    const prompt = `Na podlagi naslednje strukture procesa generiraj 5 različnih what-if scenarijev za testiranje:

${JSON.stringify(processStructure, null, 2)}

Generiraj scenarije kot:
1. Baseline (trenutno stanje)
2. Optimistični scenarij (hitrejše izvedbe, manj čakalnih časov)
3. Pesimistični scenarij (daljše izvedbe, več zamud)
4. Povečana kapaciteta (več resursov)
5. Avtomatizirani procesi (nekaterim aktivnostim zmanjšamo čas)

Vrni JSON array scenarijev z modifikacijami aktivnosti in resursov. JSON mora biti kot ta js objekt:
{
  scenarioName: string;
  description?: string;
  modifications?: {
    activities?: ScenarioModification[];
    resources?: ProcessResource[];
  }
  
ScenarioModification {
  id: string;
  duration?: ActivityDuration;
  cost?: number;
  resources?: number;
}
ProcessResource {
  role: string;
  capacity: number;
  costPerHour: number;
} `;

    const text = await this.generateAIContent(prompt);
    console.log(text)
    return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
  }

  // 3. Simulacija procesa in generiranje event logov
  async simulateProcess(processStructure, scenario, numInstances = 100) {
    console.log(`Simuliram proces: ${scenario.scenarioName} (${numInstances} instanc)...`);
    
    const events = [];
    const resourceUtilization = {};
    
    // Inicializacija resursov
    processStructure.resources.forEach(r => {
      resourceUtilization[r.role] = { busy: 0, total: 0, waiting: [] };
    });

    // Apliciranje scenarija modifikacij
    const modifiedActivities = this.applyScenarioModifications(
      processStructure.activities, 
      scenario.modifications
    );

    for (let caseId = 1; caseId <= numInstances; caseId++) {
      let currentTime = new Date(2024, 0, 1, 8, 0, 0);
      let visitedActivities = new Set();
      
      await this.simulateCase(
        caseId, 
        modifiedActivities, 
        processStructure.flows,
        currentTime, 
        events, 
        resourceUtilization,
        visitedActivities
      );
    }

    return { events, resourceUtilization };
  }

  applyScenarioModifications(activities, modifications) {
    if (!modifications) return activities;
    
    return activities.map(activity => {
      const mod = modifications.activities?.find(m => m.id === activity.id);
      if (mod) {
        return {
          ...activity,
          duration: mod.duration || activity.duration,
          cost: mod.cost || activity.cost,
          resources: mod.resources || activity.resources
        };
      }
      return activity;
    });
  }

  async simulateCase(caseId, activities, flows, startTime, events, resourceUtil, visited) {
    const queue = [{ activityId: activities[0].id, time: startTime }];
    
    while (queue.length > 0) {
      const { activityId, time } = queue.shift();
      
      if (visited.has(activityId)) continue;
      
      const activity = activities.find(a => a.id === activityId);
      if (!activity) continue;

      // Začetek aktivnosti
      const startEvent = {
        caseId,
        activity: activity.name,
        activityId: activity.id,
        event: 'start',
        timestamp: new Date(time),
        resource: activity.performer,
        cost: 0
      };
      events.push(startEvent);

      // Simulacija trajanja
      const duration = this.randomBetween(
        activity.duration.min, 
        activity.duration.max
      );
      const endTime = new Date(time.getTime() + duration * 60000);

      // Zaključek aktivnosti
      const endEvent = {
        caseId,
        activity: activity.name,
        activityId: activity.id,
        event: 'complete',
        timestamp: endTime,
        resource: activity.performer,
        cost: activity.cost || 0,
        duration: duration
      };
      events.push(endEvent);

      visited.add(activityId);

      if (resourceUtil[activity.performer]) {
        resourceUtil[activity.performer].total += duration;
      }

      const nextFlows = flows.filter(f => f.from === activityId);
      
      for (const flow of nextFlows) {
        if (!flow.condition || Math.random() < (flow.probability || 1.0)) {
          queue.push({ activityId: flow.to, time: endTime });
        }
      }
    }
  }

  randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  // 4. Izračun KPI-jev (performance metrics)
  calculatePerformanceMetrics(events, resourceUtil, processStructure) {
    const cases = {};
    
    events.forEach(event => {
      if (!cases[event.caseId]) {
        cases[event.caseId] = { start: null, end: null, cost: 0, activities: [] };
      }
      
      if (event.event === 'start' && !cases[event.caseId].start) {
        cases[event.caseId].start = event.timestamp;
      }
      if (event.event === 'complete') {
        cases[event.caseId].end = event.timestamp;
        cases[event.caseId].cost += event.cost;
        cases[event.caseId].activities.push({
          name: event.activity,
          duration: event.duration
        });
      }
    });

    const throughputTimes = [];
    const costs = [];
    
    Object.values(cases).forEach(c => {
      if (c.start && c.end) {
        const throughputTime = (c.end - c.start) / (1000 * 60 * 60); // ure
        throughputTimes.push(throughputTime);
        costs.push(c.cost);
      }
    });

    const avgThroughput = throughputTimes.reduce((a, b) => a + b, 0) / throughputTimes.length;
    const avgCost = costs.reduce((a, b) => a + b, 0) / costs.length;

    // Waiting time analysis
    const waitingTimes = this.calculateWaitingTimes(events);
    
    // Resource utilization
    const utilization = {};
    const totalSimTime = 8 * 60 * Object.keys(cases).length / 5; // 8h delovnik, 5 dni na teden
    
    Object.entries(resourceUtil).forEach(([role, data]) => {
      const resource = processStructure.resources.find(r => r.role === role);
      const capacity = resource ? resource.capacity : 1;
      utilization[role] = (data.total / (totalSimTime * capacity)) * 100;
    });

    return {
      throughput: {
        avg: avgThroughput,
        min: Math.min(...throughputTimes),
        max: Math.max(...throughputTimes),
        median: this.median(throughputTimes)
      },
      cost: {
        avg: avgCost,
        total: costs.reduce((a, b) => a + b, 0)
      },
      waitingTime: waitingTimes,
      utilization,
      casesCompleted: Object.keys(cases).length
    };
  }

  calculateWaitingTimes(events) {
    const waiting = {};
    const sorted = events.sort((a, b) => a.timestamp - b.timestamp);
    
    let lastEnd = {};
    
    sorted.forEach(event => {
      if (event.event === 'start' && lastEnd[event.caseId]) {
        const wait = (event.timestamp - lastEnd[event.caseId]) / (1000 * 60);
        if (!waiting[event.activity]) waiting[event.activity] = [];
        waiting[event.activity].push(wait);
      }
      if (event.event === 'complete') {
        lastEnd[event.caseId] = event.timestamp;
      }
    });

    const avgWaiting = {};
    Object.entries(waiting).forEach(([activity, times]) => {
      avgWaiting[activity] = times.reduce((a, b) => a + b, 0) / times.length;
    });

    return avgWaiting;
  }

  median(arr) {
    const sorted = arr.sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  // 5. Analiza ozkih grl (bottleneck detection)
  async detectBottlenecks(processStructure, performanceMetrics, events) {
    const prompt = `Analiziraj naslednje performance metrike in identificiraj ozka grla (bottlenecks) v procesu:

Struktura procesa:
${JSON.stringify(processStructure.activities, null, 2)}

Performance metrike:
- Povprečni throughput: ${performanceMetrics.throughput.avg.toFixed(2)} ur
- Utilizacija resursov: ${JSON.stringify(performanceMetrics.utilization, null, 2)}
- Čakalni časi: ${JSON.stringify(performanceMetrics.waitingTime, null, 2)}

Vrni JSON z:
{
  "bottlenecks": [
    {
      "activityId": "A2",
      "activityName": "Ime aktivnosti",
      "severity": "high|medium|low",
      "reason": "Razlog zakaj je bottleneck",
      "impact": "Opis vpliva na proces",
      "metrics": {
        "utilization": 95,
        "waitingTime": 120,
        "frequency": 0.8
      }
    }
  ],
  "antiPatterns": [
    {
      "pattern": "unnecessary_approval|excessive_handoffs|sequential_when_parallel",
      "location": "Kje v procesu",
      "description": "Opis anti-patterna"
    }
  ]
}`;

    const text = await this.generateAIContent(prompt);
    return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
  }

  // 6. Generiranje izboljšav in TO-BE modela
  async generateImprovements(processStructure, bottlenecks, performanceMetrics) {
    const prompt = `Generiraj konkretne izboljšave procesa in optimiziran TO-BE model.

AS-IS proces:
${JSON.stringify(processStructure, null, 2)}

Identificirana ozka grla:
${JSON.stringify(bottlenecks, null, 2)}

Trenutne performance:
- Throughput: ${performanceMetrics.throughput.avg.toFixed(2)} ur
- Strošek: ${performanceMetrics.cost.avg.toFixed(2)} €

Apliciraj refactoring pravila:
1. PARALLELIZE - aktivnosti ki se lahko izvajajo vzporedno
2. AGGREGATOR - združi podobne aktivnosti
3. REMOVE - odstrani nepotrebne odobritve/hand-offs
4. AUTOMATE - avtomatiziraj repetitivne naloge
5. RESOURCE REALLOCATION - prerazporedi resurse

Vrni JSON:
{
  "recommendations": [
    {
      "id": "R1",
      "title": "Naslov priporočila",
      "type": "parallelize|aggregate|remove|automate|reallocate",
      "description": "Opis",
      "affectedActivities": ["A1", "A2"],
      "expectedImpact": {
        "throughputReduction": "30%",
        "costChange": "-15%",
        "riskLevel": "low|medium|high"
      },
      "implementation": "Kako implementirati"
    }
  ],
  "toBeModel": {
    "activities": [...],
    "flows": [...],
    "changes": "Seznam sprememb"
  },
  "tradeoffAnalysis": {
    "costVsTime": "Analiza",
    "costVsRisk": "Analiza",
    "timeVsRisk": "Analiza"
  }
}`;

    const text = await this.generateAIContent(prompt);
    return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
  }

  // 7. Trade-off analiza
  async performTradeoffAnalysis(improvements, currentMetrics) {
    const scenarios = improvements.recommendations.map((rec, idx) => ({
      id: `scenario_${idx + 1}`,
      name: rec.title,
      cost: this.parsePercentage(rec.expectedImpact.costChange, currentMetrics.cost.avg),
      time: this.parsePercentage(rec.expectedImpact.throughputReduction, currentMetrics.throughput.avg),
      risk: this.riskToScore(rec.expectedImpact.riskLevel)
    }));

    const prompt = `Izvedi multi-criteria trade-off analizo za naslednje scenarije:

Trenutne metrike:
- Čas: ${currentMetrics.throughput.avg.toFixed(2)} ur
- Strošek: ${currentMetrics.cost.avg.toFixed(2)} €

Scenariji:
${JSON.stringify(scenarios, null, 2)}

Vrni JSON z:
{
  "paretoFrontier": ["scenario_1", "scenario_3"],
  "recommendations": {
    "costOptimal": "scenario_id",
    "timeOptimal": "scenario_id",
    "balanced": "scenario_id"
  },
  "analysis": "Podrobna analiza trade-offs"
}`;

    const text = await this.generateAIContent(prompt);
    return JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
  }

  parsePercentage(percentStr, baseValue) {
    const match = percentStr.match(/-?\d+/);
    if (!match) return baseValue;
    const percent = parseInt(match[0]);
    return baseValue * (1 + percent / 100);
  }

  riskToScore(riskLevel) {
    const scores = { low: 1, medium: 5, high: 9 };
    return scores[riskLevel] || 5;
  }

  // 8. Shranjevanje event logov v CSV
  async saveEventLogToCsv(events, filename = 'event_log.csv') {
    const csvWriter = createObjectCsvWriter({
      path: filename,
      header: [
        { id: 'caseId', title: 'Case ID' },
        { id: 'activity', title: 'Activity' },
        { id: 'activityId', title: 'Activity ID' },
        { id: 'event', title: 'Event Type' },
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'resource', title: 'Resource' },
        { id: 'cost', title: 'Cost' },
        { id: 'duration', title: 'Duration (min)' }
      ]
    });

    await csvWriter.writeRecords(events);
    console.log(`Event log shranjen v ${filename}`);
  }

  // 9. Glavna analiza - orchestrator
  async analyzeAndOptimize(processDescription, bpmnDiagram = null, numInstances = 100) {
    console.log('Začenjam analizo procesa...\n');

    try {
      // Faza 1: Ekstrakcija strukture
      console.log('Faza 1: Ekstrakcija strukture procesa...');
      const processStructure = await this.extractProcessStructure(processDescription, bpmnDiagram);
      console.log(`Ekstrahiranih ${processStructure.activities.length} aktivnosti\n`);

      // Faza 2: Generiranje scenarijev
      console.log('Faza 2: Generiranje what-if scenarijev...');
      const scenarios = await this.generateScenarios(processStructure);
      console.log(`Generirano ${scenarios.length} scenarijev\n`);

      // Faza 3: Simulacija
      console.log('Faza 3: Simulacija scenarijev...');
      const simulationResults = [];
      
      for (const scenario of scenarios) {
        const { events, resourceUtilization } = await this.simulateProcess(
          processStructure, 
          scenario, 
          numInstances
        );
        
        const metrics = this.calculatePerformanceMetrics(
          events, 
          resourceUtilization, 
          processStructure
        );

        simulationResults.push({
          scenario: scenario.scenarioName,
          metrics,
          events
        });

        // Shrani event log za baseline
        console.log(scenarios)
        if (scenario.scenarioName.includes('Baseline')) {
          await this.saveEventLogToCsv(events, 'baseline_event_log.csv');
        }
      }
      console.log('✓ Simulacije zaključene\n');

      // Faza 4: Detekcija bottleneckov
      console.log('🔍 Faza 4: Detekcija ozkih grl...');
      const baselineResult = simulationResults[0];
      const bottleneckAnalysis = await this.detectBottlenecks(
        processStructure,
        baselineResult.metrics,
        baselineResult.events
      );
      console.log(`✓ Najdenih ${bottleneckAnalysis.bottlenecks.length} bottleneckov\n`);

      // Faza 5: Generiranje izboljšav
      console.log('💡 Faza 5: Generiranje izboljšav...');
      const improvements = await this.generateImprovements(
        processStructure,
        bottleneckAnalysis,
        baselineResult.metrics
      );
      console.log(`✓ Generirano ${improvements.recommendations.length} priporočil\n`);

      // Faza 6: Trade-off analiza
      console.log('⚖️  Faza 6: Trade-off analiza...');
      const tradeoffAnalysis = await this.performTradeoffAnalysis(
        improvements,
        baselineResult.metrics
      );
      console.log('✓ Trade-off analiza zaključena\n');

      // Shrani vse rezultate
      await this.saveResults({
        processStructure,
        scenarios,
        simulationResults,
        bottleneckAnalysis,
        improvements,
        tradeoffAnalysis
      });

      return {
        processStructure,
        scenarios,
        simulationResults,
        bottleneckAnalysis,
        improvements,
        tradeoffAnalysis
      };

    } catch (error) {
      console.error('Napaka pri analizi:', error.message);
      throw error;
    }
  }

  async saveResults(results) {
    await fs.writeFile(
      'optimization_results.json',
      JSON.stringify(results, null, 2)
    );
    console.log('✓ Rezultati shranjeni v optimization_results.json\n');
  }

  // 10. Generiranje poročila
  generateReport(results) {
    const baseline = results.simulationResults[0];
    
    let report = `
╔══════════════════════════════════════════════════════════════╗
║          POROČILO O OPTIMIZACIJI PROCESA                     ║
╚══════════════════════════════════════════════════════════════╝

TRENUTNO STANJE (AS-IS)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Povprečni throughput: ${baseline.metrics.throughput.avg.toFixed(2)} ur
Povprečni strošek: ${baseline.metrics.cost.avg.toFixed(2)} €
Število aktivnosti: ${results.processStructure.activities.length}

IDENTIFICIRANA OZKA GRLA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    results.bottleneckAnalysis.bottlenecks.forEach((bn, idx) => {
      report += `
${idx + 1}. ${bn.activityName} (${bn.severity.toUpperCase()})
   Razlog: ${bn.reason}
   Vpliv: ${bn.impact}
`;
    });

    report += `
PRIPOROČILA ZA IZBOLJŠAVE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    results.improvements.recommendations.forEach((rec, idx) => {
      report += `
${idx + 1}. ${rec.title} [${rec.type.toUpperCase()}]
   ${rec.description}
   
   Pričakovani učinek:
   - Čas: ${rec.expectedImpact.throughputReduction}
   - Strošek: ${rec.expectedImpact.costChange}
   - Tveganje: ${rec.expectedImpact.riskLevel}
   
   Implementacija: ${rec.implementation}
`;
    });

    report += `
TRADE-OFF ANALIZA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${results.tradeoffAnalysis.analysis}

Priporočeni scenariji:
- Optimalen za stroške: ${results.tradeoffAnalysis.recommendations.costOptimal}
- Optimalen za čas: ${results.tradeoffAnalysis.recommendations.timeOptimal}
- Uravnotežen: ${results.tradeoffAnalysis.recommendations.balanced}

PRIMERJAVA SCENARIJEV
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

    results.simulationResults.forEach(result => {
      report += `
${result.scenario}:
  Throughput: ${result.metrics.throughput.avg.toFixed(2)} ur
  Strošek: ${result.metrics.cost.avg.toFixed(2)} €
  Primeri: ${result.metrics.casesCompleted}
`;
    });

    return report;
  }
}

// ═══════════════════════════════════════════════════════════════
// API EXPORT FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function getAgent(providerConfig?: AIProviderConfig): BPMNOptimizationAgent {
  return new BPMNOptimizationAgent(providerConfig);
}

/**
 * Analyze process structure from description and optional BPMN diagram
 */
export async function analyzeProcessStructure(
  processDescription: string,
  bpmnXml?: string,
  providerConfig?: AIProviderConfig
): Promise<Agent3AnalyzeResponse> {
  const agent = getAgent(providerConfig);

  console.log('Agent3: Extracting process structure...');
  const processStructure = await agent.extractProcessStructure(processDescription, bpmnXml);

  return {
    decision: `Extracted ${processStructure.activities.length} activities, ${processStructure.flows.length} flows, and ${processStructure.resources.length} resource types from process description`,
    explanation: `Process "${processStructure.processName}" has been analyzed. Found activities: ${processStructure.activities.map(a => a.name).join(', ')}. The process involves ${processStructure.resources.map(r => r.role).join(', ')} as key performers.`,
    processStructure
  };
}

/**
 * Generate what-if scenarios for a process structure
 */
export async function generateProcessScenarios(
  processStructure: ProcessStructure,
  providerConfig?: AIProviderConfig
): Promise<Agent3ScenariosResponse> {
  const agent = getAgent(providerConfig);

  console.log('Agent3: Generating what-if scenarios...');
  const scenarios = await agent.generateScenarios(processStructure);

  return {
    decision: `Generated ${scenarios.length} simulation scenarios for process optimization`,
    explanation: `Created scenarios: ${scenarios.map((s: Scenario) => s.name).join(', ')}. These scenarios cover baseline performance, optimistic/pessimistic variations, increased capacity, and automation possibilities.`,
    scenarios
  };
}

/**
 * Run simulation for process with given scenarios
 */
export async function simulateProcess(
  processStructure: ProcessStructure,
  scenarios: Scenario[],
  numInstances: number = 100,
  providerConfig?: AIProviderConfig
): Promise<Agent3SimulateResponse> {
  const agent = getAgent(providerConfig);

  console.log(`Agent3: Simulating process with ${numInstances} instances per scenario...`);
  const simulationResults: SimulationResult[] = [];

  for (const scenario of scenarios) {
    const { events, resourceUtilization } = await agent.simulateProcess(
      processStructure,
      scenario,
      numInstances
    );

    const metrics = agent.calculatePerformanceMetrics(
      events,
      resourceUtilization,
      processStructure
    );

    // Don't include full events in response to reduce payload size
    simulationResults.push({
      scenario: scenario.scenarioName,
      metrics,
      events: [] // Events excluded from API response for performance
    });
  }

  const baselineMetrics = simulationResults[0]?.metrics;

  return {
    decision: `Completed simulation of ${scenarios.length} scenarios with ${numInstances} instances each`,
    explanation: `Baseline performance: avg throughput ${baselineMetrics?.throughput.avg.toFixed(2)} hours, avg cost €${baselineMetrics?.cost.avg.toFixed(2)}. Resource utilization varies across scenarios. Detailed metrics available for each scenario.`,
    simulationResults
  };
}

/**
 * Perform full optimization analysis including bottleneck detection and recommendations
 */
export async function optimizeProcess(
  processStructure: ProcessStructure,
  simulationResults: SimulationResult[],
  providerConfig?: AIProviderConfig
): Promise<Agent3OptimizeResponse> {
  const agent = getAgent(providerConfig);

  const baselineResult = simulationResults[0];
  if (!baselineResult) {
    throw new Error('No simulation results available for optimization');
  }

  console.log('Agent3: Detecting bottlenecks...');
  const bottleneckAnalysis = await agent.detectBottlenecks(
    processStructure,
    baselineResult.metrics,
    baselineResult.events
  );

  console.log('Agent3: Generating improvements...');
  const improvements = await agent.generateImprovements(
    processStructure,
    bottleneckAnalysis,
    baselineResult.metrics
  );

  console.log('Agent3: Performing trade-off analysis...');
  const tradeoffAnalysis = await agent.performTradeoffAnalysis(
    improvements,
    baselineResult.metrics
  );

  return {
    decision: `Identified ${bottleneckAnalysis.bottlenecks.length} bottlenecks and generated ${improvements.recommendations.length} optimization recommendations`,
    explanation: `Key bottlenecks: ${bottleneckAnalysis.bottlenecks.map(b => b.activityName).join(', ')}. Recommended optimizations include: ${improvements.recommendations.map(r => r.title).join(', ')}. Trade-off analysis suggests ${tradeoffAnalysis.recommendations.balanced} as balanced option.`,
    bottleneckAnalysis,
    improvements,
    tradeoffAnalysis
  };
}

/**
 * Full analysis pipeline - combines all steps
 */
export async function fullProcessAnalysis(
  processDescription: string,
  bpmnXml?: string,
  numInstances: number = 50,
  providerConfig?: AIProviderConfig
): Promise<Agent3FullAnalysisResponse> {
  const agent = getAgent(providerConfig);

  console.log('Agent3: Starting full process analysis...');

  const results = await agent.analyzeAndOptimize(processDescription, bpmnXml, numInstances);
  const report = agent.generateReport(results);

  return {
    decision: `Completed full optimization analysis for "${results.processStructure.processName}"`,
    explanation: `Analyzed ${results.processStructure.activities.length} activities across ${results.scenarios.length} scenarios. Found ${results.bottleneckAnalysis.bottlenecks.length} bottlenecks and generated ${results.improvements.recommendations.length} improvement recommendations. Trade-off analysis completed with Pareto frontier identification.`,
    results,
    report
  };
}

// Export the class for direct usage
export { BPMNOptimizationAgent };

// ═══════════════════════════════════════════════════════════════
// PRIMER UPORABE (CLI)
// ═══════════════════════════════════════════════════════════════
//
// async function main() {
//   // POMEMBNO: Zamenjaj z svojim Gemini API ključem
//   const API_KEY = process.env.GEMINI_API_KEY || 'your-gemini-api-key-here';
//
//   const agent = new BPMNOptimizationAgent(API_KEY);
//
//   // Dodati vrednost resursa kao varijablu ali da ai generise te info
//   const processDescription = `
//
//
// Resursi:
// - Delavci: 20 oseb (25€/uro)
// - Vodje: 3 osebe (45€/uro)
// - Nabavni referenti: 2 osebi (30€/uro)
// - Skladiščniki: 4 osebe (22€/uro)
// - Direktor: 1 oseba (80€/uro)
// `;
//
//   try {
//     const results = await agent.analyzeAndOptimize(processDescription, null, 50);
//
//     const report = agent.generateReport(results);
//     console.log(report);
//
//     await fs.writeFile('process_optimization_report.txt', report);
//
//   } catch (error: any) {
//     console.error('Napaka:', error.message);
//   }
// }



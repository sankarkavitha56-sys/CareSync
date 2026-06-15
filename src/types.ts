export interface Patient {
  id: string; // e.g. "P101"
  bedId: string; // e.g. "Bed 1" or "Bed 8"
  name: string;
  age: number;
  gender: string;
  dx: string; // Diagnosis
  hr: number;
  spo2: number;
  bpSys: number;
  bpDia: number;
  temp: number; // Celsius (e.g. 39.4)
  rr: number; // Resp rate
  co2: number; // EtCO2
  riskScore: number; // predicted risk of becoming critical in the next 30 mins
  priority: "Critical" | "High Risk" | "Moderate" | "Stable";
  spo2History: number[]; // normally 5 readings to trace trend
  hrHistory: number[];
  tempHistory: number[];
  bpSysHistory: number[];
  alertStatus: string;
}

export interface Alarm {
  label: string;
  level: "critical" | "warning" | "normal";
  active: boolean;
}

export function getPatientMetrics(p: Patient) {
  // Determine if SpO2 low
  const isSpO2Low = p.spo2 < 93;
  // Determine if Temp is high (> 38.0 C or 100.4 F)
  const isHighTemp = p.temp > 38.0;
  // Determine abnormal HR or BP
  const isHRAbnormal = p.hr < 60 || p.hr > 115;
  const isBPAbnormal = p.bpSys < 90 || p.bpSys > 140 || p.bpDia < 50 || p.bpDia > 90;

  // Multiple severe abnormalities count (risk criteria)
  let severeCount = 0;
  if (p.spo2 < 92) severeCount++;
  if (p.hr > 120 || p.hr < 50) severeCount++;
  if (p.temp >= 38.8) severeCount++;
  if (p.bpSys < 90 || p.bpDia < 48) severeCount++;

  let specialist = "General Medicine";
  if (severeCount >= 2) {
    specialist = "Critical Care Team";
  } else if (isSpO2Low) {
    specialist = "Pulmonologist";
  } else if (isHRAbnormal || isBPAbnormal) {
    specialist = "Cardiologist";
  } else if (isHighTemp) {
    specialist = "Infectious Disease Specialist";
  }

  // SpO2 deterioration trend detector (strictly decreasing history)
  let spo2Deteriorating = false;
  if (p.spo2History && p.spo2History.length >= 4) {
    let continuousDecrease = true;
    for (let i = 1; i < p.spo2History.length; i++) {
      if (p.spo2History[i] >= p.spo2History[i - 1]) {
        continuousDecrease = false;
        break;
      }
    }
    spo2Deteriorating = continuousDecrease;
  }

  return {
    isSpO2Low,
    isHighTemp,
    isHRAbnormal,
    isBPAbnormal,
    severeCount,
    specialist,
    spo2Deteriorating,
  };
}

export function getExplainableAIReason(p: Patient) {
  const reasons: string[] = [];
  if (p.spo2 < 93) {
    reasons.push(`SpO₂ dropped to ${p.spo2}% (low target <93%)`);
  }
  if (p.hr > 115) {
    reasons.push(`HR increased to ${p.hr} bpm (tachycardia)`);
  } else if (p.hr < 60) {
    reasons.push(`HR dropped to ${p.hr} bpm (bradycardia)`);
  }
  
  const fTemp = ((p.temp * 9) / 5 + 32).toFixed(1);
  if (p.temp > 38.0) {
    reasons.push(`Temperature increased to ${p.temp}°C (${fTemp}°F) (high fever)`);
  } else if (p.temp < 36.0) {
    reasons.push(`Temperature dropped to ${p.temp}°C (${fTemp}°F) (hypothermia)`);
  }
  
  if (p.bpSys < 90 || p.bpDia < 50) {
    reasons.push(`Blood Pressure dropped to ${p.bpSys}/${p.bpDia} mmHg (critical hypotension)`);
  } else if (p.bpSys > 140 || p.bpDia > 90) {
    reasons.push(`Blood Pressure increased to ${p.bpSys}/${p.bpDia} mmHg (severe hypertension)`);
  }

  if (p.rr > 22) {
    reasons.push(`Respiratory Rate increased to ${p.rr}/min (tachypnea)`);
  } else if (p.rr < 10) {
    reasons.push(`Respiratory Rate dropped to ${p.rr}/min (bradypnea)`);
  }

  return reasons;
}

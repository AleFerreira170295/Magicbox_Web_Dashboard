export interface HealthCheckItem {
  status?: string | null;
  message?: string | null;
}

export interface BasicHealthRecord {
  status?: string | null;
  service?: string | null;
  version?: string | null;
  environment?: string | null;
  timestamp?: string | null;
}

export interface ReadinessHealthRecord extends BasicHealthRecord {
  checks?: Record<string, HealthCheckItem>;
}

export interface LivenessHealthRecord extends BasicHealthRecord {
  uptime?: string | null;
}

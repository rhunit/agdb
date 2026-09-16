export type LocationId = "centrum" | "oost" | "depijp" | "boerejongens";

export type ReviewSource = "organisch" | "qr" | "smoke" | "onbekend";
export type Confidence = "bevestigd" | "vermoedelijk" | "onbekend";
export type LogType = "smoke" | "qr";

export interface Location {
  id: LocationId;
  name: string;
}

export interface Review {
  id: string;
  location: LocationId;
  reviewer: string;
  initials: string;
  rating: 1 | 2 | 3 | 4 | 5;
  snippet: string;
  source: ReviewSource;
  confidence: Confidence;
  daysAgo: number;
  responded: boolean;
}

export interface WeeklyLogEntry {
  id: string;
  week: string;
  location: LocationId;
  type: LogType;
  submitter: string;
  timestamp: string;
  note: string;
}

export interface SearchViewsWeek {
  week: string;
  centrum: number;
  oost: number;
  depijp: number;
  boerejongens: number;
}

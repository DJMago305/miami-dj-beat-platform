/**
 * Type shape for web/data/one-hit-wonder-experience.json
 * Real case-study dataset (Miami DJ Beat LLC / DJMago305) — NOT demo/fictional data.
 * No build step consumes this file today (the site is plain JS); it exists as a
 * documentation contract for whoever wires this JSON into the Bridge Engine /
 * Library, and as a target shape if the platform ever adopts TypeScript.
 */

export type CutType =
  | 'blend-armonico'
  | 'cut-on-drop'
  | 'hard-cut'
  | 'stem-transition'
  | 'echo-out';

export interface BridgeLogic {
  cutType: CutType;
  /** Short, human-readable reason this cut type fits this specific track. */
  rationale: string;
}

export interface OHWTrackBase {
  id: string;
  order: number;
  title: string;
  artist: string;
  year: number;
  bpm: number;
  /**
   * Best-effort Camelot Wheel estimate (Claude-derived, unverified). `null`
   * when no confident estimate was available. Run through Mixed In Key /
   * rekordbox before relying on this for live harmonic mixing.
   */
  camelotKeyEstimate: string | null;
  /** 1-10, Claude-derived from BPM + the dossier's own mix note. */
  energyEstimate: number;
  /** Verbatim "Estrategia de Mezcla & Performance" from the source dossier. */
  mixNote: string;
  bridgeLogic: BridgeLogic;
  sfxCues: string[];
}

export interface OHWAngloTrack extends OHWTrackBase {
  era: string;
}

export interface OHWLatinoTrack extends OHWTrackBase {
  genre: string;
}

export interface OHWEdition<T> {
  editionName: string;
  audience: string;
  phases?: string[];
  tracks: T[];
}

export interface FusionCrossoverSet {
  set: string;
  tempoRange: string;
  impact: string;
  /** Ordered list of track ids (from anglo/latino) — the real Ping-Pong sequence. */
  sequence: string[];
}

export interface FusionCrossoverEdition {
  editionName: string;
  audience: string;
  technique: string;
  sets: FusionCrossoverSet[];
}

export interface TechnicalRiderInputRow {
  channel: string;
  source: string;
  mic: string;
  signal: string;
  monitor: string;
}

export interface TechnicalRider {
  booth: { controllers: string[]; monitors: string };
  pa: { type: string; targetDbA: string; subRange: string };
  video: { screen: string; input: string; sync: string };
  fx: string[];
  stage: { size: string; power: string; soundcheck: string };
  inputList: TechnicalRiderInputRow[];
  liveMusicians: { role: string; gear: string; reinforces: string }[];
}

export interface OneHitWonderExperienceDataset {
  meta: {
    title: string;
    type: 'REAL_CASE_STUDY';
    source: string[];
    production: string;
    musicalDirection: string;
    legal: string;
    version: string;
    notes: string;
  };
  anglo: OHWEdition<OHWAngloTrack>;
  latino: OHWEdition<OHWLatinoTrack>;
  fusionCrossover: FusionCrossoverEdition;
  technicalRider: TechnicalRider;
}

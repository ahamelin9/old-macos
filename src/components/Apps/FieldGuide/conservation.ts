/**
 * Global conservation status, from a taxon's `conservation_statuses`.
 *
 * iNaturalist's singular `conservation_status` has no usable name
 * (`status_name` is always null), and for many taxa is missing or carries a
 * NatureServe rank instead. The list holds every assessment, regional ones
 * included; the global one is the IUCN Red List entry with no place.
 */

export interface ConservationStatusRecord {
  status?: string | null;
  authority?: string | null;
  /** iNaturalist's IUCN-equivalent level: 5 DD, 10 LC ... 70 EX */
  iucn?: number | null;
  url?: string | null;
  place?: { id: number } | null;
}

export type IucnCode = 'DD' | 'LC' | 'NT' | 'VU' | 'EN' | 'CR' | 'EW' | 'EX';

export interface GlobalConservation {
  code: IucnCode;
  label: string;
  /** Link to the assessment, when iNaturalist has one */
  url: string | null;
}

export const IUCN_LABELS: Record<IucnCode, string> = {
  DD: 'Data Deficient',
  LC: 'Least Concern',
  NT: 'Near Threatened',
  VU: 'Vulnerable',
  EN: 'Endangered',
  CR: 'Critically Endangered',
  EW: 'Extinct in the Wild',
  EX: 'Extinct'
};

const IUCN_BY_LEVEL: Record<number, IucnCode> = {
  5: 'DD',
  10: 'LC',
  20: 'NT',
  30: 'VU',
  40: 'EN',
  50: 'CR',
  60: 'EW',
  70: 'EX'
};

const isIucnCode = (code: string): code is IucnCode => code in IUCN_LABELS;

/** The worldwide IUCN Red List category, or null when none is on file. */
export const globalIucnStatus = (
  statuses: ConservationStatusRecord[] | null | undefined
): GlobalConservation | null => {
  const entry = statuses?.find(s => !s.place && s.authority === 'IUCN Red List');
  if (!entry) return null;
  const raw = (entry.status || '').toUpperCase();
  const code = isIucnCode(raw) ? raw : IUCN_BY_LEVEL[entry.iucn ?? -1];
  if (!code) return null;
  return { code, label: IUCN_LABELS[code], url: entry.url || null };
};

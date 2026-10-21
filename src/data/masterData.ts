export type MasterRisk = 'High' | 'Medium' | 'Low'

export interface MasterDataProblem {
  id: string
  objectType: 'Vehicle' | 'Vendor' | 'Purchase order' | 'Material'
  object: string
  system: string
  problem: string
  risk: MasterRisk
  fix: string
  /** True when the row was found in the running plant, false when it is a sample. */
  live: boolean
  /** Follow it through the systems, where there is something to follow. */
  traceKey?: string
}

/**
 * The problems the plant cannot show on its own. They are labelled as samples
 * everywhere they appear.
 */
export const SAMPLE_PROBLEMS: MasterDataProblem[] = [
  {
    id: 'MD-S1',
    objectType: 'Vendor',
    object: 'VEND-1044',
    system: 'SAP S/4HANA Stainless',
    problem: 'No VAT number on the vendor record.',
    risk: 'High',
    fix: 'Ask procurement for the VAT number before the next invoice is booked, and block payment until it is there.',
    live: false,
  },
  {
    id: 'MD-S2',
    objectType: 'Purchase order',
    object: '4500011907',
    system: 'SAP S/4HANA Stainless',
    problem: 'Closed purchase order is still receiving deliveries.',
    risk: 'High',
    fix: 'Re-open the order or point the deliveries at the current one. A goods receipt against a closed order parks the invoice.',
    live: false,
  },
  {
    id: 'MD-S3',
    objectType: 'Vendor',
    object: 'VEND-1043 and VEND-1051',
    system: 'SAP S/4HANA Stainless',
    problem: 'Two vendor records for the same supplier, same bank account.',
    risk: 'Medium',
    fix: 'Merge them and keep the older number, so the spend and the payment terms sit in one place.',
    live: false,
  },
  {
    id: 'MD-S4',
    objectType: 'Material',
    object: 'SCR-321-SHRED',
    system: 'D365 F&O OneCore',
    problem: 'Material has no grade window and no stock unit.',
    risk: 'Medium',
    fix: 'Set the grade window and the unit to KG, otherwise stock postings cannot be checked against the chemistry.',
    live: false,
  },
]

export const SCAN_LOG = [
  'Reading the vehicle master from YardLink…',
  'Comparing every stored empty weight against the last weighings on the weighbridge…',
  'Reading vendors and purchase orders from SAP…',
  'Reading materials and grades from D365 F&O OneCore…',
  'Looking for duplicates, missing fields and records that should be closed…',
  'Scan finished. The problems are listed below, worst first.',
]

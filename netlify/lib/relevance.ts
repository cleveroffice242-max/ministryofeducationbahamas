// What counts as "in scope" for this app: coverage with a direct link to the
// Ministry of Education, Science and Technology (MOEST) of The Bahamas or to its
// leadership — Minister Chester Cooper (DPM), Director of Education Dominique
// McCartney-Russell and Permanent Secretary Neil Campbell. General education news
// (schools, teachers, UB, BTVI, the union…) that never mentions any of them is out.

const MINISTRY =
  /\b(ministry of education|education ministry|minister of education|education minister|director of education|department of education|permanent secretary (in|of) the ministry of education|MOEST)\b/i;

const COOPER =
  /\b(chester\s+cooper|(DPM|deputy\s+prime\s+minister|minister|hon\.?|honourable)\s+(chester\s+)?cooper)\b/i;
const MCCARTNEY_RUSSELL = /\b(mc\s?cartney[\s-]+russell|dominique\s+(n\.?\s+)?mc\s?cartney)\b/i;
const CAMPBELL = /\b(neil\s+campbell|permanent\s+secretary\s+(neil\s+)?campbell)\b/i;

export const LEADERSHIP = [
  { key: "cooper", label: "Minister Chester Cooper", re: COOPER },
  { key: "mccartney-russell", label: "Director Dominique McCartney-Russell", re: MCCARTNEY_RUSSELL },
  { key: "campbell", label: "Permanent Secretary Neil Campbell", re: CAMPBELL },
];

/** True when the text directly references the Ministry or one of its three leaders. */
export const isRelevant = (text: string) =>
  MINISTRY.test(text) || LEADERSHIP.some((p) => p.re.test(text));

export const SCOPE_DESCRIPTION =
  "the Ministry of Education, Science and Technology (MOEST) of The Bahamas, Minister of Education Chester Cooper (M.P., Deputy Prime Minister), " +
  "Director of Education Dominique N. McCartney-Russell, or Permanent Secretary Neil Campbell";

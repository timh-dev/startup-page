import type { Continent } from "./constants";

// English short names, lowercased, mapped to one of our 7 continents — used to
// guess Continent from a Country string the user typed (or that we lifted off
// the end of their search query / found in a Wikipedia extract). A heuristic,
// not a gazetteer: good enough to pre-fill a field the user can still edit.
const COUNTRY_TO_CONTINENT: Record<string, Continent> = {
  algeria: "Africa", angola: "Africa", benin: "Africa", botswana: "Africa", "burkina faso": "Africa",
  burundi: "Africa", cameroon: "Africa", "cape verde": "Africa", "central african republic": "Africa",
  chad: "Africa", comoros: "Africa", "democratic republic of the congo": "Africa", congo: "Africa",
  "ivory coast": "Africa", "cote d'ivoire": "Africa", djibouti: "Africa", egypt: "Africa",
  "equatorial guinea": "Africa", eritrea: "Africa", eswatini: "Africa", ethiopia: "Africa", gabon: "Africa",
  gambia: "Africa", ghana: "Africa", guinea: "Africa", "guinea-bissau": "Africa", kenya: "Africa",
  lesotho: "Africa", liberia: "Africa", libya: "Africa", madagascar: "Africa", malawi: "Africa",
  mali: "Africa", mauritania: "Africa", mauritius: "Africa", morocco: "Africa", mozambique: "Africa",
  namibia: "Africa", niger: "Africa", nigeria: "Africa", rwanda: "Africa", "sao tome and principe": "Africa",
  senegal: "Africa", seychelles: "Africa", "sierra leone": "Africa", somalia: "Africa",
  "south africa": "Africa", "south sudan": "Africa", sudan: "Africa", tanzania: "Africa", togo: "Africa",
  tunisia: "Africa", uganda: "Africa", zambia: "Africa", zimbabwe: "Africa",

  antarctica: "Antarctica",

  afghanistan: "Asia", armenia: "Asia", azerbaijan: "Asia", bahrain: "Asia", bangladesh: "Asia",
  bhutan: "Asia", brunei: "Asia", cambodia: "Asia", china: "Asia", cyprus: "Asia", georgia: "Asia",
  india: "Asia", indonesia: "Asia", iran: "Asia", iraq: "Asia", israel: "Asia", japan: "Asia",
  jordan: "Asia", kazakhstan: "Asia", kuwait: "Asia", kyrgyzstan: "Asia", laos: "Asia", lebanon: "Asia",
  malaysia: "Asia", maldives: "Asia", mongolia: "Asia", myanmar: "Asia", burma: "Asia", nepal: "Asia",
  "north korea": "Asia", oman: "Asia", pakistan: "Asia", palestine: "Asia", philippines: "Asia",
  qatar: "Asia", "saudi arabia": "Asia", singapore: "Asia", "south korea": "Asia", "sri lanka": "Asia",
  syria: "Asia", taiwan: "Asia", tajikistan: "Asia", thailand: "Asia", "timor-leste": "Asia",
  turkey: "Asia", turkmenistan: "Asia", "united arab emirates": "Asia", uzbekistan: "Asia",
  vietnam: "Asia", yemen: "Asia",

  albania: "Europe", andorra: "Europe", austria: "Europe", belarus: "Europe", belgium: "Europe",
  "bosnia and herzegovina": "Europe", bulgaria: "Europe", croatia: "Europe", "czech republic": "Europe",
  czechia: "Europe", denmark: "Europe", estonia: "Europe", finland: "Europe", france: "Europe",
  germany: "Europe", greece: "Europe", hungary: "Europe", iceland: "Europe", ireland: "Europe",
  italy: "Europe", kosovo: "Europe", latvia: "Europe", liechtenstein: "Europe", lithuania: "Europe",
  luxembourg: "Europe", malta: "Europe", moldova: "Europe", monaco: "Europe", montenegro: "Europe",
  netherlands: "Europe", "north macedonia": "Europe", norway: "Europe", poland: "Europe",
  portugal: "Europe", romania: "Europe", russia: "Europe", "san marino": "Europe", serbia: "Europe",
  slovakia: "Europe", slovenia: "Europe", spain: "Europe", sweden: "Europe", switzerland: "Europe",
  ukraine: "Europe", "united kingdom": "Europe", uk: "Europe", england: "Europe", scotland: "Europe",
  wales: "Europe", "vatican city": "Europe",

  "antigua and barbuda": "North America", bahamas: "North America", barbados: "North America",
  belize: "North America", canada: "North America", "costa rica": "North America", cuba: "North America",
  dominica: "North America", "dominican republic": "North America", "el salvador": "North America",
  grenada: "North America", guatemala: "North America", haiti: "North America", honduras: "North America",
  jamaica: "North America", mexico: "North America", nicaragua: "North America", panama: "North America",
  "saint kitts and nevis": "North America", "saint lucia": "North America",
  "saint vincent and the grenadines": "North America", "trinidad and tobago": "North America",
  "united states": "North America", usa: "North America", us: "North America", "u.s.": "North America",
  "u.s.a.": "North America", "united states of america": "North America", greenland: "North America",

  australia: "Oceania", fiji: "Oceania", kiribati: "Oceania", "marshall islands": "Oceania",
  micronesia: "Oceania", nauru: "Oceania", "new zealand": "Oceania", palau: "Oceania",
  "papua new guinea": "Oceania", samoa: "Oceania", "solomon islands": "Oceania", tonga: "Oceania",
  tuvalu: "Oceania", vanuatu: "Oceania",

  argentina: "South America", bolivia: "South America", brazil: "South America", chile: "South America",
  colombia: "South America", ecuador: "South America", guyana: "South America", paraguay: "South America",
  peru: "South America", suriname: "South America", uruguay: "South America", venezuela: "South America",
};

// Longest-name-first so "South Africa" matches before a stray "Africa" would.
const COUNTRY_NAMES_BY_LENGTH_DESC = Object.keys(COUNTRY_TO_CONTINENT).sort((a, b) => b.length - a.length);

function toDisplayName(lowerName: string): string {
  return lowerName.replace(/(^|\s|-)([a-z])/g, (_match, boundary, letter) => `${boundary}${letter.toUpperCase()}`);
}

export function guessContinent(countryName: string): Continent | "" {
  const match = COUNTRY_TO_CONTINENT[countryName.trim().toLowerCase()];
  return match || "";
}

/** Best-effort scan of free text (e.g. a Wikipedia extract) for a recognizable country name. */
export function guessCountryFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const name of COUNTRY_NAMES_BY_LENGTH_DESC) {
    const pattern = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(lower)) {
      return toDisplayName(name);
    }
  }
  return null;
}

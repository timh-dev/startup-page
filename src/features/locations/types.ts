export interface LocationItem {
  id: string;
  name: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  googleEarthUrl: string;
  park: string;
  country: string;
  continent: string;
  tags: string[];
  wikiTitle: string;
  wikiUrl: string;
  wikiExtract: string;
  wikiImageUrl: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface WikipediaSummary {
  title: string;
  url: string;
  extract: string;
  imageUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  countryHint: string | null;
}

import makesJson from "./car-makes.json";

export type CarMake = { name: string; slug: string };

export const ALL_MAKES: CarMake[] = makesJson as CarMake[];

/** Most common makes in France/EU — shown first in the picker. */
const POPULAR_SLUGS = [
  "renault", "peugeot", "citroen", "volkswagen", "mercedes-benz", "bmw", "audi",
  "toyota", "ford", "opel", "fiat", "dacia", "nissan", "hyundai", "kia", "seat",
  "skoda", "mini", "volvo", "tesla", "porsche", "land-rover", "jeep", "mazda",
  "honda", "suzuki", "alfa-romeo", "ds", "cupra", "lexus", "jaguar", "ferrari",
  "lamborghini", "maserati", "bentley", "smart",
];

export const POPULAR_MAKES: CarMake[] = POPULAR_SLUGS
  .map((slug) => ALL_MAKES.find((m) => m.slug === slug))
  .filter((m): m is CarMake => Boolean(m));

export function logoUrl(slug: string) {
  return `/car-logos/${slug}.png`;
}

export function findMake(name: string): CarMake | undefined {
  const n = name.trim().toLowerCase();
  return ALL_MAKES.find((m) => m.name.toLowerCase() === n || m.slug === n);
}

export interface AppSummary {
  appId: number;
  name: string;
  bundleId: string;
  developer: string;
  developerId?: number;
  price: number;
  currency: string;
  rating: number | null;
  ratingCount: number | null;
  genre: string;
  genres: string[];
  artworkUrl: string;
  storeUrl: string;
  releaseDate: string | null;
  lastUpdated: string | null;
  version: string | null;
  minimumOsVersion: string | null;
  contentRating: string | null;
  fileSizeBytes: number | null;
  description: string;
  releaseNotes: string | null;
  screenshotUrls: string[];
  ipadScreenshotUrls: string[];
  languages: string[];
}

export interface AppReview {
  reviewId: string;
  rating: number;
  title: string;
  body: string;
  version: string;
  author: string;
  updatedAt: string;
  country: string;
}

export interface ChartEntry {
  rank: number;
  appId: number;
  name: string;
  developer: string;
  artworkUrl: string;
  storeUrl: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapItunesResult(r: any): AppSummary {
  return {
    appId: r.trackId,
    name: r.trackName,
    bundleId: r.bundleId,
    developer: r.sellerName ?? r.artistName ?? "",
    developerId: r.artistId,
    price: r.price ?? 0,
    currency: r.currency ?? "USD",
    rating: r.averageUserRating ?? null,
    ratingCount: r.userRatingCount ?? null,
    genre: r.primaryGenreName ?? "",
    genres: r.genres ?? [],
    artworkUrl: r.artworkUrl512 ?? r.artworkUrl100 ?? r.artworkUrl60 ?? "",
    storeUrl: r.trackViewUrl ?? "",
    releaseDate: r.releaseDate ?? null,
    lastUpdated: r.currentVersionReleaseDate ?? null,
    version: r.version ?? null,
    minimumOsVersion: r.minimumOsVersion ?? null,
    contentRating: r.contentAdvisoryRating ?? null,
    fileSizeBytes: r.fileSizeBytes ? Number(r.fileSizeBytes) : null,
    description: r.description ?? "",
    releaseNotes: r.releaseNotes ?? null,
    screenshotUrls: r.screenshotUrls ?? [],
    ipadScreenshotUrls: r.ipadScreenshotUrls ?? [],
    languages: r.languageCodesISO2A ?? [],
  };
}

/**
 * App Store genre ID → display name, used for category-scoped top charts
 * (the legacy itunes.apple.com RSS feeds accept these as `genre=`).
 */
export const GENRES: Record<number, string> = {
  6000: "Business",
  6001: "Weather",
  6002: "Utilities",
  6003: "Travel",
  6004: "Sports",
  6005: "Social Networking",
  6006: "Reference",
  6007: "Productivity",
  6008: "Photo & Video",
  6009: "News",
  6010: "Navigation",
  6011: "Music",
  6012: "Lifestyle",
  6013: "Health & Fitness",
  6014: "Games",
  6015: "Finance",
  6016: "Entertainment",
  6017: "Education",
  6018: "Books",
  6020: "Medical",
  6023: "Food & Drink",
  6024: "Shopping",
  6026: "Developer Tools",
  6027: "Graphics & Design",
};

export function genreName(genreId: number | null | undefined): string | null {
  return genreId == null ? null : (GENRES[genreId] ?? `Genre ${genreId}`);
}

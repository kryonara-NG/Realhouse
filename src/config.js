// Reelhouse application configuration.
// Prefer a Vercel/local environment variable so the TMDB credential can be rotated
// without changing the application bundle. The fallback keeps the current demo
// deployment functional until its environment variable is configured.
export const TMDB_READ_TOKEN = import.meta.env.VITE_TMDB_READ_TOKEN || "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlMzlkMDkyODJmZDczNzkyYjFlODExMGM0ODYxZWU3ZiIsIm5iZiI6MTc3MjUzMDEwMi4zMzQsInN1YiI6IjY5YTZhOWI2ZDEzMmNjNDljNDc0M2NkNiIsIm5jb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.WZUJBxPNla8A0xn9kuJCAm8INNOWn1BxQnS5TWeeqEc";

interface InMemorySession {
  username: string | null;
}

export const inMemorySession: InMemorySession = {
  username: null,
};
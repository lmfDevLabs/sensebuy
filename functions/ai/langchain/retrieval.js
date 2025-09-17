export function makeRetriever(store) {
  return {
    retrieve: (query, k = 5) => store.similaritySearch(query, k),
  };
}

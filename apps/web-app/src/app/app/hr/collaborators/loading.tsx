// Return null to prevent loading flash on tab switches.
// The HR Shell + sub-nav remain mounted during client-side navigation,
// so the user sees a smooth transition instead of a full-page loader.
export default function PageLoading() {
  return null;
}

// Pure ErrorBoundary logic, kept separate so it can be tested without JSX.
export const stateFromError = (error) => ({ error });

// Berpindah rute (resetKey berubah) membersihkan error sebelumnya.
export const stateFromProps = (props, state) => (
  props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
);

// Logika murni ErrorBoundary, dipisah supaya bisa diuji tanpa JSX.
export const stateFromError = (error) => ({ error });

// Berpindah rute (resetKey berubah) membersihkan error sebelumnya.
export const stateFromProps = (props, state) => (
  props.resetKey !== state.resetKey ? { error: null, resetKey: props.resetKey } : null
);

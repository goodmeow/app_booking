// The editor runs an availability preview in the background while the user
// types. That preview must never lock the form: disabling the focused input
// blurs it, so the next keystrokes are lost and the title field has to be
// clicked again. Only a save or delete in flight locks the fields.
export const editorFieldDisabled = ({ readOnly = false, saving = false } = {}) =>
  Boolean(readOnly || saving);

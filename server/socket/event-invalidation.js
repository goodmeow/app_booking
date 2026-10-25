export const mergeEventAudiences = (...groups) => {
  const targets = new Map();
  for (const item of groups.flat()) {
    if (!item?.kind || !item?.id) continue;
    targets.set(`${item.kind}:${item.id}`, item);
  }
  return [...targets.values()];
};

export const emitEventInvalidation = (io, audiences) => {
  for (const audience of mergeEventAudiences(audiences)) {
    io?.of("/").to(`${audience.kind}:${audience.id}`).emit("response:event", { type: "events:changed" });
  }
};

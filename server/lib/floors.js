export const normalizedFloor = (value) => String(value ?? "").trim();

// `floors` is the current list; older rows and tokens carry only `floor`.
export const effectiveFloors = (principal) => {
  const list = Array.isArray(principal?.floors)
    ? principal.floors.map(normalizedFloor).filter(Boolean)
    : [];
  if (list.length) return [...new Set(list.map((floor) => floor.toLowerCase()))];
  const legacy = normalizedFloor(principal?.floor);
  return legacy ? [legacy.toLowerCase()] : [];
};

export const coversAllFloors = (principal) =>
  effectiveFloors(principal).includes("all");

export const coversFloor = (principal, floor) => {
  const wanted = normalizedFloor(floor).toLowerCase();
  if (!wanted) return false;
  return coversAllFloors(principal) || effectiveFloors(principal).includes(wanted);
};

export const coversAnyFloor = (principal, floors) =>
  (Array.isArray(floors) ? floors : []).some((floor) => coversFloor(principal, floor));

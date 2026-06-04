function nextId(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return 1;

  const ids = arr
    .map((item) => Number(item.id))
    .filter((id) => Number.isFinite(id));

  return ids.length ? Math.max(...ids) + 1 : 1;
}

module.exports = nextId;

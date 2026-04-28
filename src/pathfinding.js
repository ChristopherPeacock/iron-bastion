// A* pathfinding on the grid. Returns array of {col, row} or null if no path.
export function findPath(gridCells, startCol, startRow, endCol, endRow, gridCols, gridRows) {
  const key = (c, r) => c * 100 + r;
  const heur = (c, r) => Math.abs(c - endCol) + Math.abs(r - endRow);

  const open = new Map();
  const closed = new Set();
  const cameFrom = new Map();
  const gScore = new Map();

  const sk = key(startCol, startRow);
  open.set(sk, { col: startCol, row: startRow, f: heur(startCol, startRow) });
  gScore.set(sk, 0);

  while (open.size > 0) {
    // Pick node with lowest f score
    let curK = null;
    let lowestF = Infinity;
    for (const [k, node] of open) {
      if (node.f < lowestF) { lowestF = node.f; curK = k; }
    }

    const cur = open.get(curK);
    open.delete(curK);

    if (cur.col === endCol && cur.row === endRow) {
      const path = [];
      let k = curK;
      while (cameFrom.has(k)) {
        const node = cameFrom.get(k);
        path.unshift({ col: node.col, row: node.row });
        k = key(node.col, node.row);
      }
      path.push({ col: endCol, row: endRow });
      return path;
    }

    closed.add(curK);
    const curG = gScore.get(curK) || 0;

    const dirs = [
      { dc: 1, dr: 0 }, { dc: -1, dr: 0 },
      { dc: 0, dr: 1 }, { dc: 0, dr: -1 }
    ];

    for (const { dc, dr } of dirs) {
      const nc = cur.col + dc;
      const nr = cur.row + dr;
      if (nc < 0 || nc >= gridCols || nr < 0 || nr >= gridRows) continue;
      const nk = key(nc, nr);
      if (closed.has(nk)) continue;

      const cell = gridCells[nr][nc];
      // Walls block path; HQ does not block (enemy destination)
      if (cell.blocksPath && !(nc === endCol && nr === endRow)) continue;

      const tentG = curG + 1;
      const existG = gScore.get(nk) ?? Infinity;

      if (tentG < existG) {
        cameFrom.set(nk, { col: cur.col, row: cur.row });
        gScore.set(nk, tentG);
        open.set(nk, { col: nc, row: nr, f: tentG + heur(nc, nr) });
      }
    }
  }

  return null; // no path
}

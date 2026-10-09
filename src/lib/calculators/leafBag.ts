// Leaf bags — same formulas as the original leaf-bag-calculator (from the
// Altura Leaf Bag Calculator sheet). Cuts come from the BAG size; the leaf
// size is reference only.

export type LeafBagInput = { qty: number; bagWidth: number; bagDepth: number }

export type LeafBagCuts = {
  qty: number
  /** Width + 1, depth + 9: 2" flap, 6½" overlap, ½" seams. */
  longBottom: { width: number; length: number }
  /** Width + 1, depth + 2½: 2" hem, ½" seams. */
  shortTop: { width: number; length: number }
}

export function leafBagCuts({ qty, bagWidth: w, bagDepth: d }: LeafBagInput): LeafBagCuts {
  return {
    qty,
    longBottom: { width: w + 1, length: d + 9 },
    shortTop: { width: w + 1, length: d + 2.5 },
  }
}

export const ASSEMBLY_STEPS = [
  'Hem short side of small body panel at 2"',
  'Attach hook velcro (4") to face of small body panel',
  'Sew long and small body panels together',
  'Hem side seam allowances on long body panel',
  'Hem flap of long body panel (2")',
  'Attach loop velcro to long body panel',
  'Trim corners',
  'Turn inside out',
]

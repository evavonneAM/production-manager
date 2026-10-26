import type { ReactNode } from 'react'

export type ToolGroup = 'drapery' | 'cushions' | 'other'

export type Tool = {
  id: string
  group: ToolGroup
  /** In-app route, once a calculator has moved into the app. */
  route?: string
  /** Live calculator URL. Null while a tool isn't published yet. */
  url: string | null
  /** Extra search words (English) on top of the translated name/description. */
  keywords: string
  icon: ReactNode
  /** Shows prices — only admins see it. */
  adminOnly?: boolean
}

// Workroom calculators. Each is still its own small site; as they're finished
// they move into the app and `url` becomes an in-app route.
export const TOOLS: Tool[] = [
  {
    id: 'ripplefold',
    group: 'drapery',
    url: 'https://ripplefold-calculator.vercel.app',
    keywords: 'ripplefold yardage yards snap tape kirsch',
    icon: <path d="M3 4h18M5 4c0 6 2 9 2 16M9 4c0 6-2 9-2 16M13 4c0 6 2 9 2 16M17 4c0 6-2 9-2 16" />,
  },
  {
    id: 'drapery',
    group: 'drapery',
    route: '/tools/drapery-pleat',
    url: 'https://drapery-calculator.vercel.app',
    keywords: 'drapery pleat pinch spacing work order',
    icon: <path d="M3 4h18M6 4v4l-1 12M10 4v4l1 12M14 4v4l-1 12M18 4v4l1 12M5 8h15" />,
  },
  {
    id: 'workOrder',
    group: 'drapery',
    adminOnly: true,
    route: '/tools/work-order',
    url: null,
    keywords: 'work order drapery roman shade top treatment cornice valance yardage price estimate rocket',
    icon: <path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5" />,
  },
  {
    id: 'cushionCut',
    group: 'cushions',
    route: '/tools/cushion-cut',
    url: 'https://cushion-cut-dims.vercel.app',
    keywords: 'cushion cut dimensions plate boxing zipper cording',
    icon: (
      <>
        <rect x="3" y="7" width="18" height="10" rx="2" />
        <path d="M3 12h18" />
      </>
    ),
  },
  {
    id: 'cushionPricing',
    group: 'cushions',
    adminOnly: true,
    route: '/tools/cushion-pricing',
    url: 'https://cushion-pricing.vercel.app',
    keywords: 'cushion pricing price foam inches yards convert',
    icon: (
      <>
        <rect x="3" y="8" width="18" height="9" rx="2" />
        <path d="M12 3v3M10 4.5h4" />
      </>
    ),
  },
  {
    id: 'fabricYardage',
    group: 'cushions',
    route: '/tools/fabric-yardage',
    url: null,
    keywords: 'fabric yardage yards roll nesting layout railroaded up the roll cushion',
    icon: (
      <>
        <path d="M4 5h12v14H4z" />
        <path d="M16 7c2 0 4 1 4 5s-2 5-4 5M7 9h6M7 13h4" />
      </>
    ),
  },
  {
    id: 'upholstery',
    group: 'other',
    adminOnly: true,
    route: '/tools/upholstery',
    url: null,
    keywords: 'upholstery estimate labor estimate rocket',
    icon: <path d="M4 18v-6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6M4 14h16M6 18v2M18 18v2" />,
  },
  {
    id: 'estimates',
    group: 'other',
    adminOnly: true,
    route: '/estimates',
    url: null,
    keywords: 'estimate estimates quote proposal client pdf price am hov rhu',
    icon: <path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6" />,
  },
  {
    id: 'leafBag',
    group: 'other',
    route: '/tools/leaf-bag',
    url: 'https://leaf-bag-calculator.vercel.app',
    keywords: 'leaf bag cut list labels',
    icon: <path d="M6 21c0-9 5-15 14-17-1 9-7 14-14 14M6 21l7-8" />,
  },
  {
    id: 'floorplan',
    group: 'other',
    route: '/tools/floorplan-measure',
    url: 'https://floorplan-measure.vercel.app',
    keywords: 'floorplan floor plan measure pdf scale length area square feet room',
    icon: <path d="M3 3h18v18H3zM3 12h7v9M14 3v8h7M10 16h4" />,
  },
]

export const TOOL_GROUPS: ToolGroup[] = ['drapery', 'cushions', 'other']

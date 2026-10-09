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
    url: 'https://drapery-calculator.vercel.app',
    keywords: 'drapery pleat pinch spacing work order',
    icon: <path d="M3 4h18M6 4v4l-1 12M10 4v4l1 12M14 4v4l-1 12M18 4v4l1 12M5 8h15" />,
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
    id: 'upholstery',
    group: 'other',
    url: null,
    keywords: 'upholstery estimate labor quickbooks',
    icon: <path d="M4 18v-6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6M4 14h16M6 18v2M18 18v2" />,
  },
  {
    id: 'leafBag',
    group: 'other',
    url: 'https://leaf-bag-calculator.vercel.app',
    keywords: 'leaf bag cut list labels',
    icon: <path d="M6 21c0-9 5-15 14-17-1 9-7 14-14 14M6 21l7-8" />,
  },
]

export const TOOL_GROUPS: ToolGroup[] = ['drapery', 'cushions', 'other']

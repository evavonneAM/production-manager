// Work Order Builder — drapery, roman shades and top treatments with the house
// price book and Estimate Rocket line output. The builder itself is plain JSX
// (src/screens/calculators/work-order/); this screen just mounts it.
// Prices are shown, so the route is Admin-only (see App.tsx).
import WorkOrderBuilder from './work-order/WorkOrderBuilder'

export default function WorkOrder() {
  return <WorkOrderBuilder />
}

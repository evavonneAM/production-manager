# Estimate items, fabric and window treatments — plan

Owner workshop, 2026-10-24. Picture version: https://claude.ai/artifact/FkdoVhosq1KeNrJqxv22VZ
Nothing here is built yet. Build order is in [`BUILD_PLAN.md`](../BUILD_PLAN.md) (Round 4b);
the rules themselves are logged in [`DECISIONS.md`](DECISIONS.md).

## Items on an estimate

- Every line made by a pricing tool keeps its **worksheet** (the tool's inputs, tool name and
  version) on the estimate (`estimate_lines.spec`, decision 3). Lines are regenerated from it.
- **Add buttons** on the estimate: *Add cushion*, *Add upholstery*, and later *Add window
  treatment*. Each opens the tool tied to that estimate; *Add to estimate* returns to it with
  no estimate picker.
- **Reopen**: each tool line has "Open in Cushion Pricing" (or Upholstery…), which brings back
  the inputs and diagrams to change and re-price.

## Fabric

- Cushion and upholstery lines are labor + insert only. Fabric is its **own section** with one
  line per fabric, on screen and on the client PDF.
- The estimate keeps a list of its fabrics; each item says which fabric it uses for body, welt,
  contrast. The fabric line adds up the yards of **every item using it**, including items added
  later.
- **Rounding**: each item rounds up to whole yards on its own; the fabric line sums those. Any
  fabric line takes a typed yardage override; the price follows.
- **Price per yard** = wholesale × 2, minimum $75/yd. Wholesale is typed per fabric each time
  (no vendor price list). Wholesale never appears on the client PDF.
- **COM**: no charge; line shows the yards the client must send ("COM — 7 yd required").
- **Not chosen yet**: "Fabric — to be determined (not included)", yards still counted.
- **Plywood** sheets for board-mounted cushions are nested across the whole estimate, one line.

## Other estimate rules

- **Velcro** on board-mounted cushions: checkbox, $5 per linear foot of the cushion's length,
  rounded up to the next foot (75" → 7 ft = $35). Same price book in Cushion Pricing and
  Upholstery Estimate.
- **Estimated deposit**: under the total, "Estimated deposit: 50% to secure the job" with the
  amount, on screen and PDF. 50% by default, editable per estimate.
- **After Sent**: changes make a **revised copy** (HOV10001-R1); the sent version is kept
  read-only.

## Window treatments

- Move the Work Order Builder (drapery, roman, top treatments; roller parked) into the app as a
  Tools page with an *Add window treatment* button. Its house rules come along (one price for
  everyone, 1" spring-back per width, roman +8").
- **Lining** is inside the drapery price. **Hardware** is its own line at cost × 2.
- **Install**: $95 per shade (roman or roller); drapery install is a pick of ½ day $800 or full
  day $1,600. Replaces the Builder's $200/hr (3-hr minimum) / $95-per-window rule.
- Drapery fabric joins the same pooled fabric lines (widths × cut length + repeat). Drapery
  Pleat / Ripplefold layouts become that line's workroom diagrams.

## Client estimate look (owner, 2026-10-27)

Picture: https://claude.ai/artifact/YTWGY3t8CERq6smN6qLvPt (copy kept in
[`docs/estimate-look-mockup.html`](estimate-look-mockup.html)). The owner chose the
"Restoration Hardware" style **Gallery** look with the **Catalog** header:

- White paper. Header: small logo + business name in wide capitals on the left, a large
  light serif "Estimate" with number, date and revision on the right, a thin black rule
  under it; then a very light grey band with Prepared for / Install at / Rooms.
- Room titles in light serif wide capitals, **left justified**; item names in serif, specs
  in small grey sans joined by dots; hairline rules between lines.
- Columns Item / Qty / Each / Amount. Fabric lines use the same columns (yards in Qty,
  price per yard in Each); COM shows a dash for price and amount.
- All dollar amounts in the same sans font; subtotals and total in bold.
- Fonts (owner 2026-10-27, matching the catalog designer): **Inter** (stand-in for Neue
  Montreal). Item names Inter Medium, one size up from body; body Inter Light. Item details
  are bullets with a bold label ("Style:", "Insert:", "Velcro:"). The large "Estimate" and
  room titles stay in the light serif.
- Summary by room, total and estimated deposit at the end.
- AM and RHU use the same look with their own logos.

## Pillows (owner, 2026-10-27)

- New **Pillow** worksheet with an "Add pillow" button on the estimate. Price each =
  $125 labor (any size) + insert + add-ons. Pillow fabric adds into the group's fabric.
- Styles: Knife Edge; Welted (self or contrast); Flange (self or contrast, flange size);
  Butterfly Corner (optional self or contrast welt).
- Add-ons: welting +$10; contrast flange +$30 (self flange free); Celeste Bio tick +$10.
- Inserts: formulas from the owner's sheet "CUSHION PRICING + YARDAGE", tab PILLOW INSERT
  PRICING, used unchanged: square/lumbar Celeste W×D÷7.4, 50/50 ÷2.25, 25/75 ÷5; bolster
  Celeste L×4.5 (10" dia max), 50/50 L÷0.072, 25/75 L÷0.2 (8" max); round Celeste dia×2.2,
  50/50 dia×13, 25/75 dia×2.9 (20" max). The sheet's notes column is scratch; ignore it.
- Size picks from the sheet (Small 16, Medium 18, Large 20/22, Oversized 24/26, Lumbar
  12×18, 12×24, 14×36) or any typed size.
- Flange size is a typed box (no standard sizes yet, owner 2026-10-27).
- Pillow yards come from the cut pieces laid on the roll, like cushions.

## Diagrams and after acceptance

- Fabric roll maps, plywood sheets and cushion drawings are regenerated from the worksheets on
  an internal Workroom view; never on the client PDF.
- On **Accepted** (estimates step 2): worksheets become the job's cut sheets / plywood layout;
  each fabric line becomes a **fabric to order** for that job. The purchase list shows the
  pooled yards (all items on one roll, rounded once) as a **suggestion** beside the estimate's
  yards; the buyer picks either or types their own.

## Estimate design (settled with the owner 2026-10-24)

Picture: https://claude.ai/artifact/9Ezs4SSmRJBAucST49527P

- **Groups by room or window** (optional). "+ Add room or window group" splits an estimate;
  items move between groups with "Move to group". Groups are just named (no letters). With
  no groups the estimate is one list, as today.
- Each group holds its own items, its own **fabric** at the bottom and its own **subtotal**.
  A fabric used in two rooms shows each room's own yards there, so each room's price stands
  alone; the purchase list adds them up.
- The client PDF has a **summary by group** above the total.
- **Approve by room:** each group has a "Client approved" switch. On Accepted only approved
  groups become jobs and fabric orders, and the deposit is 50% of the approved groups.
- **Install at** address, separate from the client's (designer billed, install at the
  client's home). Defaults to "Same as client"; carries to the job, schedule and work orders.
- The PDF uses the business's real logo (HOV, AM, RHU).
- A revised copy says "REVISION 1", with its new number and "Replaces HOV10001, <date>".
- Item descriptions use the Estimate Rocket bullet list (Location, Style, Lining, Mounting…).
- Fabric table on screen: Vendor, Fabric, Sidemark (defaults client / project), Yards,
  Wholesale, Client price, Total. Vendor and sidemark are internal and carry to the fabric
  order; never on the client PDF.
- **Workroom diagrams** tab (fabric roll maps, plywood sheets, cushion drawings) plus a
  Workroom PDF.

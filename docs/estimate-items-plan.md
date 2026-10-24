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

## Diagrams and after acceptance

- Fabric roll maps, plywood sheets and cushion drawings are regenerated from the worksheets on
  an internal Workroom view; never on the client PDF.
- On **Accepted** (estimates step 2): worksheets become the job's cut sheets / plywood layout;
  each fabric line becomes a **fabric to order** for that job. The purchase list shows the
  pooled yards (all items on one roll, rounded once) as a **suggestion** beside the estimate's
  yards; the buyer picks either or types their own.

## Still to design before building

- Look of the estimate screen and the client PDF with the new sections (fabric, hardware,
  install, deposit, revision label).
